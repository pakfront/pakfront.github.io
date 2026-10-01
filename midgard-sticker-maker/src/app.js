import {TYPES, CATEGORIES, TERRAINS, contingentTag, emptyProject, defaultTemplates, dimensions, factionFigureArt, hasDefaultTemplate, formationForArt, figureCount, newSeed, newTemplate, pickContingentColor, uniqueKey, validateProject} from './model.js';
import {readForces, importForce, mergeForce, describeMerge, removesAnything, repairProfiles, forceId, baseCount} from './forces.js';
import {previewProject, exportProject, renderUnitPreview} from './render.js';
import {saveLocal, loadLocal, importImage} from './storage.js';
const $ = id => document.getElementById(id);
let catalog, builtinArtwork, setup, timer, saveTimer, colorTimer, revision = 0, saveVersion = 0, cancelExport = false,
    pages = [],
    pageIndex = 0,
    exporting = false,
    previewCache = new Map(),
    expandedUnits = new Set(),
    expandedTemplates = new Set(),
    expandedContingents = new Set();
// A template card illustrates the recipe, not any one base, so its preview keeps a fixed roll.
const TEMPLATE_PREVIEW_SEED = 2468;
// CSS millimetres assume 96 dpi, which few screens have, so actual-size previews use a
// per-browser calibration instead. Both are display conveniences, never part of the setup.
const CSS_PX_PER_MM = 96 / 25.4;
const stored = key => { try { return localStorage.getItem(key); } catch { return null; } };
const store = (key, value) => { try { localStorage.setItem(key, value); } catch { /* preference only */ } };
let actualSize = stored('midgard-actual-size') === '1',
    pxPerMm = Math.min(10, Math.max(2, Number(stored('midgard-px-per-mm')) || CSS_PX_PER_MM));
// Artwork is raw material, not a force-building step: the catalog is a picker opened either to
// start a template or to retarget one, and it closes as soon as a collection is chosen.
let picking = {kind: 'create'};

function node(tag, text, className) {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (className) n.className = className;
    return n;
}

function button(text, action) {
    const b = node('button', text);
    b.type = 'button';
    b.addEventListener('click', action);
    return b;
}

function option(value, text) {
    const n = node('option', text);
    n.value = value;
    return n;
}

function textCell(text) {
    const d = node('div', text, 'cell-text');
    d.title = text;
    return d;
}

function field(text, input, className) {
    input.setAttribute('aria-label', text);
    const label = node('label', text, className);
    label.append(input);
    return label;
}

function message(text) {
    $('message').textContent = text;
}

// Artwork, category and formation live on the template; only the name, seed and contingent
// are the base's own. Everything below that reads a "visual" reads it off the template.
function templateOf(u) {
    return setup.templates.find(t => t.id === u.template_id);
}

function artFor(t) {
    return catalog.artwork.find(a => a.id === t?.artwork_id);
}

function factionName(id) {
    return catalog.factions.find(f => f.id === id)?.title || id;
}

// Era lives on the faction, not on each artwork: no faction spans two settings, so
// stating it 6 times beats repeating it across 44 collections.
function factionEra(id) {
    return catalog.factions.find(f => f.id === id)?.era_id || '';
}

// Rebuilt rather than filtered in place: a chosen era should offer only its own factions,
// and under "All eras" the optgroups still keep the two settings apart. A selection the
// new list no longer contains falls back to "All factions" on its own.
function syncFactionOptions() {
    const select = $('faction'), chosen = select.value, era = $('era').value;
    select.replaceChildren(option('', 'All factions'));
    for (const e of [...catalog.eras, {id: null, title: 'Imported figures'}]) {
        if (era && e.id !== era) continue;
        const factions = catalog.factions.filter(f => (f.era_id || null) === e.id);
        if (!factions.length) continue;
        const group = node('optgroup');
        group.label = e.title;
        for (const f of factions) group.append(option(f.id, f.title));
        select.append(group);
    }
    select.value = chosen;
}

function typeName(t) {
    return t.entity_kind === 'hero' ? 'Leader' : catalog.types[t.unit_type].label;
}

function sizeFor(t) {
    return dimensions(t, setup.basing);
}

function defaultName(u) {
    const used = new Set(setup.units.filter(x => x.id !== u.id).map(x => x.name));
    const label = typeName(templateOf(u));
    let i = 1;
    while (used.has(`${label} ${i}`)) i++;
    return `${label} ${i}`;
}

function thumb(art, variant) {
    return catalog.artwork.find(a => a.id === art)?.variants.find(v => v.id === variant)?.path || '';
}

function visualsOf(t) {
    return {artwork_id: t.artwork_id, variant_id: t.variant_id, entity_kind: t.entity_kind, unit_type: t.unit_type, formation: t.formation};
}

// Adding the same artwork again lands on the recipe already in the force, so the catalog's
// quantity field adds N bases to one template instead of N unrelated units.
function templateForArt(art) {
    const existing = setup.templates.find(t => t.artwork_id === art.id && t.key === art.title);
    if (existing) return existing;
    const template = newTemplate(art, setup.basing);
    template.key = uniqueKey(art.title, new Set(setup.templates.map(t => t.key)));
    template.label = art.title;
    setup.templates.push(template);
    return template;
}

function newUnit(art) {
    const template = templateForArt(art);
    const u = {
        id: crypto.randomUUID(),
        template_id: template.id,
        name: '',
        name_source: 'default',
        seed: newSeed(),
        contingent_id: $('add-contingent').value
    };
    u.name = defaultName(u);
    return u;
}

// The status must not keep claiming a save that a later edit has already superseded, so it
// says so while one is pending and a write that finishes out of order stays quiet.
function autosave() {
    clearTimeout(saveTimer);
    const version = ++saveVersion;
    $('save-status').textContent = 'Saving…';
    saveTimer = setTimeout(async () => {
        try {
            await saveLocal(validateProject(setup));
            if (version === saveVersion) $('save-status').textContent = 'Saved in this browser';
        } catch (error) {
            if (version === saveVersion) $('save-status').textContent = `Not autosaved: ${error.message} Use Save setup for a backup.`;
        }
    }, 450);
}
function changed() {
    autosave();
    revision++;
    clearTimeout(timer);
    pages.forEach(URL.revokeObjectURL);
    pages = [];
    $('preview-controls').hidden = true;
    $('preview').replaceChildren(node('p', setup.units.length ? 'Updating preview…' : 'Your print sheets will appear here.'));
    $('preview-status').textContent = setup.units.length ? 'Updating preview…' : 'Add units to preview your sheets.';
    $('warnings').replaceChildren();
    $('pdf').disabled = $('png').disabled = true;
    updateUnitPreviews();
    if (setup.units.length) timer = setTimeout(preview, 350);
}

function renderCatalog() {
    // Retargeting cannot cross the leader/unit divide, since that decides the base geometry.
    const target = picking.kind === 'retarget' ? setup.templates.find(t => t.id === picking.templateId) : null;
    const matches = catalog.artwork.filter(a => (!target || a.entity_kind === target.entity_kind) && (!$('art-mode').value || a.mode === $('art-mode').value) && (!$('era').value || factionEra(a.faction_id) === $('era').value) && (!$('faction').value || a.faction_id === $('faction').value) && (!$('type-filter').value || (a.entity_kind === 'hero' ? 'hero' : a.suggested_type) === $('type-filter').value) && `${a.title} ${factionName(a.faction_id)}`.toLowerCase().includes($('search').value.toLowerCase()));
    $('art-count').textContent = `${matches.length} ${matches.length === 1 ? 'collection' : 'collections'}`;
    $('artwork').replaceChildren();
    // Composing a preview per collection is real work, so only do it while the picker is open.
    const open = $('artwork-picker').open;
    let previewBase = null;
    for (const art of matches) {
        const card = node('article', undefined, 'art-card');
        const img = node('img');
        img.src = thumb(art.id, art.variants[0].id);
        img.alt = art.title;
        img.loading = 'lazy';
        if (art.mode === 'figures' && open) {
            // A throwaway template and base, never added to the force: the catalog only
            // illustrates what the artwork looks like arranged on a base.
            const template = newTemplate(art, setup.basing);
            const sample = {id: template.id, template_id: template.id, name: art.title, name_source: 'custom', seed: TEMPLATE_PREVIEW_SEED, contingent_id: null};
            // Catalog examples have no unit labels/contingent markings. Freeze a snapshot so a
            // setting the user changes mid-render can't leak into a preview already in flight.
            previewBase ??= structuredClone({...setup, templates: [], units: [], contingents: [], print_settings: {...setup.print_settings, labels: false}});
            paintUnitPreview([img], {...previewBase, templates: [template], units: [sample]}, sample);
        }
        const content = node('div', undefined, 'art-content');
        content.append(node('h3', art.title), node('p', factionName(art.faction_id)), node('p', art.mode === 'figures' ? 'Individual figures · editable formation' : 'Complete unit illustration', 'hint'));
        // The suggested type is what the type filter matches on, so it earns its place; the
        // base size it would imply does not, being frontage/ratio and one click from changing.
        const sample = {entity_kind: art.entity_kind, unit_type: art.suggested_type};
        content.append(node('p', `${typeName(sample)} · ${art.variants.length} ${art.mode === 'figures' ? 'pose(s)' : 'variant(s)'}`));
        const row = node('div', undefined, 'add-row');
        row.append(button('Use this artwork', () => {
            $('artwork-picker').close();
            if (target) retargetTemplate(target, art); else createTemplate(art);
        }));
        content.append(row);
        card.append(img, content);
        $('artwork').append(card);
    }
    if (!matches.length) $('artwork').append(node('p', 'No artwork matches these filters.', 'empty'));
}

