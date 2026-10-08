import {catalog, eras} from './catalog.js';
import {defaultSetup, validateSetup, layoutSetup, makeStrip, unitTypeOptions} from './model.js';
import {prepareArtwork, previewSVG, createPDF} from './render.js';

const $ = id => document.getElementById(id), storageKey = 'uprights.setup.v1';
const fields = {fakeShadows: 'fake-shadows', cavalryBaseDepth: 'cavalry-base-depth', monstrosityBaseDepth: 'monstrosity-base-depth', figureBackground: 'figure-background', gradientBottom: 'gradient-bottom', gradientTop: 'gradient-top', labelPlacement: 'label-placement', ranks: 'ranks', skirmisherRanks: 'skirmisher-ranks', riders: 'riders', lightRiders: 'light-riders', reverse: 'reverse', infantryHeight: 'infantry-height', mountedHeight: 'mounted-height',
  groundColor: 'ground-color', figureColor: 'figure-color', silhouetteColor: 'silhouette-color', paper: 'paper', orientation: 'orientation', margin: 'margin', gap: 'gap', guides: 'guides', nameplates: 'nameplates'};
const numeric = new Set(['cavalryBaseDepth', 'monstrosityBaseDepth', 'ranks', 'skirmisherRanks', 'riders', 'lightRiders', 'infantryHeight', 'mountedHeight', 'margin', 'gap']);
const boolean = new Set(['guides', 'nameplates', 'fakeShadows']);
let setup = defaultSetup(), currentLayout = null, currentAssets = null, pageIndex = 0, revision = 0, timer, exporting = false;

const notice = document.createElement('p'); notice.className = 'notice'; notice.hidden = true; notice.setAttribute('role', 'status');
document.querySelector('.intro').after(notice);
function tell(message, error = false) { notice.textContent = message; notice.classList.toggle('error', error); notice.hidden = false; }
try {
  const saved = localStorage.getItem(storageKey);
  if (saved) setup = validateSetup(JSON.parse(saved));
} catch { tell('The saved browser setup could not be read. Started with the sample army; you can load a saved setup file.', true); }

for (const art of catalog) {
  const card = document.createElement('article'); card.className = 'art-card'; card.dataset.art = art.id; card.dataset.faction = art.faction; card.dataset.era = art.era;
  card.innerHTML = `<div class="art-preview"><img src="${art.path}" alt="${art.name}${art.kind === 'Mounted' ? ' in side profile' : ''}" loading="lazy"></div><div class="card-body"><h3>${art.name}</h3><p>${art.note}</p><div class="quantity"><label for="qty-${art.id}">Bases</label><button data-delta="-1" aria-label="Remove one ${art.name} base">−</button><input id="qty-${art.id}" type="number" min="0" max="50" step="1" aria-label="${art.name} bases"><button data-delta="1" aria-label="Add one ${art.name} base">+</button></div></div>`;
  for (const button of card.querySelectorAll('[data-delta]')) button.addEventListener('click', () => {
    const input = card.querySelector('input'); input.value = Math.max(0, Math.min(50, (Number(input.value) || 0) + Number(button.dataset.delta))); requestRender();
  });
  card.querySelector('input').addEventListener('input', requestRender);
  const options = unitTypeOptions(art);
  if (options.length) {
    const label = document.createElement('label'); label.textContent = 'Unit type';
    const select = document.createElement('select'); select.id = `type-${art.id}`;
    for (const type of options) select.add(new Option(type, type));
    select.addEventListener('input', requestRender); label.append(select);
    card.querySelector('.card-body').append(label);
  }
  const naming = document.createElement('div'); naming.className = 'unit-names';
  const label = document.createElement('label'); label.textContent = 'Unit name';
  const input = document.createElement('input'); input.id = `name-${art.id}`; input.type = 'text'; input.maxLength = 80;
  input.placeholder = art.name; input.addEventListener('input', requestRender); label.append(input); naming.append(label);
  const details = document.createElement('details'); details.innerHTML = '<summary>Individual base names</summary>';
  const copies = document.createElement('div'); copies.id = `copy-names-${art.id}`; details.append(copies); naming.append(details);
  card.querySelector('.card-body').append(naming);
  $('catalog').append(card);
}

