import {defaultSetup, validateSetup, unitTypeOptions} from './model.js';
import {catalog} from './catalog.js';
import {blank, validate as validateArmy} from './roster/model.js';

const key = 'midgard-army-project.v1';
export const formations = ['Warriors', 'Skirmishers', 'Heavy Riders', 'Light Riders', 'Monstrosities'];
export const shapes = ['square', 'diamond', 'triangle'];
const colors = ['#b04a36', '#305f91', '#897131', '#52794d'];
export const changes = new EventTarget();
export let previous = null;
export let storageMessage = '';

export function newProject(mode = 'roster') {
  const paper = defaultSetup();
  paper.nameplates = mode === 'roster';
  return {format: 'midgard-army-project', version: 1, mode, army: blank(), paper,
    mapping: {art: {}, overrides: {}, roles: {}, labels: {}, badges: {}, showBadges: true}};
}

export function compatible(art, role) {
  if (role === 'Hero') return Boolean(art.hero);
  if (role === 'Monstrosities') return art.kind === 'Monster';
  return unitTypeOptions(art).includes(role);
}

export function roleFor(type, mapping) {
  return formations.includes(type.role) ? type.role : mapping.roles[type.id];
}

function reconcile(p, editing) {
  const {army, mapping: m} = p;
  if (!m || typeof m.showBadges !== 'boolean') throw Error('Invalid artwork settings.');
  const types = new Map(army.types.map(t => [t.id, t]));
  const heroes = new Set(army.heroes.map(h => h.id));
  const entries = new Set([...heroes, ...army.units.map(u => u.id)]);
  const contingents = new Set(army.contingents.map(c => c.id));
  const artFits = (id, role) => catalog.some(a => a.id === id && compatible(a, role));
  const rules = {
    roles: (id, role) => types.has(id) && !formations.includes(types.get(id).role) && formations.includes(role),
    art: (id, value) => artFits(value, heroes.has(id) ? 'Hero' : types.has(id) && roleFor(types.get(id), m)),
    overrides: (id, value) => {
      const parts = id.split('/');
      const type = types.get(parts[0]);
      return parts.length === 2 && type && contingents.has(parts[1]) && artFits(value, roleFor(type, m));
    },
    labels: (id, value) => entries.has(id) && typeof value === 'string' && value.length <= 80,
    badges: (id, value) => contingents.has(id) && shapes.includes(value?.shape) && typeof value.color === 'string' && /^#[a-f0-9]{6}$/i.test(value.color)
  };
  for (const [field, valid] of Object.entries(rules)) {
    const values = m[field];
    if (!values || typeof values !== 'object' || Array.isArray(values)) throw Error('Invalid ' + field + ' settings.');
    for (const [id, value] of Object.entries(values)) {
      if (valid(id, value)) continue;
      if (!editing) throw Error('Invalid ' + field + ' assignment for ' + id + '.');
      delete values[id];
    }
  }
  army.contingents.forEach((c, i) => {
    m.badges[c.id] ??= {color: colors[i % colors.length], shape: shapes[i % shapes.length]};
  });
}

export function validateProject(p, editing = false) {
  if (p?.format !== 'midgard-army-project' || p.version !== 1 || !['manual','roster'].includes(p.mode))
    throw Error('Choose a Midgard army project file.');
  validateArmy(p.army);
  p.paper = validateSetup(p.paper);
  reconcile(p, editing);
  return p;
}

export let project = newProject(location.hash === '#manual' ? 'manual' : 'roster');
try {
  const saved = localStorage.getItem(key);
  if (saved) project = validateProject(JSON.parse(saved));
} catch (error) { storageMessage = 'Could not restore project. ' + error.message; }
reconcile(project, false);

export function replaceProject(next, source, editing = false) {
  validateProject(next, editing);
  if (source !== 'navigation') previous = project;
  project = next;
  try { localStorage.setItem(key, JSON.stringify(next)); storageMessage = ''; }
  catch { storageMessage = 'Browser storage is unavailable. Save your project to keep a copy.'; }
  changes.dispatchEvent(new CustomEvent('change', {detail: source}));
}
export function editProject(change, source) {
  const next = structuredClone(project);
  change(next);
  replaceProject(next, source, true);
}
export function undoProject() {
  if (previous) replaceProject(previous, 'undo');
}

export function rosterBases(p) {
  const {army, mapping} = p;
  const entries = [...army.units, ...army.heroes];
  if (entries.length > 100) throw Error('Standee sheets support up to 100 bases. This army has ' + entries.length + '.');
  const types = new Map(army.types.map(t => [t.id, t]));
  return entries.map((entry, i) => {
    const type = types.get(entry.typeId);
    const role = type ? roleFor(type, mapping) : 'Hero';
    const artId = type ? mapping.overrides[type.id + '/' + entry.contingentId] || mapping.art[type.id] : mapping.art[entry.id];
    const art = catalog.find(a => a.id === artId);
    if (!art || !compatible(art, role)) throw Error('Choose artwork and formation for ' + (type || entry).name + '.');
    const label = mapping.labels[entry.id] || entry.name;
    if (p.paper.nameplates && (label.length > 80 || /[^\x20-\x7e\xa0-\xff€‘’“”–—…]/u.test(label)))
      throw Error('Enter a shorter, printable label for ' + entry.name + '.');
    return {art, role, label, copy: i + 1, entryId: entry.id, typeId: entry.typeId, contingentId: entry.contingentId,
      badge: mapping.showBadges ? mapping.badges[entry.contingentId] : null};
  });
}
