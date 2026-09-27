export const TYPES = {
    warriors: {label: 'Warriors', category: 'foot'},
    skirmishers: {label: 'Skirmishers', category: 'foot'},
    heavy_riders: {label: 'Heavy Riders', category: 'mounted'},
    light_riders: {label: 'Light Riders', category: 'mounted'},
    monstrosities: {label: 'Monstrosities', category: 'monster'},
};
export const CATEGORIES = ['foot', 'mounted', 'monster', 'leader'];
export const TERRAINS = [
    {title: 'Dry earth', path: 'assets/terrain/dry-earth.png'},
    {title: 'Pale grassland', path: 'assets/terrain/grassland.png'},
];
export const CONTINGENT_COLORS = ['#a63d40', '#2864a0', '#38805b', '#8b5ca6', '#c47d19', '#167c80', '#b4537e', '#657c25'];
// Contingents need distinct colors, so keep generating past the end of the palette.
export function pickContingentColor(used = []) {
    const taken = new Set(Array.from(used, color => color.toLowerCase()));
    for (const color of CONTINGENT_COLORS) if (!taken.has(color)) return color;
    for (let i = 1;; i++) {
        const color = '#' + ((i * 0x9e3779) & 0xffffff).toString(16).padStart(6, '0');
        if (!taken.has(color)) return color;
    }
}
// Every unit belongs to a contingent, so a project always starts with (and never drops below) one.
// Border/label markings apply uniformly army-wide (see print_settings); only color is per-contingent.
export function defaultContingent(name = 'Contingent 1') {
    return {id: crypto.randomUUID(), name, color: CONTINGENT_COLORS[0], commander_id: null};
}
export function emptyProject() {
    return {
        schema_version: 3, game: 'midgard', title: 'My Midgard force',
        basing: {frontage: 40, foot: 2, mounted: 1, monster: 1, leader: 1},
        terrain: {color: '#e8e0ce', image: null, scale: 1, tint: 0, opacity: 1}, custom_artwork: [],
        source: null, profile_defaults: {}, templates: [],
        units: [], contingents: [defaultContingent()],
        print_settings: {paper: 'letter', orientation: 'portrait', dpi: 300,
            margin_mm: 5, gap_mm: 1, fit: 'contain', labels: false, cut_lines: true, supersample: 2,
            contingent_labels: true, contingent_border: false, contingent_border_width_mm: 0.6, label_font_mm: 2,
            allow_overflow: false},
    };
}
export function dimensions(unit, basing) {
    const category = unit.entity_kind === 'hero' ? 'leader' : TYPES[unit.unit_type].category;
    const width = basing.frontage / (category === 'leader' ? 2 : 1);
    return [width, width / basing[category]];
}
export function newSeed() {
    return Math.floor(Math.random() * 4294967296);
}
export function defaultFormation(hero = false) {
    return {shape: 'rectangle', rows: hero ? 1 : 2, columns: hero ? 1 : 5, clusterRows: 1, clusterColumns: 1,
        scale: 1, jitter: 0.1, rotation: 8, seed: newSeed()};
}
export function formationForArt(art, basing) {
    const f = {...defaultFormation(art.entity_kind === 'hero' || art.suggested_type === 'monstrosities'), ...art.formation_defaults};
    if (art.mode === 'figures' && ['heavy_riders', 'light_riders'].includes(art.suggested_type) && basing?.mounted === 2) f.rows = 1;
    return f;
}
// A template is the recipe and a base's seed is the roll, so a recipe never carries one.
export function recipe(formation) {
    const {seed, ...rest} = formation;
    return rest;
}
export function newTemplate(art, basing, {key, label, profile = null, type_source = 'custom', unit_type, variant_id} = {}) {
    const title = key ?? art.title;
    return {
        id: crypto.randomUUID(), key: title, label: label ?? title, profile, type_source,
        entity_kind: art.entity_kind, unit_type: art.entity_kind === 'hero' ? null : (unit_type ?? art.suggested_type),
        artwork_id: art.id, variant_id: variant_id ?? art.variants[Math.floor(Math.random() * art.variants.length)].id,
        formation: recipe(formationForArt(art, basing)),
    };
}
// Template keys identify a builder stack, so they stay unique; a clash gets a numbered suffix.
export function uniqueKey(key, taken) {
    let candidate = (key || 'Template').slice(0, 200);
    for (let n = 2; taken.has(candidate); n++) candidate = `${(key || 'Template').slice(0, 195)} ${n}`;
    taken.add(candidate);
    return candidate;
}
// A faction's ready-made templates are derived from its figure collections, never listed, so a
// new artwork batch joins its faction's defaults with no extra step. Army-list order: leaders,
// then foot, mounted and monsters, then by title.
const LIST_ORDER = ['leader', 'foot', 'mounted', 'monster'];
export function factionFigureArt(catalog, factionId) {
    const rank = art => LIST_ORDER.indexOf(art.entity_kind === 'hero' ? 'leader' : TYPES[art.suggested_type]?.category);
    return catalog.artwork.filter(a => a.faction_id === factionId && a.mode === 'figures')
        .sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title));
}
// A default already loaded is one still keyed on its collection's title, the same test
// templateForArt() uses; one the user renamed or retargeted is theirs, and gets a fresh default.
export function hasDefaultTemplate(p, art) {
    return p.templates.some(t => t.artwork_id === art.id && t.key === art.title);
}
export function defaultTemplates(p, catalog, factionId, artIds = null) {
    const taken = new Set(p.templates.map(t => t.key)), templates = [], present = [];
    for (const art of factionFigureArt(catalog, factionId)) {
        if (artIds && !artIds.includes(art.id)) continue;
        if (hasDefaultTemplate(p, art)) { present.push(art); continue; }
        const t = newTemplate(art, p.basing);
        t.key = t.label = uniqueKey(art.title, taken);
        templates.push(t);
    }
    return {templates, present};
}
// The render boundary wants whole units; the editor and the saved file keep them templated.
export function resolveUnit(p, unit) {
    const t = p.templates?.find(t => t.id === unit.template_id);
    if (!t) return unit;
    return {...unit, entity_kind: t.entity_kind, unit_type: t.unit_type, artwork_id: t.artwork_id,
        variant_id: t.variant_id, formation: {...t.formation, seed: unit.seed}};
}
export function resolved(p) {
    return p.templates ? {...p, units: p.units.map(u => resolveUnit(p, u))} : p;
}
export function poseHeight(pose, image) {
    // Calibrate against a body feature, not total weapon/canvas length.
    return pose.calibration ? image.height * pose.calibration.mm / pose.calibration.pixels : pose.height_mm;
}
// Ring-from-center and rank-from-apex counts happen to share a formula today, but are kept as
// separate named helpers since they index conceptually different things and may diverge later.
export function ellipseRingCounts(f) {
    return Array.from({length: f.rows}, (_, i) => Math.max(1, Math.round(f.columns * (i + 1) / f.rows)));
}
export function wedgeRankCounts(f) {
    return Array.from({length: f.rows}, (_, i) => Math.max(1, Math.round(f.columns * (i + 1) / f.rows)));
}
export function figureCount(f) {
    switch (f.shape) {
        case 'clusters': return f.rows * f.columns * f.clusterRows * f.clusterColumns;
        case 'ellipse': return ellipseRingCounts(f).reduce((a, b) => a + b, 0);
        case 'wedge': return wedgeRankCounts(f).reduce((a, b) => a + b, 0);
        default: return f.rows * f.columns; // rectangle, and legacy formations missing shape
    }
}
function ensure(condition, message) { if (!condition) throw Error(message); }
function number(value, min, max, label, integer = false) {
    ensure(Number.isFinite(value) && value >= min && value <= max && (!integer || Number.isInteger(value)),
        `${label} must be ${integer ? 'a whole number ' : ''}between ${min} and ${max}.`);
}
function text(value, label) {
    ensure(typeof value === 'string' && value.trim().length > 0 && value.length <= 200 && !/[\r\n]/.test(value), `${label} must be 1–200 characters on one line.`);
}
function unique(items, label) {
    const ids = new Set();
    for (const item of items) { text(item.id, `${label} ID`); ensure(!ids.has(item.id), `Duplicate ${label} ID.`); ids.add(item.id); }
    return ids;
}
export function isImageData(value) {
    return typeof value === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value) && value.length <= 16 * 1024 * 1024;
}
// Artwork, category and formation are the shared visual recipe: a template owns one, and a
// remembered profile default is the same shape minus the identity fields.
function visuals(v, entityKind, label) {
    text(v.artwork_id, `${label} artwork reference`); text(v.variant_id, `${label} pose reference`);
    ensure(entityKind === 'hero' ? v.unit_type === null : Object.hasOwn(TYPES, v.unit_type), 'Invalid Midgard unit type.');
    const f = v.formation;
    ensure(f && typeof f === 'object', 'Missing formation settings.');
    f.shape ??= 'rectangle'; f.clusterRows ??= 1; f.clusterColumns ??= 1; // migrate pre-shape saves
    delete f.seed; // the roll belongs to each base, never to the recipe
    ensure(['rectangle', 'clusters', 'ellipse', 'wedge'].includes(f.shape), 'Invalid formation shape.');
    number(f.rows, 1, 20, 'Rows', true); number(f.columns, 1, 20, 'Columns', true);
    number(f.clusterRows, 1, 8, 'Cluster rows', true); number(f.clusterColumns, 1, 8, 'Cluster columns', true);
    ensure(figureCount(f) <= 200, 'Use at most 200 figures per unit.');
    number(f.scale, 0.1, 4, 'Figure scale'); number(f.jitter, 0, 0.8, 'Placement irregularity');
    number(f.rotation, 0, 90, 'Rotation variation');
}
const RECIPE_KEYS = ['shape', 'rows', 'columns', 'clusterRows', 'clusterColumns', 'scale', 'jitter', 'rotation'];
function normalizeRecipe(f) {
    const out = {};
    for (const key of RECIPE_KEYS) out[key] = f?.[key];
    out.shape ??= 'rectangle'; out.clusterRows ??= 1; out.clusterColumns ??= 1;
    return out;
}
// "Warriors 1", "Warriors 2" → "Warriors": the shared part of the group's names, without the
// per-base numbering. A group of one keeps its whole name, minus any trailing index.
function sharedName(names) {
    let prefix = names[0] ?? '';
    for (const name of names.slice(1)) {
        let i = 0;
        while (i < prefix.length && i < name.length && prefix[i] === name[i]) i++;
        prefix = prefix.slice(0, i);
    }
    return prefix.replace(/[\s\-–—_#]*\d+$/, '').trim();
}
// Version 2 stored artwork and formation on every unit. Group units that are visually identical
// (the seed excepted, since that is the per-base roll) so "I added three of these" arrives as one
// recipe with three bases. Units differing in any visible way — including the pose variant, which
// matters for complete-unit illustrations — stay apart rather than silently editing together.
function migrateToTemplates(p) {
    const templates = [], groups = new Map(), units = [];
    for (const u of Array.isArray(p.units) ? p.units : []) {
        const formation = normalizeRecipe(u?.formation);
        const signature = JSON.stringify([u?.artwork_id, u?.variant_id, u?.entity_kind, u?.unit_type, formation]);
        let template = groups.get(signature);
        if (!template) {
            template = {id: crypto.randomUUID(), key: '', label: '', profile: null, type_source: 'custom',
                entity_kind: u?.entity_kind, unit_type: u?.unit_type,
                artwork_id: u?.artwork_id, variant_id: u?.variant_id, formation, names: []};
            groups.set(signature, template);
            templates.push(template);
        }
        template.names.push(typeof u?.name === 'string' ? u.name : '');
        units.push({id: u?.id, template_id: template.id, name: u?.name, name_source: u?.name_source,
            seed: u?.formation?.seed, contingent_id: u?.contingent_id ?? null});
    }
    const taken = new Set();
    for (const t of templates) {
        const fallback = p.custom_artwork?.find(a => a.id === t.artwork_id)?.title || t.artwork_id;
        t.key = uniqueKey(sharedName(t.names) || fallback, taken);
        t.label = t.key;
        delete t.names;
    }
    p.templates = templates; p.units = units; p.schema_version = 3;
}
export function validateProject(input) {
    const p = structuredClone(input);
    ensure([2, 3].includes(p?.schema_version) && p.game === 'midgard', 'Expected a Midgard version-2 or version-3 project. Old Python setups are not supported.');
    text(p.title, 'Title');
    ensure([40, 60, 80, 120].includes(p.basing?.frontage), 'Choose a frontage of 40, 60, 80 or 120 mm.');
    for (const key of CATEGORIES) ensure([1, 2].includes(p.basing[key]), `${key}: choose a 1:1 or 2:1 ratio.`);
    ensure(/^#[\da-f]{6}$/i.test(p.terrain?.color), 'Choose a valid terrain color.');
    p.terrain.scale ??= 3; // Preserve the original texture scale for earlier version-2 saves.
    number(p.terrain.scale, 1, 3, 'Terrain detail scale');
    // Earlier saves draw the image untinted and fully opaque, so those are the defaults.
    p.terrain.tint ??= 0;
    p.terrain.opacity ??= 1;
    number(p.terrain.tint, 0, 1, 'Terrain tint strength');
    number(p.terrain.opacity, 0, 1, 'Terrain texture strength');
    ensure(p.terrain.image === null || isImageData(p.terrain.image) || TERRAINS.some(t => t.path === p.terrain.image), 'Choose a bundled terrain or import a PNG, JPEG or WebP image.');
    ensure(Array.isArray(p.custom_artwork) && p.custom_artwork.length <= 100, 'At most 100 imported figure collections are supported.');
    unique(p.custom_artwork, 'artwork');
    for (const art of p.custom_artwork) {
        ensure(art.id.startsWith('custom-') && art.faction_id === 'custom' && art.mode === 'figures', 'Invalid imported figure collection.');
        text(art.title, 'Artwork title');
        ensure(['unit', 'hero'].includes(art.entity_kind), 'Invalid artwork category.');
        ensure(art.entity_kind === 'hero' ? art.suggested_type === null : Object.hasOwn(TYPES, art.suggested_type), 'Invalid artwork type.');
        ensure(Array.isArray(art.variants) && art.variants.length > 0 && art.variants.length <= 20, 'Choose 1–20 figure poses per collection.');
        unique(art.variants, 'pose');
        for (const pose of art.variants) {
            ensure(isImageData(pose.path), 'Imported figures must contain PNG, JPEG or WebP data.');
            number(pose.height_mm, 1, 40, 'Figure height at 40 mm frontage');
            if (pose.calibration !== undefined) {
                ensure(pose.calibration && typeof pose.calibration === 'object', 'Invalid figure calibration.');
                number(pose.calibration.mm, .1, 20, 'Calibration size');
                number(pose.calibration.pixels, 1, 10000, 'Calibration pixels');
            }
        }
    }
    const imageBytes = (p.terrain.image?.length || 0) + p.custom_artwork.reduce((sum, art) => sum + art.variants.reduce((n, pose) => n + pose.path.length, 0), 0);
    ensure(imageBytes <= 60 * 1024 * 1024, 'Imported images exceed the 60 MB project budget. Use smaller images or split this army into separate projects.');
    if (p.schema_version === 2) migrateToTemplates(p);
    // Provenance of the last force builder import, so a re-import can merge instead of replace.
    p.source ??= null;
    ensure(p.source === null || (typeof p.source === 'object' && !Array.isArray(p.source)
        && ['app', 'force_id', 'force_name'].every(key => typeof p.source[key] === 'string')), 'Invalid force builder source.');
    ensure(Array.isArray(p.templates) && p.templates.length <= 300, 'At most 300 troop templates are supported.');
    const templateIds = unique(p.templates, 'template'), keys = new Set();
    for (const t of p.templates) {
        text(t.key, 'Template key'); text(t.label, 'Template name');
        ensure(!keys.has(t.key), 'Troop templates need distinct keys.'); keys.add(t.key);
        t.profile ??= null;
        ensure(t.profile === null || (typeof t.profile === 'string' && t.profile.length <= 200 && !/[\r\n]/.test(t.profile)), 'Invalid template profile.');
        t.type_source ??= 'custom';
        ensure(['profile', 'guess', 'custom'].includes(t.type_source), 'Invalid template type source.');
        ensure(['unit', 'hero'].includes(t.entity_kind), 'Invalid template category.');
        visuals(t, t.entity_kind, 'Template');
    }
    // Remembered per-profile defaults stay in the project, so a saved file is self-contained.
    p.profile_defaults ??= {};
    ensure(p.profile_defaults && typeof p.profile_defaults === 'object' && !Array.isArray(p.profile_defaults)
        && Object.keys(p.profile_defaults).length <= 100, 'Invalid profile defaults.');
    for (const [profile, d] of Object.entries(p.profile_defaults)) {
        text(profile, 'Profile name');
        ensure(d && typeof d === 'object', 'Invalid profile default.');
        visuals(d, 'unit', 'Profile default');
    }
    ensure(Array.isArray(p.units) && p.units.length <= 300, 'At most 300 units are supported.');
    const units = unique(p.units, 'unit');
    for (const u of p.units) {
        text(u.name, 'Unit name'); text(u.template_id, 'Template reference');
        ensure(templateIds.has(u.template_id), 'Unknown template reference.');
        ensure(['default', 'custom'].includes(u.name_source), 'Invalid unit name source.');
        number(u.seed, 0, 4294967295, 'Formation seed', true);
    }
    const kindOf = id => p.templates.find(t => t.id === p.units.find(u => u.id === id)?.template_id)?.entity_kind;
    if (!Array.isArray(p.contingents) || !p.contingents.length) p.contingents = [defaultContingent()]; // migrate pre-hierarchy saves
    ensure(p.contingents.length <= 300, 'Invalid contingents.');
    const groups = unique(p.contingents, 'contingent'), commanders = new Set(), colors = new Set();
    for (const g of p.contingents) {
        text(g.name, 'Contingent name');
        ensure(/^#[\da-f]{6}$/i.test(g.color), 'Invalid contingent color.');
        ensure(!colors.has(g.color.toLowerCase()), 'Contingents need distinct colors.'); colors.add(g.color.toLowerCase());
        if (g.commander_id !== null) {
            ensure(units.has(g.commander_id) && kindOf(g.commander_id) === 'hero', 'A commander must be a leader in this force.');
            ensure(!commanders.has(g.commander_id), 'A leader can command only one contingent.'); commanders.add(g.commander_id);
            const commander = p.units.find(u => u.id === g.commander_id);
            ensure(commander.contingent_id === null || commander.contingent_id === g.id, 'A commander cannot belong to another contingent.');
        }
    }
    // Every non-commander unit belongs to a contingent; default orphans to the first one.
    for (const u of p.units) if (!commanders.has(u.id) && (u.contingent_id === null || !groups.has(u.contingent_id))) u.contingent_id = p.contingents[0].id;
    for (const u of p.units) ensure(u.contingent_id === null || groups.has(u.contingent_id), 'Unknown contingent reference.');
    const s = p.print_settings;
    ensure(s && ['letter', 'a4'].includes(s.paper) && ['portrait', 'landscape'].includes(s.orientation), 'Invalid paper settings.');
    number(s.dpi, 72, 600, 'DPI', true); number(s.margin_mm, 0, 50, 'Margin'); number(s.gap_mm, 0, 20, 'Gap');
    ensure(['contain', 'cover', 'stretch'].includes(s.fit), 'Invalid artwork fit.');
    ensure(typeof s.labels === 'boolean' && typeof s.cut_lines === 'boolean', 'Invalid print options.');
    // Migrate pre-hierarchy saves, where these were per-contingent instead of army-wide.
    s.contingent_labels ??= true; s.contingent_border ??= false; s.contingent_border_width_mm ??= 0.6;
    s.supersample ??= 2; // Saves from before supersampling existed get the recommended setting, not the old look.
    ensure([1, 2, 4].includes(s.supersample), 'Choose a print sampling of 1, 2 or 4.');
    s.allow_overflow ??= false; // Older saves keep the safe area enforced, which is the cautious default.
    ensure(typeof s.allow_overflow === 'boolean', 'Invalid safe-area option.');
    ensure(typeof s.contingent_labels === 'boolean' && typeof s.contingent_border === 'boolean', 'Invalid contingent marking options.');
    number(s.contingent_border_width_mm, 0.2, 2, 'Contingent border width');
    s.label_font_mm ??= 2; // The size every label printed at before it was adjustable.
    number(s.label_font_mm, 1, 4, 'Label text size');
    return p;
}
export function groupFor(p, u) {
    return p.contingents.find(g => g.commander_id === u.id) || p.contingents.find(g => g.id === u.contingent_id);
}
export function pack(p) {
    const s = p.print_settings;
    const size = s.paper === 'a4' ? [210, 297] : [215.9, 279.4];
    if (s.orientation === 'landscape') size.reverse();
    const margin = s.margin_mm, gap = s.gap_mm;
    const items = p.units.map((unit, index) => ({index, unit, width: dimensions(unit, p.basing)[0], height: dimensions(unit, p.basing)[1]}));
    items.sort((a, b) => b.height - a.height || b.width - a.width || a.index - b.index);
    const pages = []; let page = [], x = margin, y = margin, rowHeight = 0;
    for (const item of items) {
        if (item.width > size[0] - 2 * margin || item.height > size[1] - 2 * margin) throw Error(`${item.unit.name}: base does not fit this paper and margin.`);
        if (x > margin && x + item.width > size[0] - margin + 1e-8) { x = margin; y += rowHeight + gap; rowHeight = 0; }
        if (y + item.height > size[1] - margin + 1e-8) { pages.push(page); page = []; x = y = margin; rowHeight = 0; }
        page.push({...item, x, y}); x += item.width + gap; rowHeight = Math.max(rowHeight, item.height);
    }
    if (page.length) pages.push(page);
    if (pages.length > 30) throw Error('Use at most 30 print pages; split this army into smaller projects.');
    return {size, pages};
}
export function random(seed) {
    return () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const CLUSTER_INNER_FACTOR = 0.8; // shrink each block's active area so clusters read as distinct clumps
function rectangleSlots(f, safeW, safeH) {
    const cellW = safeW / f.columns, cellH = safeH / f.rows, centers = [];
    for (let row = 0; row < f.rows; row++) for (let col = 0; col < f.columns; col++)
        centers.push({x: (col + 0.5) * cellW, y: (row + 0.5) * cellH});
    return {centers, cellW, cellH};
}
function clusterSlots(f, safeW, safeH, rng) {
    const blockW = safeW / f.clusterColumns, blockH = safeH / f.clusterRows;
    const shrink = f.clusterRows > 1 || f.clusterColumns > 1 ? CLUSTER_INNER_FACTOR : 1;
    const cellW = blockW * shrink / f.columns, cellH = blockH * shrink / f.rows, centers = [];
    for (let bi = 0; bi < f.clusterRows; bi++) for (let bj = 0; bj < f.clusterColumns; bj++) {
        // Jitter each block's own center (not just the figures within it) so clusters read as
        // loose, unevenly-placed clumps rather than one grid subdivided into neat cells.
        const bx = (bj + 0.5 + (rng() - 0.5) * f.jitter * shrink) * blockW;
        const by = (bi + 0.5 + (rng() - 0.5) * f.jitter * shrink) * blockH;
        for (let row = 0; row < f.rows; row++) for (let col = 0; col < f.columns; col++)
            centers.push({x: bx + (col + 0.5 - f.columns / 2) * cellW, y: by + (row + 0.5 - f.rows / 2) * cellH});
    }
    return {centers, cellW, cellH};
}
function ellipseSlots(f, safeW, safeH) {
    const counts = ellipseRingCounts(f), total = counts.reduce((a, b) => a + b, 0);
    const spacing = Math.sqrt((safeW * safeH) / total);
    const a = Math.max(0, safeW / 2 - spacing / 2), b = Math.max(0, safeH / 2 - spacing / 2);
    const cx = safeW / 2, cy = safeH / 2, centers = [];
    counts.forEach((n, i) => {
        if (n === 1) { centers.push({x: cx, y: cy}); return; } // a lone ring figure sits centered, not on a tiny off-center ring
        const ai = a * (i + 1) / f.rows, bi = b * (i + 1) / f.rows, offset = (i % 2) * Math.PI / n;
        for (let j = 0; j < n; j++) {
            const theta = (j / n) * 2 * Math.PI + offset;
            centers.push({x: cx + Math.cos(theta) * ai, y: cy + Math.sin(theta) * bi});
        }
    });
    return {centers, cellW: spacing, cellH: spacing};
}
function wedgeSlots(f, safeW, safeH) {
    const counts = wedgeRankCounts(f), rankH = safeH / f.rows, unitW = safeW / f.columns, cx = safeW / 2, centers = [];
    counts.forEach((n, i) => {
        const y = (i + 0.5) * rankH;
        for (let j = 0; j < n; j++) centers.push({x: cx + (j - (n - 1) / 2) * unitW, y});
    });
    return {centers, cellW: unitW, cellH: rankH};
}
export function formation(unit, basing, poses, images, inset = 1, labelHeight = 0) {
    const [w, h] = dimensions(unit, basing), f = unit.formation, rng = random(f.seed);
    const safeW = w - 2 * inset, safeH = h - 2 * inset - labelHeight;
    const {centers, cellW, cellH} = f.shape === 'clusters' ? clusterSlots(f, safeW, safeH, rng)
        : f.shape === 'ellipse' ? ellipseSlots(f, safeW, safeH)
        : f.shape === 'wedge' ? wedgeSlots(f, safeW, safeH)
        : rectangleSlots(f, safeW, safeH);
    const figures = []; let overflow = false;
    for (const center of centers) {
        const pose = poses[Math.floor(rng() * poses.length)], img = images.get(pose.path);
        const height = poseHeight(pose, img) * basing.frontage / 40 * f.scale, width = height * img.width / img.height;
        const x = inset + center.x + (rng() - 0.5) * f.jitter * cellW;
        const y = inset + center.y + (rng() - 0.5) * f.jitter * cellH;
        const angle = (rng() * 2 - 1) * f.rotation * Math.PI / 180;
        const boundW = Math.abs(Math.cos(angle)) * width + Math.abs(Math.sin(angle)) * height;
        const boundH = Math.abs(Math.sin(angle)) * width + Math.abs(Math.cos(angle)) * height;
        if (x - boundW / 2 < inset || x + boundW / 2 > w - inset || y - boundH / 2 < inset || y + boundH / 2 > h - inset - labelHeight) overflow = true;
        figures.push({path: pose.path, x, y, width, height, angle});
    }
    return {figures, overflow};
}
