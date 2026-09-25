// Import rosters exported by the Midgard force builder at
// https://apps.iwouldliketorage.com/midgard-forces/ (Settings · "Download your forces").
// That file is the builder's whole library: {forces, customHeroTraits, customUnitTraits}.
// Contingents are optional there, so a hero carries one contingent name or null and a unit
// spreads its copies as [{value, qty}] or carries null. This app makes every unit belong to a
// contingent, so unassigned heroes and units are collected into a group of their own.
//
// A builder stack — {name: "Pedyt Spearmen", qty: 3} — is one troop template and three bases,
// which is what lets a re-import merge into the existing roster instead of replacing it.
import {newSeed, newTemplate, pickContingentColor, uniqueKey} from './model.js';

// Each of the builder's fifteen profiles declares one of the five Midgard unit types.
export const PROFILE_TYPES = {
    'Heavy Infantry': 'warriors',
    'Heavy Infantry with Missiles': 'warriors',
    'Formed Archers': 'warriors',
    'Hordes': 'warriors',
    'Light Infantry': 'skirmishers',
    'Shooters': 'skirmishers',
    'Knights': 'heavy_riders',
    'Medium Cavalry': 'heavy_riders',
    'Noble Riders & Light Chariots': 'light_riders',
    'Scouts': 'light_riders',
    'Artillery': 'monstrosities',
    'Dragon': 'monstrosities',
    'Elephants & War Mammoths': 'monstrosities',
    'Flying Beast': 'monstrosities',
    'Giant': 'monstrosities',
};