function openPicker(mode) {
    picking = mode;
    const target = mode.kind === 'retarget' ? setup.templates.find(t => t.id === mode.templateId) : null;
    $('artwork-picker-heading').textContent = target ? `Change artwork · ${target.label}` : 'Choose artwork for a new template';
    $('artwork-picker-hint').textContent = target
        ? `Only ${target.entity_kind === 'hero' ? 'leader' : 'unit'} collections are offered, since that decides the base size. The formation stays as you set it unless the new artwork suggests its own.`
        : 'Pick the figures this template arranges. Its unit type, rows, columns and spacing are set on the template afterwards.';
    $('artwork-picker').showModal();
    renderCatalog(); // the previews are skipped while the dialog is closed, so draw them now
}

// "New template" always starts a fresh recipe, never reuses one: two Heavy Infantry entries on
// the same artwork are exactly the case templates exist to keep apart.
function createTemplate(art) {
    if (setup.templates.length >= 300) {
        message('A setup can contain up to 300 troop templates.');
        return;
    }
    if (setup.units.length >= 300) {
        message('A setup can contain up to 300 units.');
        return;
    }
    const template = newTemplate(art, setup.basing);
    template.key = uniqueKey(art.title, new Set(setup.templates.map(t => t.key)));
    template.label = art.title;
    setup.templates.push(template);
    const u = {id: crypto.randomUUID(), template_id: template.id, name: '', name_source: 'default',
        seed: newSeed(), contingent_id: $('add-contingent').value};
    u.name = defaultName(u);
    setup.units.push(u);
    expandedTemplates.add(template.id);
    message(`${art.title}: one template with one base. Set its formation, then add more bases.`);
    renderUnits();
    changed();
    document.querySelector(`.template-card[data-template-id="${template.id}"]`)?.scrollIntoView({behavior: 'smooth', block: 'nearest'});
}

// A faction's figure collections as a batch of ready-made recipes. They load without bases:
// the usual next step is importing a force and pointing each stack at one through
// "This recipe is now", and a default nobody uses never prints.
function figureFactions(era) {
    return catalog.factions.filter(f => (!era || f.era_id === era) && factionFigureArt(catalog, f.id).length);
}

function syncFactionTemplateFactions() {
    const select = $('faction-templates-faction'), chosen = select.value;
    select.replaceChildren(...figureFactions($('faction-templates-era').value).map(f => option(f.id, f.title)));
    if ([...select.options].some(o => o.value === chosen)) select.value = chosen;
    renderFactionTemplateChoices();
}

function renderFactionTemplateChoices() {
    const choices = $('faction-template-choices');
    choices.replaceChildren();
    for (const art of factionFigureArt(catalog, $('faction-templates-faction').value)) {
        const loaded = hasDefaultTemplate(setup, art), box = node('input');
        box.type = 'checkbox';
        box.value = art.id;
        box.checked = !loaded;
        box.disabled = loaded;
        const sample = {entity_kind: art.entity_kind, unit_type: art.entity_kind === 'hero' ? null : art.suggested_type};
        const label = node('label');
        label.append(box, node('span', art.title),
            node('span', loaded ? 'already loaded' : `${typeName(sample)} · ${sizeFor(sample).join(' × ')} mm`, 'template-meta'));
        choices.append(label);
    }
    $('faction-templates-load').disabled = !choices.querySelector('input:checked');
}

function openFactionTemplates() {
    // Default to the faction this setup already draws most of its figures from.
    const counts = new Map();
    for (const t of setup.templates) {
        const art = artFor(t);
        if (art?.mode === 'figures' && art.faction_id) counts.set(art.faction_id, (counts.get(art.faction_id) || 0) + 1);
    }
    const usual = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
    const factions = figureFactions(''), faction = factions.find(f => f.id === usual) || factions[0];
    $('faction-templates-era').replaceChildren(option('', 'All eras'),
        ...catalog.eras.filter(e => figureFactions(e.id).length).map(e => option(e.id, e.title)));
    $('faction-templates-era').value = faction?.era_id || '';
    syncFactionTemplateFactions();
    if (faction) $('faction-templates-faction').value = faction.id;
    $('faction-templates-bases').checked = false;
    renderFactionTemplateChoices();
    $('faction-templates').showModal();
}

function loadFactionTemplates() {
    const factionId = $('faction-templates-faction').value, withBases = $('faction-templates-bases').checked;
    const artIds = [...$('faction-template-choices').querySelectorAll('input:checked')].map(box => box.value);
    let {templates} = defaultTemplates(setup, catalog, factionId, artIds);
    const room = Math.min(300 - setup.templates.length, withBases ? 300 - setup.units.length : Infinity);
    const dropped = Math.max(0, templates.length - Math.max(0, room));
    templates = templates.slice(0, Math.max(0, room));
    $('faction-templates').close();
    if (!templates.length) {
        message(dropped ? 'A setup can contain up to 300 troop templates and 300 units.' : `${factionName(factionId)}: every chosen template is already loaded.`);
        return;
    }
    setup.templates.push(...templates);
    if (withBases) for (const t of templates) {
        const u = {id: crypto.randomUUID(), template_id: t.id, name: '', name_source: 'default',
            seed: newSeed(), contingent_id: $('add-contingent').value};
        u.name = defaultName(u);
        setup.units.push(u);
    }
    const loaded = factionFigureArt(catalog, factionId).filter(art => hasDefaultTemplate(setup, art)).length - templates.length;
    message(`${factionName(factionId)}: ${templates.length} template(s) added${withBases ? ', one base each' : ' without bases'}`
        + (loaded ? `, ${loaded} already loaded` : '') + (dropped ? `, ${dropped} skipped at the 300 limit` : '') + '.');
    renderUnits();
    changed();
    document.querySelector(`.template-card[data-template-id="${templates[0].id}"]`)?.scrollIntoView({behavior: 'smooth', block: 'nearest'});
}

// A collection's suggested type and tuned formation seed a new template and nothing else:
// changing artwork on an existing one swaps the images and leaves the recipe alone, since
// holding that recipe is what the template is for.
function retargetTemplate(t, art) {
    t.artwork_id = art.id;
    t.variant_id = art.variants[0].id;
    message(`${t.label} now uses ${art.title}. Only the images changed — check the preview, since these figures may be a different size.`);
    renderUnits();
    changed();
}

// Commander membership is derived from the contingent, never copied into another unit.
function commandOf(unit) {
    return setup.contingents.find(group => group.commander_id === unit.id);
}

function contingentFor(unit) {
    return commandOf(unit) || setup.contingents.find(group => group.id === unit.contingent_id);
}

function addContingent(hero = null) {
    if (setup.contingents.length >= 300) {
        message('A setup can contain up to 300 contingents.');
        return;
    }
    let index = 1;
    while (setup.contingents.some(g => g.name === `Contingent ${index}`)) index++;
    if (hero) hero.contingent_id = null;
    const group = {
        id: crypto.randomUUID(),
        name: `Contingent ${index}`,
        color: pickContingentColor(setup.contingents.map(group => group.color)),
        commander_id: hero?.id || null
    };
    setup.contingents.push(group);
    renderUnits();
    $('add-contingent').value = group.id;
    changed();
}

function addBase(t) {
    if (setup.units.length >= 300) {
        message('A setup can contain up to 300 units.');
        return;
    }
    const u = {id: crypto.randomUUID(), template_id: t.id, name: '', name_source: 'default',
        seed: newSeed(), contingent_id: $('add-contingent').value};
    u.name = defaultName(u);
    setup.units.push(u);
    renderUnits();
    changed();
    return u;
}

