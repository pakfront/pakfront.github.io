import {catalog, eras} from './catalog.js';
import {project, editProject, formations, shapes, compatible, roleFor} from './project.js';

const root = document.getElementById('mapping');
let era = '', faction = '';
function node(tag, parent, text) {
  const el = document.createElement(tag);
  if (text) el.textContent = text;
  parent.append(el);
  return el;
}
function select(parent, title, options, value, change) {
  const field = node('label', parent, title);
  const input = node('select', field);
  input.setAttribute('aria-label', title);
  for (const [id, name] of options) input.add(new Option(name, id));
  input.value = value || '';
  input.onchange = () => change(input.value);
  return input;
}
function set(field, key, value) {
  editProject(p => {
    if (value) p.mapping[field][key] = value;
    else delete p.mapping[field][key];
  }, 'mapping');
}
function picker(parent, title, role, field, key, placeholder) {
  const value = project.mapping[field][key];
  const choices = catalog.filter(a => compatible(a, role) &&
    (a.id === value || ((!era || a.era === era) && (!faction || a.faction === faction))));
  select(parent, title, [['', placeholder], ...choices.map(a => [a.id, a.name + ' · ' + a.faction])],
    value, id => set(field, key, id));
  const art = choices.find(a => a.id === value);
  if (art) {
    const img = node('img', parent);
    img.src = art.path;
    img.alt = art.name;
  }
}
function details(parent, key, caption) {
  const el = node('details', parent);
  el.dataset.key = key;
  node('summary', el, caption);
  return el;
}
export function renderMapping() {
  const {army, mapping} = project;
  const open = new Set([...root.querySelectorAll('details[open]')].map(d => d.dataset.key));
  root.replaceChildren();
  node('h2', root, 'Assign paper miniatures');
  if (!army.units.length && !army.heroes.length) {
    node('p', root, 'Add units or heroes on the Army & battle roster tab to build your print sheet.');
    return;
  }
  select(root, 'Artwork era', [['','All eras'], ...eras.map(e => [e.id, e.name])], era, value => {
    era = value; faction = ''; renderMapping();
  });
  const factions = [...new Set(catalog.filter(a => !era || a.era === era).map(a => a.faction))].sort();
  select(root, 'Artwork faction', [['','All factions'], ...factions.map(f => [f,f])], faction, value => {
    faction = value; renderMapping();
  });
  for (const type of army.types) {
    const units = army.units.filter(u => u.typeId === type.id);
    if (!units.length) continue;
    const group = node('section', root);
    node('h3', group, type.name);
    node('p', group, type.role + ' · ' + units.length + ' bases');
    const role = roleFor(type, mapping);
    if (!formations.includes(type.role))
      select(group, 'Print formation', [['','Choose formation'], ...formations.map(r => [r,r])], role, v => set('roles', type.id, v));
    picker(group, 'Default artwork', role, 'art', type.id, 'Choose artwork');
    const overrides = details(group, type.id, 'Artwork by contingent');
    for (const c of army.contingents.filter(c => units.some(u => u.contingentId === c.id)))
      picker(overrides, c.name, role, 'overrides', type.id + '/' + c.id, 'Use type artwork');
  }
  for (const hero of army.heroes) {
    const group = node('section', root);
    node('h3', group, hero.name);
    picker(group, 'Hero artwork', 'Hero', 'art', hero.id, 'Choose hero artwork');
  }
  const labels = details(root, 'print-labels', 'Individual print labels');
  for (const entry of [...army.units, ...army.heroes]) {
    const input = node('input', node('label', labels, entry.name));
    input.maxLength = 80;
    input.placeholder = entry.name;
    input.value = mapping.labels[entry.id] || '';
    input.onchange = () => set('labels', entry.id, input.value.trim());
  }
  const badges = details(root, 'contingent-badges', 'Contingent badges');
  const toggle = node('input', node('label', badges, 'Print contingent badges '));
  node('p', badges, 'Badges print on the rear ground band. Turn badges off to choose a different label placement.');
  toggle.type = 'checkbox';
  toggle.checked = mapping.showBadges;
  toggle.onchange = () => editProject(p => { p.mapping.showBadges = toggle.checked; }, 'mapping');
  const styles = Object.values(mapping.badges).map(b => b.shape + b.color.toLowerCase());
  if (mapping.showBadges && new Set(styles).size < styles.length)
    node('p', badges, 'Some contingents share a badge. Choose distinct shapes or colors to tell them apart.');
  for (const c of army.contingents) {
    const badge = mapping.badges[c.id];
    const input = node('input', node('label', badges, c.name + ' color'));
    input.type = 'color';
    input.value = badge.color;
    input.onchange = () => set('badges', c.id, {...badge, color: input.value});
    select(badges, c.name + ' shape', shapes.map(s => [s,s]), badge.shape, shape => set('badges', c.id, {...badge, shape}));
  }
  for (const el of root.querySelectorAll('details')) el.open = open.has(el.dataset.key);
}