function writeControls() {
  for (const [key, id] of Object.entries(fields)) { if (boolean.has(key)) $(id).checked = setup[key]; else $(id).value = setup[key]; }
  for (const art of catalog) {
    $(`qty-${art.id}`).value = setup.quantities[art.id];
    if (unitTypeOptions(art).length) $(`type-${art.id}`).value = setup.unitTypes[art.id];
    $(`name-${art.id}`).value = setup.names[art.id] || '';
    $(`copy-names-${art.id}`).replaceChildren();
  }
  syncCopyControls();
}
function syncCopyControls() {
  for (const art of catalog) {
    const container = $(`copy-names-${art.id}`), count = setup.quantities[art.id];
    // Keep hidden copies so reducing and restoring quantities preserves their names.
    for (let i = container.children.length; i < count; i++) {
      const label = document.createElement('label'); label.textContent = `Base ${i + 1}`;
      const input = document.createElement('input'); input.type = 'text'; input.maxLength = 80;
      input.id = `copy-name-${art.id}-${i + 1}`; input.placeholder = 'Use unit name';
      input.value = setup.copyNames[art.id]?.[i] || ''; input.addEventListener('input', requestRender);
      label.append(input); container.append(label);
    }
    for (const [i, label] of [...container.children].entries()) label.hidden = i >= count;
    container.closest('.unit-names').hidden = !setup.nameplates;
  }
}
function readControls() {
  const value = {version: 1, quantities: {}, names: {}, copyNames: {}, unitTypes: {}};
  for (const [key, id] of Object.entries(fields)) value[key] = boolean.has(key) ? $(id).checked : numeric.has(key) ? ($(id).value === '' ? NaN : Number($(id).value)) : $(id).value;
  for (const art of catalog) {
    const input = $(`qty-${art.id}`); value.quantities[art.id] = input.value === '' ? NaN : Number(input.value);
    if (unitTypeOptions(art).length) value.unitTypes[art.id] = $(`type-${art.id}`).value;
    value.names[art.id] = $(`name-${art.id}`).value;
    const copies = [...(setup.copyNames[art.id] || [])];
    for (const [i, input] of [...$(`copy-names-${art.id}`).querySelectorAll('input')].entries()) copies[i] = input.value;
    value.copyNames[art.id] = copies;
  }
  return validateSetup(value);
}
function counts() {
  const total = Object.values(setup.quantities).reduce((a, b) => a + b, 0);
  $('base-count').textContent = `${total} ${total === 1 ? 'base' : 'bases'}`;
  for (const art of catalog) document.querySelector(`[data-art="${art.id}"]`).classList.toggle('selected', setup.quantities[art.id] > 0);
  $('ground-value').textContent = setup.groundColor; $('figure-value').textContent = setup.figureColor;
  $('silhouette-value').textContent = setup.silhouetteColor;
  $('label-placement').disabled = !setup.nameplates;
  $('figure-color').disabled = setup.figureBackground !== 'solid';
  $('gradient-bottom').disabled = $('gradient-top').disabled = setup.figureBackground !== 'gradient';
  $('silhouette-color').disabled = setup.reverse !== 'silhouette';
}

function diagram() {
  const infantry = makeStrip(catalog.find(art => art.id === 'gondor-swords'), setup), cavalry = makeStrip(catalog.find(art => art.id === 'gondor-horse'), setup);
  const ground = setup.groundColor;
  const svg = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 245" role="img" aria-label="Infantry folds parallel to the 40 millimetre frontage; cavalry folds parallel to the selected base depth. Flat feet between doubled upright panels."><g font-family="system-ui,sans-serif" fill="#344035">`];
  for (const [i, strip] of [infantry, cavalry].entries()) {
    const left = 25 + i * 215, top = 28, depth = strip.baseDepth * 3.5;
    svg.push(`<text x="${left}" y="14" font-size="10" font-weight="600">${strip.unitType.toUpperCase()} · top view</text><rect x="${left}" y="${top}" width="140" height="${depth}" rx="2" fill="${ground}" stroke="#6c7767"/>`);
    for (let j = 0; j < strip.count; j++) {
      const t = (j + .5) / strip.count;
      const x1 = i ? left + 140 * t : left, y1 = i ? top : top + depth * t;
      const x2 = i ? x1 : left + 140, y2 = i ? top + depth : y1;
      svg.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="white" stroke-width="5"/><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#294d3d" stroke-width="2.5"/>`);
    }
    svg.push(`<text x="${left + 70}" y="${top + depth + 13}" text-anchor="middle" font-size="9">40 mm frontage</text><text x="${left + 148}" y="${top + depth / 2}" font-size="8" transform="rotate(-90 ${left + 148} ${top + depth / 2})" text-anchor="middle">${strip.baseDepth} mm depth</text>`);
  }
  svg.push('<text x="25" y="206" font-size="9">Flat feet + doubled upright panels (edge view)</text><path d="M25 233 H60 V213 H63 V233 H108 V213 H111 V233 H150" fill="none" stroke="#294d3d" stroke-width="2"/><line x1="25" y1="236" x2="150" y2="236" stroke="#9caa7c" stroke-width="3"/><text x="180" y="230" font-size="9">Fold at the crest; glue faces back-to-back.</text></g></svg>');
  $('fold-diagram').innerHTML = svg.join('');
  $('fold-description').textContent = `${infantry.unitType}: ${infantry.width} × ${+infantry.height.toFixed(2)} mm unfolded, ${+infantry.pitch.toFixed(2)} mm between ranks. ${cavalry.unitType}: ${cavalry.width} × ${+cavalry.height.toFixed(2)} mm unfolded, ${+cavalry.pitch.toFixed(2)} mm between riders. Flat feet total 20 mm for infantry and 40 mm for cavalry.${setup.nameplates && setup.labelPlacement === 'attached' ? ' Wraparound tabs add 10 mm at both infantry ends, or 10 mm on both sides of each cavalry ground section. Fold 3 mm down the base edge and tape the remaining 7 mm underneath. Cavalry also prints separate front/back name wraps.' : ''}`;
}