// The quickest answer to "one more of those" is the recipe you are already looking at, so the
// summary — which stays visible when the card is collapsed — carries its preview as the button.
function addBaseButton(t, art) {
    const add = button(undefined, () => addBase(t));
    add.className = 'template-add';
    add.title = `Add a base to ${t.label}`;
    add.setAttribute('aria-label', `Add a base to ${t.label}`);
    if (art?.mode === 'figures') {
        const img = node('img', undefined, 'template-composition');
        img.dataset.templateId = t.id;
        img.alt = '';
        add.append(img);
    } else if (art) {
        const img = node('img');
        img.src = thumb(t.artwork_id, t.variant_id);
        img.alt = '';
        add.append(img);
    }
    add.append(node('span', '+', 'template-add-plus'));
    return add;
}

// The shared visual recipe behind every base that points at it. One card per template.
function templateCard(t) {
    const art = artFor(t), bases = setup.units.filter(u => u.template_id === t.id);
    const card = node('article', undefined, 'template-card');
    card.dataset.templateId = t.id;
    const expanded = expandedTemplates.has(t.id);
    const summary = node('div', undefined, 'template-summary');
    const toggle = button(expanded ? '▾' : '▸', () => {
        const next = !expandedTemplates.has(t.id);
        if (next) expandedTemplates.add(t.id); else expandedTemplates.delete(t.id);
        detail.hidden = !next;
        toggle.textContent = next ? '▾' : '▸';
        toggle.setAttribute('aria-expanded', String(next));
        if (next) updateUnitPreviews();
    });
    toggle.className = 'expand-toggle';
    toggle.setAttribute('aria-label', 'Toggle template details');
    toggle.setAttribute('aria-expanded', String(expanded));
    const label = node('input');
    label.className = 'name-input';
    label.value = t.label;
    label.maxLength = 200;
    label.setAttribute('aria-label', 'Template name');
    label.addEventListener('change', () => {
        t.label = label.value.trim() || t.label;
        label.value = t.label;
        renderUnits();
        changed();
    });
    summary.append(toggle, addBaseButton(t, art), label,
        node('span', `${typeName(t)} · ${sizeFor(t).join(' × ')} mm · ${bases.length} base(s)`, 'template-meta'));
    if (t.profile) summary.append(node('span', t.profile, 'template-profile'));
    card.append(summary);

    // Settings on the left, the preview on the right, so an edit and its result sit side by side.
    const detail = node('div', undefined, 'detail template-detail');
    detail.hidden = !expanded;
    const settings = node('div', undefined, 'template-settings'), look = node('div', undefined, 'template-look');
    if (!art) settings.append(node('p', `Missing artwork: ${t.artwork_id}`, 'hint'));
    if (art?.mode === 'figures') {
        const frame = node('div', undefined, 'composition-frame');
        const preview = node('img', undefined, 'template-composition');
        preview.dataset.templateId = t.id;
        preview.alt = `${t.label} formation`;
        if (actualSize) {
            const [w, h] = sizeFor(t);
            preview.classList.add('actual-size');
            preview.style.width = `${w * pxPerMm}px`;
            preview.style.height = `${h * pxPerMm}px`;
        }
        frame.append(preview);
        look.append(frame);
    } else if (art) {
        const preview = node('img', undefined, 'template-illustration');
        preview.src = thumb(t.artwork_id, t.variant_id);
        preview.alt = `${t.label} illustration`;
        look.append(preview);
    }
    const fields = node('div', undefined, 'unit-fields');
    if (t.entity_kind !== 'hero') {
        const types = node('select');
        for (const [id, type] of Object.entries(catalog.types)) types.append(option(id, type.label));
        types.value = t.unit_type;
        types.addEventListener('change', () => {
            t.unit_type = types.value;
            t.type_source = 'custom'; // a type the user chose is never repaired from the profile table
            for (const u of setup.units) if (u.template_id === t.id && u.name_source === 'default') u.name = defaultName(u);
            renderUnits();
            changed();
        });
        fields.append(field('Unit type', types));
    } else fields.append(node('p', 'Leader · half frontage, independent ratio'));
    // One way to choose artwork: the same picker that starts a template retargets one.
    const artBox = node('div', undefined, 'template-artwork');
    const artText = node('div', art ? `${factionName(art.faction_id)} · ${art.title}` : `Missing: ${t.artwork_id}`, 'cell-text');
    artText.title = artText.textContent;
    artBox.append(node('span', 'Artwork', 'field-label'), artText,
        button('Change artwork', () => openPicker({kind: 'retarget', templateId: t.id})));
    fields.append(artBox);
    const variants = node('select');
    for (const v of art?.variants || []) variants.append(option(v.id, `Variant ${v.id}`));
    if (!art?.variants.some(v => v.id === t.variant_id)) variants.prepend(option(t.variant_id, `Missing: ${t.variant_id}`));
    variants.value = t.variant_id;
    variants.addEventListener('change', () => {
        t.variant_id = variants.value;
        renderUnits();
        changed();
    });
    // Game data rather than looks: printed on the label strip when the Print tab asks for it.
    // Blank means none; anything outside the range is cleared rather than saved invalid.
    const stat = (key, label, max) => {
        const input = node('input');
        input.type = 'number';
        input.min = 1;
        input.max = max;
        input.step = 1;
        input.placeholder = 'None';
        input.value = t[key] ?? '';
        input.addEventListener('change', () => {
            const value = Number(input.value);
            t[key] = input.value !== '' && Number.isInteger(value) && value >= 1 && value <= max ? value : null;
            input.value = t[key] ?? '';
            changed();
        });
        fields.append(field(label, input));
    };
    stat('stamina', 'Stamina', 20);
    stat('armour', 'Armour', 9);
    if (art?.mode === 'figures') fields.append(node('p', `${art.variants.length} pose(s) mixed in this formation. Each base rolls its own poses and placement.`, 'hint'));
    else fields.append(field('Image variant', variants));
    settings.append(fields);
    if (art?.mode === 'figures') settings.append(formationControls(t));

    const actions = node('div', undefined, 'unit-actions');
    actions.append(button('Add a base', () => addBase(t)));
    if (art?.mode === 'figures' && bases.length) actions.append(button('Reshuffle all bases', () => {
        for (const u of setup.units) if (u.template_id === t.id) u.seed = newSeed();
        changed();
        message(`${t.label}: every base rolled new poses and placement.`);
    }));
    if (t.profile && t.entity_kind === 'unit') {
        const siblings = setup.templates.filter(x => x.id !== t.id && x.profile === t.profile && x.entity_kind === 'unit');
        // Applying a profile is an explicit, one-off action: a live profile→template binding
        // would force every Heavy Infantry entry in an army to look the same.
        const apply = button(`Apply to all ${t.profile} templates`, () => {
            for (const x of siblings) {
                x.unit_type = t.unit_type;
                x.type_source = t.type_source;
                x.artwork_id = t.artwork_id;
                x.variant_id = t.variant_id;
                x.formation = structuredClone(t.formation);
            }
            // Stats stay behind: they follow each stack's own options in the builder.
            setup.profile_defaults[t.profile] = {unit_type: t.unit_type, artwork_id: t.artwork_id, variant_id: t.variant_id,
                formation: structuredClone(t.formation)};
            renderUnits();
            changed();
            message(`${t.profile}: ${siblings.length} other template(s) updated and remembered for the next import. Every base keeps its own seed.`);
        });
        apply.title = 'Applied once, on request. Templates never follow their profile automatically.';
        actions.append(apply);
    }
    settings.append(actions);
    // A stack renamed in the builder arrives as a delete plus an add, so offer to move this
    // recipe onto the new template rather than guessing at the rename.
    if (!bases.length) {
        const others = setup.templates.filter(x => x.id !== t.id && x.entity_kind === t.entity_kind);
        if (others.length) {
            const repoint = node('select');
            repoint.append(option('', 'Keep as an unused recipe'));
            for (const x of others) repoint.append(option(x.id, x.label));
            repoint.addEventListener('change', () => {
                const target = setup.templates.find(x => x.id === repoint.value);
                if (!target) return;
                Object.assign(target, visualsOf(t), {formation: structuredClone(t.formation), type_source: t.type_source});
                setup.templates = setup.templates.filter(x => x.id !== t.id);
                expandedTemplates.delete(t.id);
                renderUnits();
                changed();
                message(`${t.label}’s artwork and formation now drive ${target.label}.`);
            });
            settings.append(field('This recipe is now', repoint));
        }
        const remove = button('Remove template', () => {
            setup.templates = setup.templates.filter(x => x.id !== t.id);
            expandedTemplates.delete(t.id);
            renderUnits();
            changed();
        });
        settings.append(remove);
    } else settings.append(node('p', `${bases.length} base(s) use this template. Remove them first to delete it.`, 'hint'));
    detail.append(settings, look);
    card.append(detail);
    return card;
}

