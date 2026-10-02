const imageCache = new Map(), panelCache = new Map();
const DPI = 600, PX_PER_MM = DPI / 25.4;
const makeCanvas = (w, h) => Object.assign(document.createElement('canvas'), {width: w, height: h});

async function sourceImage(art) {
  if (!imageCache.has(art.id)) imageCache.set(art.id, (async () => {
    const image = new Image(); image.src = art.path;
    try { await image.decode(); } catch { throw Error(`Could not load ${art.name}. Check that the artwork files are present.`); }
    const canvas = makeCanvas(image.width, image.height), ctx = canvas.getContext('2d', {willReadFrequently: true});
    ctx.drawImage(image, 0, 0);
    const {data} = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let left = canvas.width, top = canvas.height, right = -1, bottom = -1;
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
      if (data[(y * canvas.width + x) * 4 + 3] > 8) {
        left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
    }
    if (right < left) throw Error(`${art.name} has no visible artwork.`);
    return {image, left, top, width: right - left + 1, height: bottom - top + 1};
  })().catch(error => { imageCache.delete(art.id); throw error; }));
  return imageCache.get(art.id);
}

export function panelKey(strip, variant, silhouetteColor = '#cccccc') { return `${strip.art.id}:${strip.width}:${strip.panelHeight}:${variant}${variant === 'silhouette' ? ':' + silhouetteColor : ''}`; }

async function panelImage(strip, variant, silhouetteColor = '#cccccc') {
  const key = panelKey(strip, variant, silhouetteColor);
  if (panelCache.has(key)) return panelCache.get(key);
  const work = (async () => {
    const source = await sourceImage(strip.art);
    const w = Math.round(strip.width * PX_PER_MM), h = Math.round(strip.panelHeight * PX_PER_MM);
    const big = makeCanvas(w * 2, h * 2), ctx = big.getContext('2d');
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.scale(big.width / strip.width, big.height / strip.panelHeight);
    let dw = strip.width - 1, dh = strip.panelHeight - 1;
    if (strip.art.kind === 'Mounted') {
      const ratio = Math.min(dw / source.width, dh / source.height);
      dw = source.width * ratio; dh = source.height * ratio;
    }
    ctx.drawImage(source.image, source.left, source.top, source.width, source.height,
      (strip.width - dw) / 2, strip.panelHeight - .5 - dh, dw, dh);
    if (variant === 'silhouette') {
      ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = silhouetteColor;
      ctx.fillRect(0, 0, strip.width, strip.panelHeight);
    }
    const out = makeCanvas(w, h), ox = out.getContext('2d');
    ox.imageSmoothingEnabled = true; ox.imageSmoothingQuality = 'high';
    // The first panel is rotated 180 degrees, the second reflected horizontally.
    // Reflecting the paper across their shared crest therefore aligns both outlines.
    if (variant === 'front') { ox.translate(w, h); ox.scale(-1, -1); }
    else { ox.translate(w, 0); ox.scale(-1, 1); }
    ox.drawImage(big, 0, 0, w, h);
    const result = {key, url: out.toDataURL('image/png'), width: w, height: h};
    big.width = big.height = 1;
    return result;
  })();
  // Enough for many height edits, but keep decoded resources bounded.
  if (panelCache.size >= 32) panelCache.delete(panelCache.keys().next().value);
  panelCache.set(key, work);
  try { return await work; } catch (error) { panelCache.delete(key); throw error; }
}

let labelFont;
let labelFontPromise;
async function prepareLabelFont() {
  labelFontPromise ??= (async () => {
    const doc = await PDFLib.PDFDocument.create();
    labelFont = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
  })();
  await labelFontPromise;
}

function fittedLabel(strip) {
  if (!labelFont) throw Error('Nameplate font is not ready.');
  const point = 72 / 25.4, maxSize = 8 / point, minSize = 6 / point;
  const naturalWidth = labelFont.widthOfTextAtSize(strip.name, maxSize * point) / point;
  const size = Math.min(maxSize, maxSize * (strip.width - 2) / Math.max(naturalWidth, .01));
  if (size < minSize) throw Error(`${strip.art.name} base ${strip.copy}: name is too long for a readable label. Shorten it (minimum 6 pt).`);
  return {size, textWidth: labelFont.widthOfTextAtSize(strip.name, size * point) / point};
}

export async function prepareArtwork(layout) {
  if (layout.setup.nameplates) {
    await prepareLabelFont();
    for (const item of layout.pages.flat()) if (item.kind === 'nameplate') fittedLabel(item);
  }
  const jobs = new Map();
  for (const page of layout.pages) for (const strip of page) for (const section of strip.sections) {
    if (section.kind === 'face' && section.variant !== 'blank') jobs.set(panelKey(strip, section.variant, layout.setup.silhouetteColor), [strip, section.variant, layout.setup.silhouetteColor]);
  }
  const results = new Map();
  // Decode one panel at a time to limit memory on phones.
  for (const [key, args] of jobs) results.set(key, await panelImage(...args));
  return results;
}

const ink = '#3e473f';
export function contrast(hex) {
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  return rgb[0] * .299 + rgb[1] * .587 + rgb[2] * .114 > .53 ? '#344035' : '#ffffff';
}

