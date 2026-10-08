import {catalog} from './catalog.js';
import {pack} from './packing.js';

export function unitTypeOptions(art) {
  if (art.hero || art.kind === 'Monster') return [];
  return art.kind === 'Mounted' ? ['Heavy Riders', 'Light Riders'] : ['Warriors', 'Skirmishers'];
}

export function defaultSetup() {
  return {version: 1, nameplates: false, names: {}, copyNames: {},
    unitTypes: Object.fromEntries(catalog.filter(a => unitTypeOptions(a).length).map(a => [a.id, unitTypeOptions(a)[0]])),
    ranks: 2, skirmisherRanks: 1, riders: 4, lightRiders: 3, reverse: 'silhouette', infantryHeight: 14.5, mountedHeight: 21,
    cavalryBaseDepth: 20, monstrosityBaseDepth: 20, fakeShadows: false, figureBackground: 'solid', gradientBottom: '#456b94', gradientTop: '#eef7ff', labelPlacement: 'separate',
    groundColor: '#b6bc91', figureColor: '#ffffff', silhouetteColor: '#cccccc', paper: 'letter', orientation: 'portrait', margin: 10, gap: 4, guides: true,
    quantities: Object.fromEntries(catalog.map(art => [art.id, ['gondor-swords', 'gondor-horse', 'orc-axes', 'orc-wargs'].includes(art.id) ? 1 : 0]))};
}

export function validateSetup(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || input.version !== 1) throw Error('This is not an Uprights version 1 setup.');
  const result = defaultSetup();
  const number = (key, min, max, integer = false) => {
    const value = input[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) throw Error(`Invalid ${key}: use ${min} to ${max}${integer ? ' (whole numbers)' : ''}.`);
    result[key] = value;
  };
  number('ranks', 1, 4, true); number('riders', 2, 4, true);
  if (input.skirmisherRanks !== undefined) number('skirmisherRanks', 1, 4, true);
  if (input.lightRiders !== undefined) number('lightRiders', 2, 4, true);
  const unitTypes = input.unitTypes ?? {};
  if (typeof unitTypes !== 'object' || Array.isArray(unitTypes) || input.unitTypes === null) throw Error('Invalid unit types.');
  for (const art of catalog) {
    const options = unitTypeOptions(art);
    if (!options.length) continue;
    const type = unitTypes[art.id] ?? options[0];
    if (!options.includes(type)) throw Error(`${art.name}: invalid unit type.`);
    result.unitTypes[art.id] = type;
  }
  number('infantryHeight', 10, 30); number('mountedHeight', 15, 30);
  number('margin', 5, 25); number('gap', 2, 10);
  for (const [key, values] of Object.entries({cavalryBaseDepth: [20, 30, 40], monstrosityBaseDepth: [20, 30, 40], figureBackground: ['solid', 'gradient'], labelPlacement: ['separate', 'attached']})) {
    if (input[key] === undefined) continue;
    if (!values.includes(input[key])) throw Error(`Invalid ${key}.`);
    result[key] = input[key];
  }
  for (const [key, values] of Object.entries({reverse: ['silhouette', 'blank'], paper: ['a4', 'letter'], orientation: ['portrait', 'landscape']})) {
    if (!values.includes(input[key])) throw Error(`Invalid ${key}.`);
    result[key] = input[key];
  }
  for (const key of ['groundColor', 'figureColor', 'silhouetteColor', 'gradientBottom', 'gradientTop']) {
    if (['silhouetteColor', 'gradientBottom', 'gradientTop'].includes(key) && input[key] === undefined) continue;
    if (typeof input[key] !== 'string' || !/^#[0-9a-f]{6}$/i.test(input[key])) throw Error(`Invalid ${key}.`);
    result[key] = input[key].toLowerCase();
  }
  if (typeof input.guides !== 'boolean') throw Error('Invalid fold guide setting.');
  result.guides = input.guides;
  if (input.fakeShadows !== undefined && typeof input.fakeShadows !== 'boolean') throw Error('Invalid fake shadow setting.');
  result.fakeShadows = input.fakeShadows ?? false;
  if (!input.quantities || typeof input.quantities !== 'object' || Array.isArray(input.quantities)) throw Error('Missing unit quantities.');
  if (input.nameplates !== undefined && typeof input.nameplates !== 'boolean') throw Error('Invalid nameplate setting.');
  result.nameplates = input.nameplates ?? false;
  for (const key of ['names', 'copyNames']) {
    const values = input[key] ?? {};
    if (!values || typeof values !== 'object' || Array.isArray(values)) throw Error(`Invalid ${key}.`);
    for (const art of catalog) {
      const validateName = value => {
        if (typeof value !== 'string' || value.length > 80 || /[^\x20-\x7e\xa0-\xff€‘’“”–—…]/u.test(value))
          throw Error(`${art.name}: use a single-line name up to 80 characters with Latin letters, numbers and punctuation.`);
        return value.trim();
      };
      if (key === 'names') result.names[art.id] = validateName(values[art.id] ?? '');
      else {
        const copies = values[art.id] ?? [];
        if (!Array.isArray(copies) || copies.length > 50) throw Error(`${art.name}: invalid individual base names.`);
        result.copyNames[art.id] = Array.from(copies, value => validateName(value ?? ''));
      }
    }
  }
  let total = 0;
  for (const art of catalog) {
    const n = input.quantities[art.id] ?? 0;
    if (!Number.isInteger(n) || n < 0 || n > 50) throw Error(`${art.name}: choose 0 to 50 bases.`);
    result.quantities[art.id] = n; total += n;
  }
  if (total > 100) throw Error('Use at most 100 bases per setup.');
  return result;
}