$('assembly').innerHTML = '<li>Print the PDF on one side of the paper at <strong>100% / actual size</strong>. Measure the 40 mm rule before cutting.</li><li>Score the dashed and dotted lines, then cut each complete net along its solid outline. In wraparound mode, keep the cavalry side tabs connected to the ground sections; cut the notches beside the figure panels. Keep the connecting ground sections intact.</li><li>Mountain-fold each dashed crest, bringing the unprinted backs of the paired figure panels together. Glue those backs to form a doubled upright.</li><li>Valley-fold the dotted lines at the feet. Glue the undersides of the colored ground sections to your matching base (40 × 20 mm Foot; selected 40 × 20, 40 × 30 or 40 × 40 mm Cavalry and Monstrosities; 20 × 20 mm Heroes), with the colored faces showing.</li><li>Infantry ranks run across the 40 mm frontage. Cavalry profiles run along the selected base depth, side by side across the frontage. Keep the rectangular figure panels for this first version; the background color fills their open spaces.</li><li>For wraparound tabs, mountain-fold at the base edge and again 3 mm farther out, then tape the remaining 7 mm underneath. Infantry names sit on the 3 mm front/rear edge bands. Cavalry side tabs wrap down and underneath; its separate front/back name strips have a 3 mm name band between 3 mm top and underside flaps. Fold at both lines and tape the flaps to the base. For separate labels, cut the nameplates (38 × 4 mm units; 18 × 4 mm heroes) and glue each to its matching base. Captions identify the artwork and base number.</li>';

function status(message, error = false) { $('status').textContent = message; $('status').classList.toggle('error', error); }
function showPage() {
  const pages = currentLayout?.pages.length || 0;
  pageIndex = Math.max(0, Math.min(pageIndex, pages - 1));
  $('page-number').textContent = pages ? `Page ${pageIndex + 1} of ${pages}` : 'No pages';
  $('previous').disabled = pageIndex === 0; $('next').disabled = pageIndex >= pages - 1;
  $('download').disabled = !pages || exporting;
  if (pages) $('sheet').innerHTML = previewSVG(currentLayout, pageIndex, currentAssets);
  else $('sheet').innerHTML = '<div class="empty">Choose at least one base<br>to build your print sheet.</div>';
}

function requestRender() {
  clearTimeout(timer); const id = ++revision;
  $('download').disabled = true; currentLayout = null;
  try {
    setup = readControls(); syncCopyControls(); counts(); diagram();
    try { localStorage.setItem(storageKey, JSON.stringify(setup)); } catch { tell('Browser storage is unavailable. Use Save setup to keep your settings.'); }
    status('Updating the print layout…');
    timer = setTimeout(() => render(id), 120);
  } catch (error) {
    status(error.message, true); $('sheet').innerHTML = '<div class="empty">Correct the settings to preview and export.</div>';
    $('page-number').textContent = 'No preview'; $('previous').disabled = $('next').disabled = true;
  }
}
async function render(id) {
  try {
    const layout = layoutSetup(setup), assets = await prepareArtwork(layout);
    if (id !== revision) return;
    currentLayout = layout; currentAssets = assets; showPage();
    status(layout.total ? `${layout.total} bases · ${layout.pages.length} ${layout.pages.length === 1 ? 'sheet' : 'sheets'} · ${layout.setup.paper === 'a4' ? 'A4' : 'US Letter'} · 600 dpi artwork` : 'Add a base to get started.');
  } catch (error) {
    if (id !== revision) return;
    currentLayout = null; status(error.message, true); showPage();
    $('sheet').innerHTML = '<div class="empty">The sheet could not be built.<br>Adjust the settings described above.</div>';
  }
}

