const imageCache = new Map(), panelCache = new Map(), shadowCache = new Map();
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

export function panelKey(strip, variant, silhouetteColor = '#cccccc') { return `${strip.art.id}:${strip.bodyWidth ?? strip.width}:${strip.panelHeight}:${variant}${variant === 'silhouette' ? ':' + silhouetteColor : ''}`; }

async function panelImage(strip, variant, silhouetteColor = '#cccccc') {
  strip = {...strip, width: strip.bodyWidth ?? strip.width};
  const key = panelKey(strip, variant, silhouetteColor);
  if (panelCache.has(key)) return panelCache.get(key);
  const work = (async () => {
    const source = await sourceImage(strip.art);
    const w = Math.round(strip.width * PX_PER_MM), h = Math.round(strip.panelHeight * PX_PER_MM);
    const big = makeCanvas(w * 2, h * 2), ctx = big.getContext('2d');
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.scale(big.width / strip.width, big.height / strip.panelHeight);
    let dw = strip.width - 1, dh = strip.panelHeight - 1;
    if (strip.art.kind === 'Mounted' || strip.art.preserveAspect) {
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

// Infantry uses short shadows on both sides. Mounted profiles cast one larger
// silhouette toward increasing assembled frontage, onto the following foot.
export function groundShadows(strip, section) {
  if (!['Mounted', 'Infantry'].includes(strip.art.kind) || section.kind !== 'ground') return [];
  const before = section.y > 0, after = section.y + section.height < strip.bodyHeight;
  if (strip.art.kind === 'Mounted') {
    if (!before) return [];
    const height = Math.min(section.height - .5, strip.panelHeight * .8);
    return height > 0 ? [{y: section.y + .25, height, flipped: true}] : [];
  }
  const height = Math.min(2.5, section.height / (before && after ? 2 : 1) - .5);
  if (height <= 0) return [];
  const shadows = [];
  if (before) shadows.push({y: section.y + .25, height, flipped: true});
  if (after) shadows.push({y: section.y + section.height - .25 - height, height, flipped: false});
  return shadows;
}

export function shadowKey(strip, shadow) {
  return `shadow:${panelKey(strip, 'silhouette', '#000000')}:${shadow.height}:${shadow.flipped}`;
}

async function shadowImage(strip, shadow) {
  const key = shadowKey(strip, shadow);
  if (shadowCache.has(key)) return shadowCache.get(key);
  const work = (async () => {
    // Reuse the exact figure placement and alpha so shadows follow its profile.
    const panel = await panelImage(strip, 'silhouette', '#000000');
    const image = new Image(); image.src = panel.url; await image.decode();
    const canvas = makeCanvas(panel.width, Math.round(shadow.height * PX_PER_MM));
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.globalAlpha = .28;
    if (shadow.flipped) { ctx.translate(0, canvas.height); ctx.scale(1, -1); }
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return {key, url: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height};
  })();
  if (shadowCache.size >= 32) shadowCache.delete(shadowCache.keys().next().value);
  shadowCache.set(key, work);
  try { return await work; } catch (error) { shadowCache.delete(key); throw error; }
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

function fittedLabel(strip, maxPoints = 8) {
  if (!labelFont) throw Error('Nameplate font is not ready.');
  const point = 72 / 25.4, maxSize = maxPoints / point, minSize = 6 / point;
  const naturalWidth = labelFont.widthOfTextAtSize(strip.name, maxSize * point) / point;
  const size = Math.min(maxSize, maxSize * (strip.width - 2) / Math.max(naturalWidth, .01));
  if (size < minSize) throw Error(`${strip.art.name} base ${strip.copy}: name is too long for a readable label. Shorten it (minimum 6 pt).`);
  return {size, textWidth: labelFont.widthOfTextAtSize(strip.name, size * point) / point};
}

export async function prepareArtwork(layout) {
  if (layout.setup.nameplates) {
    await prepareLabelFont();
    for (const item of layout.pages.flat()) {
      if (item.kind === 'nameplate') fittedLabel(item, item.wrap ? 6 : 8);
      if (item.wrapTabs && item.art.kind !== 'Mounted') fittedLabel({art: item.art, copy: item.copy, name: item.labelName, width: item.baseWidth}, 6);
    }
  }
  const jobs = new Map();
  for (const page of layout.pages) for (const strip of page) for (const section of strip.sections) {
    if (section.kind === 'face' && section.variant !== 'blank') jobs.set(panelKey(strip, section.variant, layout.setup.silhouetteColor), [strip, section.variant, layout.setup.silhouetteColor]);
  }
  const results = new Map();
  // Decode one panel at a time to limit memory on phones.
  for (const [key, args] of jobs) results.set(key, await panelImage(...args));
  if (layout.setup.fakeShadows) {
    for (const strip of layout.pages.flat()) for (const section of strip.sections) {
      for (const shadow of groundShadows(strip, section)) {
        const key = shadowKey(strip, shadow);
        if (!results.has(key)) results.set(key, await shadowImage(strip, shadow));
      }
    }
  }
  if (layout.setup.figureBackground === 'gradient') {
    for (const strip of layout.pages.flat()) for (const section of strip.sections) {
      if (section.kind !== 'face') continue;
      const key = gradientKey(strip, section, layout.setup);
      if (results.has(key)) continue;
      const canvas = makeCanvas(2, Math.round(strip.panelHeight * PX_PER_MM)), ctx = canvas.getContext('2d');
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      const front = section.side === 'front';
      gradient.addColorStop(0, front ? layout.setup.gradientBottom : layout.setup.gradientTop);
      gradient.addColorStop(1, front ? layout.setup.gradientTop : layout.setup.gradientBottom);
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, canvas.width, canvas.height);
      results.set(key, {key, url: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height});
    }
  }
  return results;
}

export function gradientKey(strip, section, setup) {
  return `gradient:${strip.panelHeight}:${section.side}:${setup.gradientBottom}:${setup.gradientTop}`;
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
  const text = (value, x, y, size = 2, color = ink, rotation = 0) => ops.push({type: 'text', value, x, y, size, color, rotation});
  const line = (x, y, x2, y2, color = ink, thickness = .14, dash = []) => ops.push({type: 'line', x, y, x2, y2, color, thickness, dash});
  rect(0, 0, width, height, '#ffffff');
  text(`PAPER ARMY STANDEES / Foot 40 x 20 mm; cavalry 40 x ${setup.cavalryBaseDepth} mm; monsters 40 x ${setup.monstrosityBaseDepth} mm; heroes 20 x 20 mm`, margin, margin + 2, 2.7);
  text('Print at 100% / actual size. Cut solid outlines; fold dashed crests and dotted feet.', margin, margin + 6, 2);
  for (const strip of layout.pages[index]) {
    const {x: netX, y, sections} = strip, x = netX + (strip.bodyX || 0), w = strip.bodyWidth ?? strip.width;
    text(`${strip.art.shortName || strip.art.name} ${strip.copy}${strip.kind === 'nameplate' ? strip.wrap ? ' / ' + strip.edge + ' label' : ' / label' : ''}`, netX, strip.captionY, w === 20 ? 1.7 : 2);
    if (strip.kind === 'nameplate') {
      const {size, textWidth} = fittedLabel(strip, strip.wrap ? 6 : 8);
      rect(x, y, w, strip.height, '#ffffff', '#59645c');
      if (strip.wrap) {
        rect(x, y, w, 3, setup.groundColor);
        rect(x, y + 6, w, 3, setup.groundColor);
        if (setup.guides) for (const offset of [3, 6]) {
          line(x, y + offset, x + w, y + offset, '#ffffff', .35, [1.2, .8]);
          line(x, y + offset, x + w, y + offset, '#8f6333', .15, [1.2, .8]);
        }
        rect(x, y, w, strip.height, null, '#59645c');
      }
      text(strip.name, x + (w - textWidth) / 2, y + strip.height / 2 + size * .35, size, '#000000');
      continue;
    }
    for (const section of sections) {
      const sy = y + (strip.bodyY || 0) + section.y;
      if (section.kind === 'face' && setup.figureBackground === 'gradient') {
        ops.push({type: 'image', key: gradientKey(strip, section, setup), x, y: sy, w, h: section.height});
      } else rect(x, sy, w, section.height, section.kind === 'ground' ? setup.groundColor : setup.figureColor);
      if (setup.fakeShadows) for (const shadow of groundShadows(strip, section)) {
        ops.push({type: 'image', key: shadowKey(strip, shadow), x, y: y + (strip.bodyY || 0) + shadow.y, w, h: shadow.height});
      }
      if (section.kind === 'face' && section.variant !== 'blank') {
        ops.push({type: 'image', key: panelKey(strip, section.variant, setup.silhouetteColor), x, y: sy, w, h: section.height});
      }
    }
    if (setup.guides) for (const fold of strip.folds) {
      const mountain = fold.kind === 'mountain';
      // A white underlay keeps fine fold marks visible on dark setup colors.
      line(x, y + (strip.bodyY || 0) + fold.y, x + w, y + (strip.bodyY || 0) + fold.y, '#ffffff', .35, mountain ? [1.2, .8] : [.3, .6]);
      line(x, y + (strip.bodyY || 0) + fold.y, x + w, y + (strip.bodyY || 0) + fold.y, mountain ? '#8f6333' : '#517e94', .15, mountain ? [1.2, .8] : [.3, .6]);
    }
    if (!strip.wrapTabs) rect(x, y, w, strip.height, null, '#59645c');
    else {
      const guide = (ax, ay, bx, by) => {
        if (!setup.guides) return;
        line(ax, ay, bx, by, '#ffffff', .35, [1.2, .8]);
        line(ax, ay, bx, by, '#8f6333', .15, [1.2, .8]);
      };
      if (strip.art.kind === 'Mounted') {
        line(x, y, x + w, y, '#59645c');
        line(x, y + strip.height, x + w, y + strip.height, '#59645c');
        for (const section of sections) if (section.kind === 'face') {
          line(x, y + section.y, x, y + section.y + section.height, '#59645c');
          line(x + w, y + section.y, x + w, y + section.y + section.height, '#59645c');
        }
        for (const tab of strip.wrapTabs) {
          const tx = netX + tab.x, ty = y + tab.y, front = tab.edge === 'front';
          rect(tx, ty, tab.width, tab.height, setup.groundColor);
          line(tx, ty, tx + 10, ty, '#59645c');
          line(tx + (front ? 0 : 10), ty, tx + (front ? 0 : 10), ty + tab.height, '#59645c');
          line(tx + 10, ty + tab.height, tx, ty + tab.height, '#59645c');
          guide(tx + (front ? 10 : 0), ty, tx + (front ? 10 : 0), ty + tab.height);
          guide(tx + (front ? 7 : 3), ty, tx + (front ? 7 : 3), ty + tab.height);
        }
      } else {
        for (const tab of strip.wrapTabs) {
          const ty = y + tab.y, front = tab.edge === 'front';
          rect(x, ty, w, 10, setup.groundColor);
          const bandY = ty + (front ? 7 : 0);
          rect(x, bandY, w, 3, '#ffffff');
          const {size, textWidth} = fittedLabel({art: strip.art, copy: strip.copy, name: strip.labelName, width: w}, 6);
          text(strip.labelName, x + w / 2 + (front ? textWidth / 2 : -textWidth / 2),
            bandY + 1.5 + (front ? -1 : 1) * size * .35, size, '#000000', front ? 180 : 0);
          guide(x, ty + (front ? 10 : 0), x + w, ty + (front ? 10 : 0));
          guide(x, ty + (front ? 7 : 3), x + w, ty + (front ? 7 : 3));
        }
        rect(x, y, w, strip.height, null, '#59645c');
      }
    }
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
    if (op.type === 'text') return `<text x="${op.x}" y="${op.y}" transform="rotate(${op.rotation} ${op.x} ${op.y})" font-family="Helvetica,Arial,sans-serif" font-size="${op.size}" fill="${op.color}">${escape(op.value)}</text>`;
    return `<image x="${op.x}" y="${op.y}" width="${op.w}" height="${op.h}" preserveAspectRatio="none" href="${assets.get(op.key).url}"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${layout.height}" role="img" aria-label="Print sheet ${index + 1}">${elements.join('')}</svg>`;
}

export async function createPDF(layout, assets, progress = () => {}) {
  if (!layout.pages.length) throw Error('Choose at least one base to print.');
  if (!globalThis.PDFLib) throw Error('The PDF library did not load. Reload the page and check the vendor folder.');
  const {PDFDocument, StandardFonts, rgb, degrees} = globalThis.PDFLib;
  const doc = await PDFDocument.create(), font = await doc.embedFont(StandardFonts.Helvetica);
  doc.setTitle('Paper Army Standees'); doc.setCreator('Paper Army Standees workshop');
  doc.setSubject(`Foot 40 x 20 mm; cavalry 40 x ${layout.setup.cavalryBaseDepth} mm; Monstrosities 40 x ${layout.setup.monstrosityBaseDepth} mm; heroes 20 x 20 mm. Print at 100 percent / actual size.`);
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
        size: op.size * point, font, color: color(op.color), rotate: degrees(-op.rotation)});
      else {
        if (!embedded.has(op.key)) embedded.set(op.key, await doc.embedPng(assets.get(op.key).url));
        page.drawImage(embedded.get(op.key), {x: op.x * point, y: (layout.height - op.y - op.h) * point, width: op.w * point, height: op.h * point});
      }
    }
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  return doc.save();
}