// One scene feeds SVG and PDF, so guide positions, palette, and artwork agree.
export function pageScene(layout, index) {
  const {width, height, setup, margin} = layout, ops = [];
  const rect = (x, y, w, h, fill, stroke, thickness = .12) => ops.push({type: 'rect', x, y, w, h, fill, stroke, thickness});
  const text = (value, x, y, size = 2, color = ink) => ops.push({type: 'text', value, x, y, size, color});
  const line = (x, y, x2, y2, color = ink, thickness = .14, dash = []) => ops.push({type: 'line', x, y, x2, y2, color, thickness, dash});
  rect(0, 0, width, height, '#ffffff');
  text('PAPER ARMY STANDEES / 40 x 20 mm bases', margin, margin + 2, 3);
  text('Print at 100% / actual size. Cut solid outlines; fold dashed crests and dotted feet.', margin, margin + 6, 2);
  for (const strip of layout.pages[index]) {
    const {x, y, width: w, sections} = strip;
    text(`${strip.art.shortName || strip.art.name} ${strip.copy}${strip.kind === 'nameplate' ? ' / label' : ''}`, x, strip.captionY, w === 20 ? 1.7 : 2);
    if (strip.kind === 'nameplate') {
      const {size, textWidth} = fittedLabel(strip);
      rect(x, y, w, strip.height, '#ffffff', '#59645c');
      text(strip.name, x + (w - textWidth) / 2, y + strip.height / 2 + size * .35, size, '#000000');
      continue;
    }
    for (const section of sections) {
      const sy = y + section.y;
      rect(x, sy, w, section.height, section.kind === 'ground' ? setup.groundColor : setup.figureColor);
      if (section.kind === 'face' && section.variant !== 'blank') {
        ops.push({type: 'image', key: panelKey(strip, section.variant, setup.silhouetteColor), x, y: sy, w, h: section.height});
      }
    }
    if (setup.guides) for (const fold of strip.folds) {
      const mountain = fold.kind === 'mountain';
      // A white underlay keeps fine fold marks visible on dark setup colors.
      line(x, y + fold.y, x + w, y + fold.y, '#ffffff', .35, mountain ? [1.2, .8] : [.3, .6]);
      line(x, y + fold.y, x + w, y + fold.y, mountain ? '#8f6333' : '#517e94', .15, mountain ? [1.2, .8] : [.3, .6]);
    }
    rect(x, y, w, strip.height, null, '#59645c');
  }
  const rulerY = height - margin - 4;
  line(margin, rulerY, margin + 40, rulerY, '#000000');
  line(margin, rulerY - 1, margin, rulerY + 1, '#000000');
  line(margin + 40, rulerY - 1, margin + 40, rulerY + 1, '#000000');
  text('40 mm - measure after printing', margin, rulerY + 4, 2);
  text(`Page ${index + 1} / ${layout.pages.length}`, width - margin - 24, rulerY + 4, 2);
  return ops;
}

const escape = value => String(value).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'}[c]));
export function previewSVG(layout, index, assets) {
  const elements = pageScene(layout, index).map(op => {
    if (op.type === 'rect') return `<rect x="${op.x}" y="${op.y}" width="${op.w}" height="${op.h}" fill="${op.fill || 'none'}" stroke="${op.stroke || 'none'}" stroke-width="${op.thickness}"/>`;
    if (op.type === 'line') return `<line x1="${op.x}" y1="${op.y}" x2="${op.x2}" y2="${op.y2}" stroke="${op.color}" stroke-width="${op.thickness}" stroke-dasharray="${op.dash.join(' ')}"/>`;
    if (op.type === 'text') return `<text x="${op.x}" y="${op.y}" font-family="Helvetica,Arial,sans-serif" font-size="${op.size}" fill="${op.color}">${escape(op.value)}</text>`;
    return `<image x="${op.x}" y="${op.y}" width="${op.w}" height="${op.h}" preserveAspectRatio="none" href="${assets.get(op.key).url}"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${layout.height}" role="img" aria-label="Print sheet ${index + 1}">${elements.join('')}</svg>`;
}

export async function createPDF(layout, assets, progress = () => {}) {
  if (!layout.pages.length) throw Error('Choose at least one base to print.');
  if (!globalThis.PDFLib) throw Error('The PDF library did not load. Reload the page and check the vendor folder.');
  const {PDFDocument, StandardFonts, rgb} = globalThis.PDFLib;
  const doc = await PDFDocument.create(), font = await doc.embedFont(StandardFonts.Helvetica);
  doc.setTitle('Paper Army Standees'); doc.setCreator('Paper Army Standees workshop');
  doc.setSubject('40 x 20 mm bases. Print at 100 percent / actual size.');
  const point = 72 / 25.4, embedded = new Map();
  const color = hex => rgb(...[1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255));
  for (let i = 0; i < layout.pages.length; i++) {
    progress(i + 1, layout.pages.length);
    const page = doc.addPage([layout.width * point, layout.height * point]);
    for (const op of pageScene(layout, i)) {
      if (op.type === 'rect') page.drawRectangle({x: op.x * point, y: (layout.height - op.y - op.h) * point,
        width: op.w * point, height: op.h * point, ...(op.fill ? {color: color(op.fill)} : {}),
        ...(op.stroke ? {borderColor: color(op.stroke), borderWidth: op.thickness * point} : {borderWidth: 0})});
      else if (op.type === 'line') page.drawLine({start: {x: op.x * point, y: (layout.height - op.y) * point},
        end: {x: op.x2 * point, y: (layout.height - op.y2) * point}, color: color(op.color), thickness: op.thickness * point,
        dashArray: op.dash.map(n => n * point)});
      else if (op.type === 'text') page.drawText(op.value, {x: op.x * point, y: (layout.height - op.y) * point,
        size: op.size * point, font, color: color(op.color)});
      else {
        if (!embedded.has(op.key)) embedded.set(op.key, await doc.embedPng(assets.get(op.key).url));
        page.drawImage(embedded.get(op.key), {x: op.x * point, y: (layout.height - op.y - op.h) * point, width: op.w * point, height: op.h * point});
      }
    }
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  return doc.save();
}