// The Force tab's quick way to "one more of those": every template as an add button, with
// editing left to its card on the Templates tab.
function renderPalette() {
    $('add-contingent-field').hidden = !setup.templates.length;
    if (!setup.templates.length) {
        const empty = node('div', undefined, 'palette-empty');
        empty.append(node('p', 'Bases are built from troop templates, and this force has none yet.'),
            node('p', 'Import a force from the builder, or set up templates by hand.', 'hint'));
        const go = button('Set up templates', () => selectTab('templates'));
        go.className = 'primary';
        empty.append(go);
        $('palette').replaceChildren(empty);
        return;
    }
    $('palette').replaceChildren(...setup.templates.map(t => {
        const item = node('div', undefined, 'palette-item'), bases = setup.units.filter(u => u.template_id === t.id).length;
        const text = node('div', undefined, 'palette-text');
        const name = node('span', t.label, 'palette-name');
        name.title = t.label;
        text.append(name, node('span', `${bases} base${bases === 1 ? '' : 's'}`, 'palette-meta'));
        const edit = button('✎', () => editTemplate(t.id));
        edit.className = 'palette-edit';
        edit.title = `Edit template ${t.label}`;
        edit.setAttribute('aria-label', edit.title);
        item.append(addBaseButton(t, artFor(t)), text, edit);
        return item;
    }));
}

function editTemplate(id) {
    expandedTemplates.add(id);
    selectTab('templates');
    renderTemplates();
    updateUnitPreviews();
    const card = document.querySelector(`.template-card[data-template-id="${CSS.escape(id)}"]`);
    card?.scrollIntoView({block: 'start'});
    card?.querySelector('.name-input').focus({preventScroll: true});
}

function renderTemplates() {
    $('template-count').textContent = `${setup.templates.length} template${setup.templates.length === 1 ? '' : 's'}`;
    $('templates-tab-count').textContent = setup.templates.length;
    $('templates-tab-count').classList.toggle('needed', !setup.templates.length);
    renderPalette();
    $('sample-callout').hidden = setup.templates.length > 0;
    $('templates').replaceChildren();
    if (!setup.templates.length) {
        $('templates').append(node('p', 'No templates yet. Use New template to choose artwork, Load faction templates for a ready-made set, or import a force.', 'hint'));
        return;
    }
    for (const t of setup.templates) $('templates').append(templateCard(t));
}

function renderContingents() {
    const active = $('add-contingent').value;
    $('add-contingent').replaceChildren();
    for (const group of setup.contingents) $('add-contingent').append(option(group.id, group.name));
    $('add-contingent').value = setup.contingents.some(g => g.id === active) ? active : setup.contingents[0].id;
    $('contingents').replaceChildren();
    for (const group of setup.contingents) {
        const card = node('article', undefined, 'contingent-card');
        card.dataset.contingentId = group.id;
        const expanded = expandedContingents.has(group.id);
        const summary = node('div', undefined, 'contingent-summary');
        const toggle = button(expanded ? '▾' : '▸', () => {
            const next = !expandedContingents.has(group.id);
            if (next) expandedContingents.add(group.id); else expandedContingents.delete(group.id);
            detail.hidden = !next;
            toggle.textContent = next ? '▾' : '▸';
            toggle.setAttribute('aria-expanded', String(next));
        });
        toggle.className = 'expand-toggle';
        toggle.setAttribute('aria-label', 'Toggle contingent details');
        toggle.setAttribute('aria-expanded', String(expanded));
        const name = node('input');
        name.className = 'name-input';
        name.value = group.name;
        name.maxLength = 200;
        name.setAttribute('aria-label', 'Contingent name');
        name.addEventListener('change', () => {
            group.name = name.value.trim() || group.name;
            renderUnits();
            changed();
        });
        const commanderHero = setup.units.find(u => u.id === group.commander_id);
        const leaderLabel = node('span', commanderHero ? commanderHero.name : 'No leader', 'commander-label');
        const color = node('input');
        color.type = 'color';
        color.value = group.color;
        color.setAttribute('aria-label', 'Contingent color');
        color.addEventListener('change', () => {
            if (setup.contingents.some(g => g.id !== group.id && g.color.toLowerCase() === color.value.toLowerCase())) {
                message('Choose a different color: another contingent already uses this one.');
                color.value = group.color;
                return;
            }
            group.color = color.value;
            message('');
            renderUnits();
            changed();
        });
        summary.append(toggle, name, leaderLabel, color);
        // The tag this contingent's labels carry, so the printed mark can be matched back here.
        if (setup.contingents.length > 1) {
            const tag = node('span', contingentTag(setup, group), 'contingent-tag');
            tag.title = 'Printed at the start of this contingent’s labels';
            summary.insertBefore(tag, leaderLabel);
        }
        card.append(summary);

        const detail = node('div', undefined, 'detail');
        detail.hidden = !expanded;
        const fields = node('div', undefined, 'settings-grid');
        const commander = node('select');
        commander.append(option('', 'Choose a leader…'));
        for (const hero of setup.units.filter(u => templateOf(u)?.entity_kind === 'hero' && (!commandOf(u) || commandOf(u).id === group.id)))
            commander.append(option(hero.id, hero.name));
        commander.value = group.commander_id || '';
        commander.addEventListener('change', () => {
            const previous = setup.units.find(u => u.id === group.commander_id);
            if (previous) previous.contingent_id = group.id; // stays a regular member of this contingent
            group.commander_id = commander.value || null;
            const hero = setup.units.find(u => u.id === group.commander_id);
            if (hero) hero.contingent_id = null;
            renderUnits();
            changed();
        });
        fields.append(field('Commanding leader', commander));
        detail.append(fields);
        if (!group.commander_id) detail.append(node('p', 'Add a leader to your force, then choose them as commander.', 'hint'));
        const remove = button('Remove contingent', () => {
            const fallback = setup.contingents.find(g => g.id !== group.id);
            if (!fallback) return; // at least one contingent must always remain
            setup.contingents = setup.contingents.filter(g => g.id !== group.id);
            for (const u of setup.units)
                if (u.contingent_id === group.id || u.id === group.commander_id) u.contingent_id = fallback.id;
            expandedContingents.delete(group.id);
            renderUnits();
            changed();
        });
        remove.disabled = setup.contingents.length <= 1;
        if (remove.disabled) remove.title = 'At least one contingent is required.';
        detail.append(remove);
        card.append(detail);

        // Units always show, whether or not the contingent's own settings are expanded.
        const groupUnits = setup.units.filter(u => contingentFor(u)?.id === group.id);
        card.append(node('h3', `Units · ${groupUnits.length}`));
        card.append(groupUnits.length ? rosterTable(groupUnits) : node('p', 'No units in this contingent yet.', 'hint'));
        $('contingents').append(card);
    }
}

// A self-contained mini spreadsheet: reused for the ungrouped roster and for each
// contingent's own roster inside its card, so every group gets its own "spreadsheet".
function rosterTable(units) {
    const wrap = node('div', undefined, 'roster-wrap');
    const roster = node('div', undefined, 'roster');
    const head = node('div', undefined, 'roster-head');
    for (const label of ['', '', 'Name', 'Type', 'Template', 'Size (mm)', 'Print', '']) head.append(node('span', label));
    roster.append(head);
    for (const u of units) roster.append(unitRow(u));
    wrap.append(roster);
    return wrap;
}