for (const id of Object.values(fields)) $(id).addEventListener('input', requestRender);
// Browsing filters never change selected quantities or the print layout.
let factionFilter = 'All';
for (const eraId of new Set(catalog.map(art => art.era))) {
  $('era').add(new Option(eras.find(era => era.id === eraId)?.name || eraId, eraId));
}
function filterArtwork() {
  for (const card of document.querySelectorAll('.art-card')) {
    card.hidden = card.dataset.era !== $('era').value || (factionFilter !== 'All' && card.dataset.faction !== factionFilter);
  }
  for (const button of $('faction-filters').children) {
    const active = button.dataset.filter === factionFilter;
    button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
  }
}
function updateFactions() {
  const factions = [...new Set(catalog.filter(art => art.era === $('era').value).map(art => art.faction))].sort();
  if (!factions.includes(factionFilter)) factionFilter = 'All';
  $('faction-filters').replaceChildren();
  for (const faction of ['All', ...factions]) {
    const button = document.createElement('button'); button.dataset.filter = faction;
    button.textContent = faction === 'All' ? 'All units' : faction;
    button.addEventListener('click', () => { factionFilter = faction; filterArtwork(); });
    $('faction-filters').append(button);
  }
  filterArtwork();
}
$('era').addEventListener('change', updateFactions);
updateFactions();
$('previous').addEventListener('click', () => { if (currentLayout) { pageIndex--; showPage(); } });
$('next').addEventListener('click', () => { if (currentLayout) { pageIndex++; showPage(); } });

function download(blob, filename) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
$('save').addEventListener('click', () => {
  try { const valid = readControls(); download(new Blob([JSON.stringify(valid, null, 2) + '\n'], {type: 'application/json'}), 'uprights-setup.json'); tell('Setup saved, including names and colors.'); }
  catch (error) { tell(error.message, true); }
});
$('load').addEventListener('click', () => $('load-file').click());
$('clear').addEventListener('click', () => {
  if (!window.confirm('Clear setup? This removes all selected bases and custom unit and base names. Fold, color, and paper settings are kept. This cannot be undone.')) return;
  setup.quantities = Object.fromEntries(catalog.map(art => [art.id, 0]));
  setup.names = {}; setup.copyNames = {};
  // Preserve the other controls, including any edits awaiting a valid render.
  for (const art of catalog) {
    $(`qty-${art.id}`).value = 0;
    $(`name-${art.id}`).value = '';
    $(`copy-names-${art.id}`).replaceChildren();
  }
  pageIndex = 0; requestRender(); tell('Setup cleared.');
});
$('load-file').addEventListener('change', async () => {
  const file = $('load-file').files[0]; if (!file) return;
  try {
    if (file.size > 100_000) throw Error('Setup files must be under 100 KB.');
    const next = validateSetup(JSON.parse(await file.text()));
    // Do not replace the current setup unless parsing and validation succeeded.
    setup = next; writeControls(); pageIndex = 0; requestRender(); tell(`Loaded ${file.name}.`);
  } catch (error) { tell(`Could not load setup: ${error.message}`, true); }
  finally { $('load-file').value = ''; }
});
$('download').addEventListener('click', async () => {
  if (!currentLayout || exporting) return;
  const layout = currentLayout, assets = currentAssets, id = revision;
  exporting = true; $('download').disabled = true;
  try {
    const bytes = await createPDF(layout, assets, (page, total) => { if (revision === id) status(`Building PDF: page ${page} of ${total}…`); });
    download(new Blob([bytes], {type: 'application/pdf'}), 'uprights-print.pdf');
    tell(`PDF ready: ${layout.total} bases on ${layout.pages.length} ${layout.pages.length === 1 ? 'sheet' : 'sheets'}. Print at actual size / 100%.`);
    if (revision === id) status(`${layout.total} bases · ${layout.pages.length} sheets · PDF ready`);
  } catch (error) { tell(`PDF export failed: ${error.message}`, true); }
  finally { exporting = false; $('download').disabled = !currentLayout?.pages.length; }
});

writeControls(); requestRender();