function cleanName(value) {
    return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, 200) : '';
}
function quantity(value) {
    const n = Math.floor(Number(value));
    return n > 0 ? Math.min(n, 300) : 1;
}
export function readForces(data) {
    if (!data || !Array.isArray(data.forces)) throw Error('Expected a force builder export with a “forces” list.');
    return data.forces.filter(f => f && typeof f === 'object').map((f, i) => ({
        ...f,
        name: cleanName(f.name) || `Force ${i + 1}`,
        heroes: Array.isArray(f.heroes) ? f.heroes.filter(h => h && typeof h === 'object') : [],
        units: Array.isArray(f.units) ? f.units.filter(u => u && typeof u === 'object') : [],
    }));
}
// The builder has no stable stack id, so a force is identified by its own id where it has one.
export function forceId(force) {
    return String(force.id ?? force.name);
}
// A hero names a single contingent; null, an empty name or a missing field means unassigned.
function heroGroup(hero) {
    return cleanName(hero.contingent) || null;
}
// A unit allocates its copies, so return one contingent name (or null) per copy. Bare strings
// and missing quantities are read as "all copies", and any copy left over stays unassigned.
function unitGroups(unit, qty) {
    const raw = unit.contingent;
    const list = typeof raw === 'string' ? [raw] : Array.isArray(raw) ? raw : [];
    const slots = [];
    for (const entry of list) {
        const value = cleanName(typeof entry === 'string' ? entry : entry?.value);
        if (!value) continue;
        const count = Math.floor(Number(typeof entry === 'string' ? qty : entry?.qty));
        for (let i = 0; i < (count > 0 ? count : qty) && slots.length < qty; i++) slots.push(value);
    }
    while (slots.length < qty) slots.push(null);
    return slots;
}
// Bases this force will need, shown in the picker before anything is imported.
export function baseCount(force) {
    return force.heroes.length + force.units.reduce((n, unit) => n + quantity(unit.qty), 0);
}
// Every hero and unit entry, flattened into "one recipe and its copies".
function stacks(force) {
    // Respect the builder's contingent switch: a force saved with it off keeps its old
    // assignments in the file, and those should not reappear here. Files from older exports
    // omit the switch, so fall back to whether anything is actually assigned.
    const grouped = force.useContingents === undefined
        ? force.heroes.some(heroGroup) || force.units.some(u => unitGroups(u, 1)[0])
        : Boolean(force.useContingents);
    const list = [];
    for (const hero of force.heroes) list.push({
        name: cleanName(hero.name) || 'Leader', kind: 'hero', hero, profile: '',
        traits: hero.traits || [], qty: 1, slots: [grouped ? heroGroup(hero) : null],
    });
    for (const entry of force.units) {
        const qty = quantity(entry.qty);
        list.push({
            name: cleanName(entry.name) || 'Unit', kind: 'unit', hero: null, profile: cleanName(entry.profile),
            traits: entry.traits || [], qty, slots: grouped ? unitGroups(entry, qty) : Array(qty).fill(null),
        });
    }
    return list;
}
const STOPWORDS = new Set(['and', 'the', 'with', 'from']);
function words(text) {
    return text.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2 && !STOPWORDS.has(w));
}
// "Pedyt Spearmen" should still find "Crimson spear levy", so words match on a shared prefix.
function related(a, b) {
    return a === b || (a.length >= 4 && b.startsWith(a)) || (b.length >= 4 && a.startsWith(b));
}
// The table is exact for the builder's own fifteen profiles, but a custom or future one should
// still land somewhere sensible, so fall through to the same keyword rule the artwork picker uses.
export function profileType(profile) {
    if (Object.hasOwn(PROFILE_TYPES, profile)) return {type: PROFILE_TYPES[profile], source: 'profile'};
    const query = words(profile || '');
    let best = null, score = 0;
    for (const [key, type] of Object.entries(PROFILE_TYPES)) {
        const value = words(key).filter(w => query.some(q => related(q, w))).length;
        if (value > score) { score = value; best = type; }
    }
    return best ? {type: best, source: 'guess'} : null;
}
// Rosters carry no artwork, so guess from the unit's own name, its profile and its traits.
// The result is a starting point the user retargets in each template's Artwork selector.
function pickArtwork(artwork, entityKind, unitType, text) {
    const candidates = artwork.filter(a => a.entity_kind === entityKind);
    const query = words(text);
    let best = null, score = -1;
    for (const art of candidates) {
        const title = words(art.title);
        let value = 2 * query.filter(w => title.some(t => related(w, t))).length;
        if (art.suggested_type === unitType) value += 3;
        if (art.mode === 'figures') value += 1; // figure collections take any formation
        if (value > score) { score = value; best = art; }
    }
    return best;
}
// A new template is seeded from an existing recipe where one is remembered, and otherwise from
// a name match over the catalog. Nothing here ever touches an existing template's visuals.
function makeTemplate(stack, ctx) {
    const hero = stack.kind === 'hero';
    const resolved = hero ? {type: null, source: 'custom'} : profileType(stack.profile);
    if (!hero && !resolved) ctx.report.unknown.add(stack.profile || 'unnamed');
    else if (!hero && resolved.source === 'guess') ctx.report.guessed.add(stack.profile);
    const unitType = hero ? null : (resolved?.type ?? 'warriors');
    const remembered = !hero && stack.profile ? ctx.project?.profile_defaults?.[stack.profile] : null;
    const base = remembered && ctx.artwork.some(a => a.id === remembered.artwork_id && a.entity_kind === 'unit')
        ? {entity_kind: 'unit', unit_type: remembered.unit_type ?? unitType, artwork_id: remembered.artwork_id,
           variant_id: remembered.variant_id, formation: structuredClone(remembered.formation)}
        : null;
    let template;
    if (base) template = {id: crypto.randomUUID(), key: stack.name, label: stack.name, ...base};
    else {
        const art = pickArtwork(ctx.artwork, hero ? 'hero' : 'unit', unitType, `${stack.name} ${stack.profile} ${stack.traits.join(' ')}`);
        if (!art) throw Error(`No ${hero ? 'leader' : 'unit'} artwork is available for “${stack.name}”.`);
        template = newTemplate(art, ctx.basing, {key: stack.name, unit_type: unitType});
    }
    template.key = uniqueKey(stack.name, ctx.taken);
    template.label = stack.name;
    template.profile = stack.profile || null;
    template.type_source = hero ? 'custom' : (resolved?.source ?? 'guess');
    return template;
}
function baseName(stack, index) {
    return (stack.qty > 1 ? `${stack.name} ${index + 1}` : stack.name).slice(0, 200);
}
// One base per copy, numbered so each sticker on the sheet is identifiable.
function makeBase(template, name) {
    return {id: crypto.randomUUID(), template_id: template.id, name, name_source: 'custom',
        seed: newSeed(), contingent_id: null};
}
function heroLevel(hero) {
    return Number(hero.status?.level) || 0;
}
// The game has each contingent led by a hero: prefer the army commander, then the senior hero.
function pickCommander(heroes) {
    return heroes.find(m => (m.hero.traits || []).includes('Army Commander'))
        || heroes.reduce((best, m) => heroLevel(m.hero) > heroLevel(best.hero) ? m : best, heroes[0]);
}
function assignCommander(group, heroes) {
    if (!heroes.length) return;
    const commander = pickCommander(heroes);
    group.commander_id = commander.unit.id;
    commander.unit.contingent_id = null; // membership follows the command, as elsewhere
}
// Contingent keys in first-seen order. null is the bucket for anything unassigned, and the sole
// group of an ungrouped force.
function contingentOrder(members) {
    const order = [];
    for (const m of members) if (m.key !== null && !order.includes(m.key)) order.push(m.key);
    if (!order.length || members.some(m => m.key === null)) order.push(null);
    return order;
}
function contingentName(key, only) {
    return key === null ? (only ? 'Contingent 1' : 'Unassigned') : `Contingent ${key}`.slice(0, 200);
}
function importNotes(report, members, order) {
    const notes = [];
    if (report.unknown.size) notes.push(`Unknown profile(s) ${[...report.unknown].join(', ')} were imported as Warriors; set the type on those templates.`);
    if (report.guessed.size) notes.push(`Profile(s) ${[...report.guessed].join(', ')} are not in the Midgard table; their type was guessed from the name.`);
    const loose = members.filter(m => m.key === null).length;
    if (loose && order.length > 1) notes.push(`${loose} unassigned hero(es)/unit(s) are in the “Unassigned” contingent.`);
    return notes;
}
// A first import of a force: one template per builder stack, one base per copy.
export function importForce(force, {artwork, basing, project = null}) {
    const ctx = {artwork, basing, project, taken: new Set(), report: {unknown: new Set(), guessed: new Set()}};
    const templates = [], members = [];
    for (const stack of stacks(force)) {
        const template = makeTemplate(stack, ctx);
        templates.push(template);
        for (let i = 0; i < stack.qty; i++)
            members.push({key: stack.slots[i], hero: stack.hero, unit: makeBase(template, baseName(stack, i))});
    }
    const order = contingentOrder(members), colors = [];
    const contingents = order.map(key => {
        const color = pickContingentColor(colors);
        colors.push(color);
        return {id: crypto.randomUUID(), name: contingentName(key, order.length === 1), color, commander_id: null};
    });
    const groups = new Map(order.map((key, i) => [key, contingents[i]]));
    for (const m of members) m.unit.contingent_id = groups.get(m.key).id;
    for (const [key, group] of groups) assignCommander(group, members.filter(m => m.hero && m.key === key));
    return {title: force.name, templates, units: members.map(m => m.unit), contingents,
        notes: importNotes(ctx.report, members, order),
        source: {app: 'midgard-forces', force_id: forceId(force), force_name: force.name}};
}
// Builder stack names are the match key, forgiving case and stray whitespace but nothing more:
// a genuine rename looks like a delete plus an add, and is offered a re-point instead of a guess.
function matchTemplate(templates, matched, name) {
    const free = templates.filter(t => !matched.has(t.id));
    const norm = s => s.trim().toLowerCase().replace(/\s+/g, ' ');
    return free.find(t => t.key === name)
        || free.find(t => t.key.toLowerCase() === name.toLowerCase())
        || free.find(t => norm(t.key) === norm(name))
        || free.find(t => norm(t.label) === norm(name))
        || null;
}
// Drop surplus bases from the end, sparing contingent commanders until nothing else is left.
function chooseDrops(bases, count, isCommander) {
    const drops = [];
    for (let i = bases.length - 1; i >= 0 && drops.length < count; i--) if (!isCommander(bases[i])) drops.push(bases[i]);
    for (let i = bases.length - 1; i >= 0 && drops.length < count; i--) if (isCommander(bases[i])) drops.push(bases[i]);
    return drops;
}
// Re-import of a force already in this project. Artwork and formation are never touched: only
// the roster — base counts, names, contingents — follows the builder.
export function mergeForce(p, force, {artwork, basing}) {
    const templates = structuredClone(p.templates);
    const ctx = {artwork, basing, project: p, taken: new Set(templates.map(t => t.key)),
        report: {unknown: new Set(), guessed: new Set()}};
    const existing = new Map();
    for (const u of p.units) {
        if (!existing.has(u.template_id)) existing.set(u.template_id, []);
        existing.get(u.template_id).push(structuredClone(u));
    }
    const commanderIds = new Set(p.contingents.map(g => g.commander_id).filter(Boolean));
    const names = new Set(p.units.map(u => u.name));
    const changes = {added: [], removed: [], orphaned: [], created: [], contingentsAdded: [], contingentsRemoved: []};
    const members = [], matched = new Set();
    for (const stack of stacks(force)) {
        let template = matchTemplate(templates, matched, stack.name);
        if (!template) {
            template = makeTemplate(stack, ctx);
            templates.push(template);
            changes.created.push(template.label);
        }
        matched.add(template.id);
        const bases = existing.get(template.id) || [];
        let survivors = bases;
        if (bases.length > stack.qty) {
            const drops = chooseDrops(bases, bases.length - stack.qty, u => commanderIds.has(u.id));
            const dropped = new Set(drops.map(u => u.id));
            survivors = bases.filter(u => !dropped.has(u.id));
            changes.removed.push({template: template.label, names: drops.map(u => u.name)});
        }
        for (let i = 0; i < survivors.length; i++) members.push({key: stack.slots[i], hero: stack.hero, unit: survivors[i]});
        for (let i = survivors.length; i < stack.qty; i++) {
            let name = baseName(stack, i);
            for (let n = stack.qty; names.has(name); n++) name = `${stack.name} ${n + 1}`.slice(0, 200);
            names.add(name);
            members.push({key: stack.slots[i], hero: stack.hero, unit: makeBase(template, name)});
        }
        if (stack.qty > survivors.length) changes.added.push({template: template.label, count: stack.qty - survivors.length});
    }
    // A template whose stack disappeared keeps its recipe — a recipe can outlive its bases —
    // but loses the bases the builder no longer lists.
    for (const t of templates) {
        const bases = existing.get(t.id) || [];
        if (!matched.has(t.id) && bases.length) changes.orphaned.push({template: t.label, names: bases.map(u => u.name)});
    }
    const order = contingentOrder(members), colors = [], contingents = [];
    for (const key of order) {
        const name = contingentName(key, order.length === 1);
        const previous = p.contingents.find(g => g.name === name);
        const color = previous && !colors.includes(previous.color) ? previous.color : pickContingentColor(colors);
        colors.push(color);
        contingents.push({id: previous?.id ?? crypto.randomUUID(), name, color, commander_id: null});
        if (!previous) changes.contingentsAdded.push(name);
    }
    for (const g of p.contingents) if (!contingents.some(n => n.id === g.id)) changes.contingentsRemoved.push(g.name);
    const groups = new Map(order.map((key, i) => [key, contingents[i]]));
    for (const m of members) m.unit.contingent_id = groups.get(m.key).id;
    for (const [key, group] of groups) {
        const heroes = members.filter(m => m.hero && m.key === key);
        const previous = p.contingents.find(g => g.id === group.id)?.commander_id;
        const stayed = heroes.find(m => m.unit.id === previous);
        if (stayed) { group.commander_id = stayed.unit.id; stayed.unit.contingent_id = null; }
        else assignCommander(group, heroes);
    }
    // The builder owns the force name only until the user renames the project here.
    const renamed = p.title !== p.source?.force_name;
    return {title: renamed ? p.title : force.name, templates, units: members.map(m => m.unit), contingents,
        notes: importNotes(ctx.report, members, order), changes,
        source: {app: 'midgard-forces', force_id: forceId(force), force_name: force.name}};
}
export function removesAnything(changes) {
    return changes.removed.length > 0 || changes.orphaned.length > 0 || changes.contingentsRemoved.length > 0;
}
// One summary of everything the merge will do, confirmed in a single step before anything goes.
export function describeMerge(changes) {
    const lines = [];
    for (const {template, count} of changes.added) lines.push(`+ ${count} base(s) added to ${template}`);
    for (const {template, names} of changes.removed) lines.push(`− ${names.length} base(s) removed from ${template}: ${names.join(', ')}`);
    for (const label of changes.created) lines.push(`+ new template ${label}`);
    for (const {template, names} of changes.orphaned) lines.push(`− ${template} is no longer in the builder; its ${names.length} base(s) will be dropped and the template kept`);
    for (const name of changes.contingentsAdded) lines.push(`+ contingent ${name}`);
    for (const name of changes.contingentsRemoved) lines.push(`− contingent ${name}`);
    return lines;
}
// An unknown profile stays recoverable: once the table learns it, a type this app only guessed
// is corrected on load. A type the user chose is never touched.
export function repairProfiles(p) {
    const repaired = [];
    for (const t of p.templates) {
        if (t.type_source !== 'guess' || !t.profile || !Object.hasOwn(PROFILE_TYPES, t.profile)) continue;
        t.unit_type = PROFILE_TYPES[t.profile];
        t.type_source = 'profile';
        repaired.push(t.label);
    }
    return repaired;
}