// One printed base. Everything visual is read-only here and lives on its template; the row
// owns the name, the contingent, which template it follows, and its own roll.
function unitRow(u) {
    const t = templateOf(u), art = artFor(t), row = node('div', undefined, 'unit');
    row.dataset.unitId = u.id;
    const expanded = expandedUnits.has(u.id);

    const toggle = button(expanded ? '▾' : '▸', () => {
        const next = !expandedUnits.has(u.id);
        if (next) expandedUnits.add(u.id); else expandedUnits.delete(u.id);
        detail.hidden = !next;
        toggle.textContent = next ? '▾' : '▸';
        toggle.setAttribute('aria-expanded', String(next));
    });
    toggle.className = 'expand-toggle';
    toggle.setAttribute('aria-label', 'Toggle unit details');
    toggle.setAttribute('aria-expanded', String(expanded));
    row.append(toggle);

    const thumbCell = node('div', undefined, 'roster-thumb-cell');
    if (art && art.variants.some(v => v.id === t.variant_id)) {
        const img = node('img', undefined, 'roster-thumb');
        img.src = thumb(t.artwork_id, t.variant_id);
        img.alt = '';
        thumbCell.append(img);
    }
    row.append(thumbCell);

    const name = node('input');
    name.type = 'text';
    name.className = 'name-input';
    name.value = u.name;
    name.maxLength = 200;
    name.setAttribute('aria-label', 'Unit name');
    name.addEventListener('change', () => {
        u.name = name.value.trim();
        u.name_source = u.name ? 'custom' : 'default';
        if (!u.name) u.name = defaultName(u);
        name.value = u.name;
        renderUnits();
        changed();
    });
    row.append(name);

    row.append(textCell(typeName(t)));
    const templateCell = textCell(t.label);
    templateCell.title = art ? `${t.label} · ${art.title}` : `${t.label} · missing artwork ${t.artwork_id}`;
    row.append(templateCell);
    row.append(node('div', `${sizeFor(t).join(' × ')} mm`, 'dimensions cell-text'));
    // Leaving a base out of the print run is how one damaged sticker gets reprinted alone.
    const printCell = node('div', undefined, 'roster-print');
    const print = node('input');
    print.type = 'checkbox';
    print.checked = u.print !== false;
    print.setAttribute('aria-label', `Print ${u.name}`);
    print.addEventListener('change', () => {
        u.print = print.checked;
        changed();
    });
    printCell.append(print);
    row.append(printCell);

    const actions = node('div', undefined, 'roster-actions');
    const duplicate = button('⧉', () => {
        if (setup.units.length >= 300) {
            message('A setup can contain up to 300 units.');
            return;
        }
        // A copy follows the same recipe but rolls its own poses and placement.
        const copy = {...structuredClone(u), id: crypto.randomUUID(), seed: newSeed()};
        if (copy.name_source === 'default') copy.name = defaultName(copy);
        else {
            const base = `${u.name.slice(0, 185)} copy`;
            copy.name = base;
            let n = 2;
            while (setup.units.some(x => x.name === copy.name)) copy.name = `${base} ${n++}`;
        }
        setup.units.push(copy);
        renderUnits();
        changed();
    });
    duplicate.setAttribute('aria-label', 'Duplicate unit');
    duplicate.title = 'Duplicate';
    const remove = button('✕', () => {
        for (const group of setup.contingents)
            if (group.commander_id === u.id) group.commander_id = null;
        setup.units = setup.units.filter(x => x.id !== u.id);
        expandedUnits.delete(u.id);
        renderUnits();
        changed();
    });
    remove.setAttribute('aria-label', 'Remove unit');
    remove.title = 'Remove';
    actions.append(duplicate, remove);
    row.append(actions);

    const detail = node('div', undefined, 'detail');
    detail.hidden = !expanded;
    if (!art) detail.append(node('p', `Missing artwork: ${t.artwork_id}`, 'hint'));
    if (art?.mode === 'figures') {
        const preview = node('img', undefined, 'unit-composition');
        preview.dataset.unitId = u.id;
        preview.alt = `${u.name} formation`;
        detail.append(preview);
    }
    const fields = node('div', undefined, 'unit-fields');
    const template = node('select');
    for (const other of setup.templates.filter(x => x.entity_kind === t.entity_kind)) template.append(option(other.id, other.label));
    template.value = t.id;
    template.addEventListener('change', () => {
        u.template_id = template.value;
        if (u.name_source === 'default') u.name = defaultName(u);
        renderUnits();
        changed();
    });
    fields.append(field('Template', template));
    const group = contingentFor(u);
    const contingent = node('select');
    for (const g of setup.contingents) contingent.append(option(g.id, g.name));
    contingent.value = group?.id || '';
    contingent.disabled = Boolean(commandOf(u));
    contingent.addEventListener('change', () => {
        u.contingent_id = contingent.value;
        renderUnits();
        changed();
    });
    fields.append(field(commandOf(u) ? 'Contingent (commander)' : 'Contingent', contingent));
    // A long name can print shorter on the sticker without renaming the base everywhere else.
    const printName = node('input');
    printName.type = 'text';
    printName.maxLength = 200;
    printName.placeholder = u.name;
    printName.value = u.print_name ?? '';
    printName.addEventListener('change', () => {
        u.print_name = printName.value.trim() || null;
        printName.value = u.print_name ?? '';
        changed();
    });
    fields.append(field('Printed label', printName));
    detail.append(fields);
    detail.append(node('p', 'Artwork, type and formation come from the template above. Edit them there to change every base at once.', 'hint'));
    const detailActions = node('div', undefined, 'unit-actions');
    detailActions.append(button('Reset name', () => {
        u.name_source = 'default';
        u.name = defaultName(u);
        renderUnits();
        changed();
    }));
    if (art?.mode === 'figures') detailActions.append(button('Reshuffle this base', () => {
        u.seed = newSeed();
        changed();
    }));
    if (t.entity_kind === 'hero' && !commandOf(u)) detailActions.append(button('Lead new contingent', () => addContingent(u)));
    detail.append(detailActions);
    row.append(detail);
    return row;
}

function renderUnits() {
    // Every unit belongs to a contingent, so the roster renders entirely inside
    // renderContingents(), each contingent holding its own spreadsheet.
    renderTemplates();
    renderContingents();
    $('unit-count').textContent = `${setup.units.length} unit${setup.units.length === 1 ? '' : 's'}`;
}

function showPage() {
    $('page-number').textContent = `Page ${pageIndex+1} of ${pages.length}`;
    $('previous').disabled = pageIndex === 0;
    $('next').disabled = pageIndex === pages.length - 1;
    const img = node('img');
    img.alt = `Print preview, page ${pageIndex+1}`;
    img.src = pages[pageIndex];
    img.addEventListener('error', () => {
        $('preview-status').textContent = 'Preview expired or could not load. Use Refresh preview.';
    });
    $('preview').classList.remove('empty');
    $('preview').replaceChildren(img);
}
async function preview() {
    const version = revision;
    if (!setup.units.length) return;
    try {
        const data = await previewProject(setup, {artwork: catalog.artwork.slice()}, () => version !== revision);
        if (version !== revision) { data.pages.forEach(URL.revokeObjectURL); return; }
        pages.forEach(URL.revokeObjectURL);
        pages = data.pages;
        pageIndex = 0;
        $('preview-controls').hidden = !pages.length;
        const selection = data.sticker_count === data.unit_count ? `${data.sticker_count} stickers` : `${data.sticker_count} of ${data.unit_count} bases selected`;
        const {paper, paper_width_mm: w, paper_height_mm: h} = setup.print_settings;
        const paperName = paper === 'a4' ? 'A4' : paper === 'custom' ? `${w} × ${h} mm` : 'Letter';
        $('preview-status').textContent = `${selection} on ${pages.length} ${paperName} page(s)`;
        $('select-all-bases').hidden = data.sticker_count === data.unit_count;
        $('warnings').replaceChildren(...data.warnings.map(w => node('li', w)));
        if (pages.length) showPage();
        else {
            $('preview').classList.add('empty');
            $('preview').replaceChildren(node('p', 'No bases are selected. Tick Print on the roster, or select all.'));
        }
        $('pdf').disabled = $('png').disabled = !pages.length || exporting;
    } catch (error) {
        if (version !== revision) return;
        $('preview-status').textContent = error.message;
        $('preview').replaceChildren(node('p', 'Adjust the setup to generate a preview.'));
    }
}

// Rosters exported by the Midgard force builder carry no artwork or basing, so an import keeps
// this project's basing, terrain, figures and print settings. A first import of a force replaces
// the roster; re-importing the same force merges into it, leaving every visual decision alone.
function applyForce(force) {
    try {
        const reimport = setup.source?.app === 'midgard-forces' && setup.source.force_id === forceId(force);
        const result = reimport
            ? mergeForce(setup, force, {artwork: catalog.artwork, basing: setup.basing})
            : importForce(force, {artwork: catalog.artwork, basing: setup.basing, project: setup});
        const lines = reimport ? describeMerge(result.changes) : [];
        if (reimport) {
            if (removesAnything(result.changes) && !confirm(`Re-import “${force.name}”?\n\n${lines.join('\n')}\n\nArtwork, formations and per-base seeds stay as you set them.`)) return;
        } else if (setup.units.length && !confirm(`Replace the current force with “${force.name}”? Basing, terrain, imported figures and print settings stay.`)) return;
        const {title, units, contingents, notes, source} = result;
        let {templates} = result;
        // A first import replaces the force, but a recipe with no bases — a loaded faction
        // default — is waiting to be pointed at one of the new stacks through "This recipe is now".
        if (!reimport) {
            const used = new Set(setup.units.map(u => u.template_id)), taken = new Set(templates.map(t => t.key));
            templates = [...templates, ...setup.templates.filter(t => !used.has(t.id)).map(t => ({...t, key: uniqueKey(t.key, taken)}))];
        }
        setup = validateProject({...setup, title, templates, units, contingents, source});
        expandedUnits.clear();
        expandedTemplates.clear();
        expandedContingents.clear();
        previewCache.clear();
        syncSettings();
        renderUnits();
        changed();
        message([reimport
            ? `Re-imported “${title}”: ${lines.length ? lines.join('; ') : 'no roster changes'}. Artwork and formations are untouched.`
            : `Imported “${title}”: ${units.length} base(s) in ${result.templates.length} template(s) and ${contingents.length} contingent(s). Artwork is a name match — set it per template.`,
            ...notes].join(' '));
    } catch (error) {
        message(`Could not import that force: ${error.message}`);
    }
}