// The unfolded strip is: half foot, [front, back, full foot]..., half foot.
// Each pair doubles back at its crest; only flat feet contribute to the base span.
export function makeStrip(art, setup, copy = 1) {
  const mounted = art.kind === 'Mounted';
  const baseWidth = art.baseWidth ?? 40;
  const baseDepth = art.hero ? (art.baseDepth ?? 20)
    : mounted ? (setup.cavalryBaseDepth ?? 20)
    : art.kind === 'Monster' ? (setup.monstrosityBaseDepth ?? 20) : (art.baseDepth ?? 20);
  const width = mounted ? baseDepth : baseWidth, span = mounted ? baseWidth : baseDepth;
  const unitType = art.hero ? 'Hero' : art.kind === 'Monster' ? 'Monstrosities'
    : setup.unitTypes?.[art.id] ?? unitTypeOptions(art)[0];
  const count = art.uprightCount ?? (art.hero ? 1 : mounted
    ? unitType === 'Light Riders' ? (setup.lightRiders ?? 3) : setup.riders
    : unitType === 'Skirmishers' ? (setup.skirmisherRanks ?? 1) : setup.ranks);
  const panelHeight = art.panelHeight ?? (mounted ? setup.mountedHeight : setup.infantryHeight);
  const pitch = span / count, sections = [], folds = [];
  let y = 0;
  const add = (kind, height, extra = {}) => { sections.push({kind, y, height, ...extra}); y += height; };
  add('ground', pitch / 2);
  for (let rank = 0; rank < count; rank++) {
    folds.push({y, kind: 'valley'});
    add('face', panelHeight, {side: 'front', variant: 'front', rank});
    folds.push({y, kind: 'mountain'});
    add('face', panelHeight, {side: 'back', variant: mounted ? 'mirror' : setup.reverse, rank});
    folds.push({y, kind: 'valley'});
    add('ground', rank === count - 1 ? pitch / 2 : pitch);
  }
  const strip = {art, copy, name: art.name, unitType, baseWidth, baseDepth, width, height: y, bodyWidth: width, bodyHeight: y, count, span, panelHeight, pitch, sections, folds};
  if (setup.nameplates && setup.labelPlacement === 'attached') {
    strip.labelName = setup.copyNames?.[art.id]?.[copy - 1] || setup.names?.[art.id] || art.name;
    strip.bodyY = mounted ? 0 : 10;
    strip.bodyX = mounted ? 10 : 0;
    // Side tabs attach to every ground section, leaving figure panels free.
    strip.wrapTabs = mounted
      ? sections.filter(s => s.kind === 'ground').flatMap(s => [
          {side: true, edge: 'front', x: 0, y: s.y, width: 10, height: s.height},
          {side: true, edge: 'rear', x: width + 10, y: s.y, width: 10, height: s.height}])
      : [{side: false, x: 0, y: 0, width, height: 10, edge: 'front'},
         {side: false, x: 0, y: y + 10, width, height: 10, edge: 'back'}];
    if (mounted) strip.width += 20;
    else strip.height += 20;
  }
  return strip;
}

export function layoutSetup(setup) {
  setup = validateSetup(setup);
  const items = catalog.flatMap(art => Array.from({length: setup.quantities[art.id]}, (_, i) => makeStrip(art, setup, i + 1)));
  const labels = setup.nameplates ? items.flatMap(strip => {
    const name = setup.copyNames[strip.art.id]?.[strip.copy - 1] || setup.names[strip.art.id] || strip.art.name;
    if (setup.labelPlacement === 'attached') {
      if (strip.art.kind !== 'Mounted') return [];
      return ['front', 'back'].map(edge => ({kind: 'nameplate', wrap: true, edge, art: strip.art, copy: strip.copy,
        name, width: strip.baseWidth, height: 9, sections: []}));
    }
    return [{kind: 'nameplate', art: strip.art, copy: strip.copy, name, width: strip.baseWidth - 2, height: 4, sections: []}];
  }) : [];
  return {...pack([...items, ...labels], setup), setup, total: items.length,
    labelTotal: setup.nameplates ? items.length * (setup.labelPlacement === 'attached' ? 2 : 1) : 0};
}