// The builder exports its whole library at once, so let the user pick a force out of it.
function chooseForce(forces) {
    $('force-choices').replaceChildren(...forces.map(force => {
        const choice = button(undefined, () => {
            $('force-picker').close();
            applyForce(force);
        });
        choice.className = 'force-choice';
        const reimport = setup.source?.app === 'midgard-forces' && setup.source.force_id === forceId(force);
        choice.append(node('strong', force.name), node('span', `${force.heroes.length} leader(s) · ${baseCount(force)} base(s)${reimport ? ' · re-import, keeps your artwork' : ''}`, 'hint'));
        return choice;
    }));
    $('force-picker').showModal();
}

function download(blob, name) {
    const url = URL.createObjectURL(blob),
        a = node('a');
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// Frontage sizes every base but rarely changes, so the collapsed settings still show it.
function syncFrontageSummary() {
    $('frontage-summary').textContent = ` · ${setup.basing.frontage} mm frontage`;
}

// Width and height only mean something for a custom sheet.
function syncPaper() {
    for (const el of document.querySelectorAll('.custom-paper')) el.hidden = $('paper').value !== 'custom';
}
function syncSettings() {
    $('title').value = setup.title;
    for (const key of ['frontage', ...CATEGORIES]) $('base-' + key).value = setup.basing[key];
    syncFrontageSummary();
    $('terrain-color').value = setup.terrain.color;
    $('terrain-scale').value = setup.terrain.scale ?? 3;
    const terrain = TERRAINS.find(t => t.path === setup.terrain.image);
    $('terrain-preset').value = terrain ? terrain.path : setup.terrain.image ? 'custom' : '';
    // Tint and texture strength act on the image, so plain ground has nothing for them to change.
    for (const key of ['tint', 'opacity']) {
        $('terrain-' + key).value = Math.round(setup.terrain[key] * 100);
        $('terrain-' + key + '-value').textContent = `${Math.round(setup.terrain[key] * 100)}%`;
        $('terrain-' + key).disabled = !setup.terrain.image;
    }
    $('terrain-status').textContent = terrain ? `${terrain.title} · shared across the army` : setup.terrain.image ? 'Custom terrain selected' : 'Plain ground color';
    for (const [key, value] of Object.entries(setup.print_settings)) {
        const el = $(key);
        if (el) {
            if (el.type === 'checkbox') el.checked = value;
            else el.value = value;
        }
    }
    syncPaper();
}
async function exportFile(kind) {
    exporting = true; cancelExport = false;
    $('cancel-export').hidden = false;
    $('pdf').disabled = $('png').disabled = true;
    message('Preparing your print sheets…');
    try {
        const blob = await exportProject(setup, {artwork: catalog.artwork.slice()}, kind, message, () => cancelExport);
        download(blob, `midgard-sheets.${kind==='pdf'?'pdf':'zip'}`);
        message('Your print sheets are ready. Print at actual size / 100%.');
    } catch (error) {
        message(error.message);
    } finally {
        exporting = false;
        $('cancel-export').hidden = true;
        $('pdf').disabled = $('png').disabled = !pages.length;
    }
}
// An unknown profile is recoverable: once the table learns it, a type this app only guessed is
// corrected here rather than staying Warriors forever.
function repairOnLoad() {
    const repaired = repairProfiles(setup);
    if (repaired.length) message(`Profile types updated for ${repaired.join(', ')}.`);
}
async function start() {
    try {
        const response = await fetch('./assets/catalog.json');
        if (!response.ok) throw Error('Could not load the artwork catalog.');
        catalog = await response.json(); catalog.types = TYPES;
        builtinArtwork = catalog.artwork;
        catalog.factions.push({id: 'custom', era_id: null, title: 'Imported figures'});
        setup = emptyProject();
        try { const saved = await loadLocal(); if (saved) { setup = validateProject(saved); repairOnLoad(); } }
        catch (error) { message(`Could not restore autosave: ${error.message}`); }
        updateCatalog();
        wireComposer();
        wireTemplateDisplay();
        wireTabs();
        wireMenu('setup-menu-button', 'setup-menu');
        syncSettings();
        for (const e of catalog.eras) $('era').append(option(e.id, e.title));
        syncFactionOptions();
        for (const [id, t] of Object.entries(catalog.types)) $('type-filter').append(option(id, t.label));
        $('type-filter').append(option('hero', 'Leaders'));
        for (const id of ['faction', 'type-filter', 'search', 'art-mode']) $(id).addEventListener('input', renderCatalog);
        // Narrowing the era must not leave a faction selected that the era hides, which
        // would show an empty picker from two filters that each look reasonable alone.
        $('era').addEventListener('input', () => {
            if (factionEra($('faction').value) !== $('era').value) $('faction').value = '';
            syncFactionOptions();
            renderCatalog();
        });
        $('title').addEventListener('input', () => { setup.title = $('title').value; autosave(); });
        for (const key of ['paper', 'orientation', 'dpi', 'margin_mm', 'gap_mm', 'fit', 'supersample', 'labels', 'cut_lines', 'contingent_labels', 'contingent_border', 'contingent_border_width_mm', 'label_font_mm', 'contingent_tags', 'stamina_style', 'show_armour', 'bleed_mm', 'order', 'scale_bar', 'paper_width_mm', 'paper_height_mm', 'allow_overflow']) $(key).addEventListener('change', () => {
            const el = $(key);
            if (key === 'paper') syncPaper();
            setup.print_settings[key] = el.type === 'checkbox' ? el.checked : el.type === 'number' || ['supersample', 'bleed_mm'].includes(key) ? Number(el.value) : el.value;
            changed();
        });
        $('add-contingent-button').addEventListener('click', () => addContingent());
        $('select-all-bases').addEventListener('click', () => {
            for (const u of setup.units) u.print = true;
            renderUnits();
            changed();
        });
        $('save').addEventListener('click', () => {
            try { const project = validateProject(setup); download(new Blob([JSON.stringify(project) + '\n'], {type: 'application/json'}), 'midgard-setup.json'); }
            catch (error) { message(error.message); }
        });
        $('load').addEventListener('click', () => $('load-file').click());
        $('load-file').addEventListener('change', async () => {
            const file = $('load-file').files[0];
            if (!file) return;
            try {
                if (file.size > 64 * 1024 * 1024) throw Error('Setup file must be smaller than 64 MB');
                const data = JSON.parse(await file.text());
                const validated = validateProject(data);
                setup = validated;
                expandedUnits.clear();
                expandedTemplates.clear();
                expandedContingents.clear();
                previewCache.clear();
                updateCatalog();
                renderCatalog();
                syncSettings();
                renderUnits();
                changed();
                message('Setup loaded. Missing artwork can be replaced in each template’s Artwork selector.');
                repairOnLoad();
            } catch (error) {
                message(`Could not load setup: ${error.message}`);
            } finally {
                $('load-file').value = '';
            }
        });
        $('import-force').addEventListener('click', () => $('import-force-file').click());
        $('import-help').addEventListener('click', () => $('import-help-dialog').showModal());
        $('import-help-close').addEventListener('click', () => $('import-help-dialog').close());
        $('import-help-import').addEventListener('click', () => {
            $('import-help-dialog').close();
            $('import-force-file').click();
        });
        $('import-force-file').addEventListener('change', async () => {
            const file = $('import-force-file').files[0];
            if (!file) return;
            try {
                if (file.size > 8 * 1024 * 1024) throw Error('Force export must be smaller than 8 MB');
                const forces = readForces(JSON.parse(await file.text()));
                if (!forces.length) throw Error('this export contains no forces');
                if (forces.length === 1) applyForce(forces[0]);
                else chooseForce(forces);
            } catch (error) {
                message(`Could not import that force: ${error.message}`);
            } finally {
                $('import-force-file').value = '';
            }
        });
        $('new-template').addEventListener('click', () => openPicker({kind: 'create'}));
        $('load-faction-templates').addEventListener('click', openFactionTemplates);
        $('faction-templates-era').addEventListener('change', syncFactionTemplateFactions);
        $('faction-templates-faction').addEventListener('change', renderFactionTemplateChoices);
        $('faction-template-choices').addEventListener('change', () => {
            $('faction-templates-load').disabled = !$('faction-template-choices').querySelector('input:checked');
        });
        $('faction-templates-load').addEventListener('click', loadFactionTemplates);
        $('faction-templates-cancel').addEventListener('click', () => $('faction-templates').close());
        $('artwork-picker-cancel').addEventListener('click', () => $('artwork-picker').close());
        $('force-picker-cancel').addEventListener('click', () => $('force-picker').close());
        // Emptying the roster without losing the recipes that produced it: the templates,
        // contingents and imported figures are the tuning worth keeping, and keeping the
        // builder provenance means a re-import refills those same templates.
        $('clear-force').addEventListener('click', () => {
            if (!setup.units.length) {
                message('There are no bases to clear.');
                return;
            }
            if (!confirm(`Remove all ${setup.units.length} base(s)? Your troop templates, contingents, imported figures and print settings stay.`)) return;
            setup.units = [];
            for (const group of setup.contingents) group.commander_id = null; // their leaders are gone
            expandedUnits.clear();
            renderUnits();
            changed();
            message('Every base removed. Your templates are still here: add bases to them, or re-import the force to refill them.');
        });
        $('clear').addEventListener('click', () => {
            if (!confirm('Clear the current setup? This cannot be undone unless you have a saved backup.')) return;
            setup = emptyProject();
            expandedUnits.clear();
            expandedTemplates.clear();
            expandedContingents.clear();
            previewCache.clear();
            updateCatalog();
            renderCatalog();
            syncSettings();
            renderUnits();
            changed();
            message('Setup cleared.');
        });
        $('previous').addEventListener('click', () => {
            pageIndex--;
            showPage();
        });
        $('next').addEventListener('click', () => {
            pageIndex++;
            showPage();
        });
        $('zoom').addEventListener('change', () => {
            $('preview').classList.remove('zoom150', 'zoom200');
            if ($('zoom').value !== '100') $('preview').classList.add(`zoom${$('zoom').value}`);
        });
        $('refresh').addEventListener('click', changed);
        $('pdf').addEventListener('click', () => exportFile('pdf'));
        $('png').addEventListener('click', () => exportFile('png'));
        renderCatalog();
        renderUnits();
        changed();
    } catch (error) {
        message(`Could not start the sheet builder: ${error.message}`);
    }
}
function updateCatalog() {
    catalog.artwork = [...builtinArtwork, ...setup.custom_artwork];
}
// The add button's own tooltip explains what clicking does, so a warning must not shadow it.
function applyPreview(img, dataUrl, warnings) {
    if (dataUrl !== null) img.src = dataUrl;
    if (!img.closest('.template-add')) img.title = warnings;
}
async function paintUnitPreview(images, project, unit, version = null, cache = null, pixelWidth = undefined) {
    try {
        const result = await renderUnitPreview(project, structuredClone(unit), {artwork: catalog.artwork.slice()}, pixelWidth);
        const dataUrl = result.canvas.toDataURL(), warnings = result.warnings.join('\n');
        if (cache) previewCache.set(cache.key, {signature: cache.signature, dataUrl, warnings});
        for (const img of images) if (img.isConnected && (version === null || version === revision)) applyPreview(img, dataUrl, warnings);
        result.canvas.width = result.canvas.height = 1;
    } catch (error) { for (const img of images) if (img.isConnected) applyPreview(img, null, error.message); }
}
function updateUnitPreviews() {
    const unitImages = document.querySelectorAll('.unit-composition');
    const templateImages = document.querySelectorAll('.template-composition');
    if (!unitImages.length && !templateImages.length) return;
    // Snapshot once; later edits must not change a preview already rendering.
    const project = structuredClone(setup), version = revision, keys = new Set();
    const shared = {basing: project.basing, terrain: project.terrain};
    // A base's label strip takes its room from the figures, so its size is part of the picture.
    const {labels, contingent_labels, label_font_mm, contingent_tags, stamina_style, show_armour} = project.print_settings;
    // The DOM is rebuilt on every render, so reuse a cached composite instead of re-rendering
    // anything nothing relevant changed for. A base's composite depends on its template's
    // visuals plus its own roll; a template's depends on the visuals alone. One template can be
    // on screen twice — the card's preview and its summary add button — so group by key and
    // compose once for every image that wants it.
    const jobs = new Map();
    const queue = (key, img, source, unit, signature, pixelWidth) => {
        if (!jobs.has(key)) jobs.set(key, {source, unit, signature, pixelWidth, images: []});
        jobs.get(key).images.push(img);
    };
    for (const img of unitImages) {
        const unit = project.units.find(u => u.id === img.dataset.unitId);
        const t = unit && project.templates.find(t => t.id === unit.template_id);
        if (!t) continue;
        const group = project.contingents.find(g => g.commander_id === unit.id) || project.contingents.find(g => g.id === unit.contingent_id);
        const strip = {labels, contingent_labels, label_font_mm, contingent_tags, stamina_style, stamina: t.stamina, show_armour, armour: t.armour, name: unit.name,
            print_name: unit.print_name, group: group && [group.color, contingentTag(project, group)], groups: project.contingents.length};
        queue(unit.id, img, project, unit, JSON.stringify({template: visualsOf(t), seed: unit.seed, strip, ...shared}));
    }
    // Template previews illustrate the recipe on a fixed roll, with no labels or markings.
    const recipeProject = {...project, contingents: [], print_settings: {...project.print_settings, labels: false, stamina_style: 'off', show_armour: false}};
    for (const img of templateImages) {
        const t = project.templates.find(t => t.id === img.dataset.templateId);
        if (!t) continue;
        const sample = {id: t.id, template_id: t.id, name: t.label, name_source: 'custom', seed: TEMPLATE_PREVIEW_SEED, contingent_id: null};
        // The card's preview column is wider than the roster's, and actual size can be several
        // times that again on a high-density screen.
        const pixelWidth = actualSize ? Math.min(2400, Math.max(640, Math.ceil(dimensions(t, project.basing)[0] * pxPerMm * devicePixelRatio))) : 640;
        queue(`template:${t.id}`, img, recipeProject, sample, JSON.stringify({template: visualsOf(t), seed: TEMPLATE_PREVIEW_SEED, pixelWidth, ...shared}), pixelWidth);
    }
    for (const [key, job] of jobs) {
        keys.add(key);
        const cached = previewCache.get(key);
        if (cached?.signature === job.signature) {
            for (const img of job.images) applyPreview(img, cached.dataUrl, cached.warnings);
            continue;
        }
        paintUnitPreview(job.images, job.source, job.unit, version, {key, signature: job.signature}, job.pixelWidth);
    }
    for (const key of previewCache.keys()) if (!keys.has(key)) previewCache.delete(key);
}
const SHAPES = [['rectangle', 'Rectangle'], ['clusters', 'Clusters'], ['ellipse', 'Ellipse'], ['wedge', 'Wedge']];
const SHAPE_FIELD_LABELS = {
    rectangle: {rows: 'Rows', columns: 'Columns'},
    clusters: {rows: 'Rows per cluster', columns: 'Columns per cluster', clusterRows: 'Cluster rows', clusterColumns: 'Cluster columns'},
    ellipse: {rows: 'Rings', columns: 'Outer ring figures'},
    wedge: {rows: 'Ranks', columns: 'Back rank width'},
};
function formationControls(t) {
    const box = node('fieldset', undefined, 'formation-controls');
    box.append(node('legend', `Formation · ${figureCount(t.formation)} figures`));
    const fields = node('div', undefined, 'settings-grid');
    const shapeInput = node('select');
    for (const [id, label] of SHAPES) shapeInput.append(option(id, label));
    shapeInput.value = t.formation.shape;
    shapeInput.addEventListener('change', () => { t.formation.shape = shapeInput.value; renderUnits(); changed(); });
    fields.append(field('Shape', shapeInput));
    const labels = SHAPE_FIELD_LABELS[t.formation.shape];
    const keys = [['rows', labels.rows, 1, 20, 1], ['columns', labels.columns, 1, 20, 1]];
    if (t.formation.shape === 'clusters') keys.push(['clusterRows', labels.clusterRows, 1, 8, 1], ['clusterColumns', labels.clusterColumns, 1, 8, 1]);
    keys.push(['scale', 'Figure scale', .1, 4, .05], ['jitterX', 'Irregularity across', 0, .8, .05], ['jitterY', 'Irregularity in depth', 0, .8, .05], ['rotation', 'Rotation variation (degrees)', 0, 90, 1]);
    for (const [key, label, min, max, step] of keys) {
        const input = node('input'); input.type = 'number'; input.min = min; input.max = max; input.step = step; input.value = t.formation[key];
        input.addEventListener('change', () => { t.formation[key] = Number(input.value); renderUnits(); changed(); });
        fields.append(field(label, input));
    }
    box.append(fields, node('p', 'Irregularity across scatters figures along the frontage, in depth from front to back; 0 in both, with 0° rotation, gives regular formations. This recipe is shared by every base that follows the template; each base rolls its own poses and placement.', 'hint'));
    return box;
}
function wireComposer() {
    for (const terrain of TERRAINS) $('terrain-preset').append(option(terrain.path, terrain.title));
    $('terrain-preset').addEventListener('change', () => {
        if ($('terrain-preset').value === 'custom') { $('terrain-file').click(); return; }
        setup.terrain.image = $('terrain-preset').value || null;
        syncSettings(); renderCatalog(); changed();
    });
    $('add-figure-sample').addEventListener('click', () => {
        if (setup.units.length > 296) { message('The sample needs room for four units.'); return; }
        const ids = ['crimson-spear-figures', 'crimson-spear-figures', 'crimson-knight-figures', 'crimson-leader-figures'];
        for (const id of ids) setup.units.push(newUnit(catalog.artwork.find(a => a.id === id)));
        if (!setup.terrain.image) setup.terrain.image = TERRAINS[0].path;
        $('art-mode').value = 'figures'; $('era').value = 'wars-of-the-roses'; $('faction').value = 'barons-red'; $('type-filter').value = ''; $('search').value = '';
        syncFactionOptions();
        syncSettings(); renderCatalog(); renderUnits(); changed();
        message('Added two spear bases sharing one template, mounted knights and a foot leader. Adjust their formations in the template cards.');
        $('templates-heading').scrollIntoView({behavior: 'smooth', block: 'start'});
    });
    for (const key of ['frontage', ...CATEGORIES]) $('base-' + key).addEventListener('change', () => {
        setup.basing[key] = Number($('base-' + key).value);
        syncFrontageSummary();
        // Mounted riders auto-halve rows for 2:1 basing at creation time; re-balance existing
        // templates too so switching the ratio later doesn't leave them overflowing their base.
        if (key === 'mounted') for (const t of setup.templates) {
            const art = artFor(t);
            if (art?.mode === 'figures' && ['heavy_riders', 'light_riders'].includes(art.suggested_type)) t.formation.rows = formationForArt(art, setup.basing).rows;
        }
        renderCatalog(); renderUnits(); changed();
    });
    $('terrain-color').addEventListener('input', () => {
        setup.terrain.color = $('terrain-color').value;
        clearTimeout(colorTimer);
        colorTimer = setTimeout(() => { renderCatalog(); changed(); }, 120);
    });
    for (const key of ['tint', 'opacity']) $('terrain-' + key).addEventListener('input', () => {
        setup.terrain[key] = Number($('terrain-' + key).value) / 100;
        $('terrain-' + key + '-value').textContent = `${$('terrain-' + key).value}%`;
        clearTimeout(colorTimer);
        colorTimer = setTimeout(() => { renderCatalog(); changed(); }, 120);
    });
    $('terrain-scale').addEventListener('change', () => { setup.terrain.scale = Number($('terrain-scale').value); renderCatalog(); changed(); });
    $('terrain-file').addEventListener('change', async () => {
        const file = $('terrain-file').files[0]; if (!file) return;
        try {
            const image = await importImage(file), next = structuredClone(setup);
            next.terrain.image = image.path; setup = validateProject(next); syncSettings(); renderCatalog(); renderUnits(); changed();
        }
        catch (error) { message(error.message); }
        finally { $('terrain-file').value = ''; }
    });
    // Revert the preset dropdown if the user backs out of the file dialog it opened.
    $('terrain-file').addEventListener('cancel', () => syncSettings());
    $('clear-terrain').addEventListener('click', () => { setup.terrain.image = null; syncSettings(); renderCatalog(); changed(); });
    $('figure-files').addEventListener('change', async () => {
        const files = [...$('figure-files').files]; if (!files.length) return;
        $('figure-files').disabled = true;
        try {
            if (files.length > 20) throw Error('Import at most 20 poses together.');
            const height = Number($('figure-height').value);
            if (!Number.isFinite(height) || height < 1 || height > 40) throw Error('Choose a figure height between 1 and 40 mm.');
            const type = $('figure-type').value, hero = type === 'hero';
            const art = {id: 'custom-' + crypto.randomUUID(), title: ($('figure-title').value.trim() || files[0].name.replace(/\.[^.]+$/, '')).slice(0, 200),
                faction_id: 'custom', mode: 'figures', entity_kind: hero ? 'hero' : 'unit', suggested_type: hero ? null : type, variants: []};
            let opaque = false;
            for (const file of files) {
                const img = await importImage(file, true); opaque ||= !img.transparent;
                art.variants.push({id: String(art.variants.length + 1), path: img.path, height_mm: height});
            }
            const next = structuredClone(setup); next.custom_artwork.push(art); validateProject(next);
            setup = next; updateCatalog(); $('art-mode').value = 'figures'; $('era').value = ''; $('faction').value = 'custom'; $('search').value = ''; $('type-filter').value = '';
            syncFactionOptions();
            renderCatalog(); renderUnits(); changed();
            message(opaque ? 'Figures imported. Some images have no transparency and will show their background rectangles.' : 'Figures imported. Add the collection to your force to arrange it.');
        } catch (error) { message(error.message); }
        finally { $('figure-files').value = ''; $('figure-files').disabled = false; }
    });
    $('cancel-export').addEventListener('click', () => { cancelExport = true; });
}
// Actual size is a display preference: toggling or recalibrating repaints the template cards only.
function wireTemplateDisplay() {
    const repaint = () => { renderTemplates(); updateUnitPreviews(); };
    const bar = () => { $('calibrate-bar').style.width = `${85.6 * pxPerMm}px`; };
    $('actual-size').checked = actualSize;
    $('actual-size').addEventListener('change', () => {
        actualSize = $('actual-size').checked;
        store('midgard-actual-size', actualSize ? '1' : '0');
        repaint();
    });
    $('calibrate').addEventListener('click', () => {
        $('calibrate-scale').value = pxPerMm;
        bar();
        $('calibrate-dialog').showModal();
    });
    $('calibrate-scale').addEventListener('input', () => { pxPerMm = Number($('calibrate-scale').value); bar(); });
    $('calibrate-reset').addEventListener('click', () => { pxPerMm = CSS_PX_PER_MM; $('calibrate-scale').value = pxPerMm; bar(); });
    $('calibrate-done').addEventListener('click', () => $('calibrate-dialog').close());
    $('calibrate-dialog').addEventListener('close', () => {
        store('midgard-px-per-mm', String(pxPerMm));
        if (actualSize) repaint();
    });
}
// A small disclosure menu: its items close it, as do Escape and any click outside.
function wireMenu(buttonId, menuId) {
    const button = $(buttonId), menu = $(menuId);
    const setOpen = open => {
        menu.hidden = !open;
        button.setAttribute('aria-expanded', String(open));
        if (open) menu.querySelector('[role=menuitem]').focus();
    };
    button.addEventListener('click', () => setOpen(menu.hidden));
    menu.addEventListener('click', e => { if (e.target.closest('[role=menuitem]')) setOpen(false); });
    document.addEventListener('click', e => { if (!menu.hidden && !button.parentElement.contains(e.target)) setOpen(false); });
    menu.addEventListener('keydown', e => {
        const items = [...menu.querySelectorAll('[role=menuitem]')];
        const i = items.indexOf(document.activeElement);
        if (e.key === 'Escape') { setOpen(false); button.focus(); }
        else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus();
        }
    });
}
function selectTab(name) {
    for (const tab of document.querySelectorAll('.tab')) {
        const active = tab.id === `tab-${name}`;
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
        $(tab.getAttribute('aria-controls')).hidden = !active;
    }
}
function wireTabs() {
    for (const tab of document.querySelectorAll('.tab')) tab.addEventListener('click', () => selectTab(tab.id.slice(4)));
}
start();
