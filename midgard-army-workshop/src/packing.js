// Physical layout is in millimetres. Keep this separate from artwork rendering.
export function paperSize(paper, orientation) {
  const size = paper === 'letter' ? [215.9, 279.4] : [210, 297];
  return orientation === 'landscape' ? size.reverse() : size;
}

export function pack(items, {paper = 'letter', orientation = 'portrait', margin = 10, gap = 4} = {}) {
  const [width, height] = paperSize(paper, orientation);
  // Reserve space for page title, strip captions, and a calibration rule.
  const top = margin + 9, bottom = height - margin - 9, caption = 4;
  const usableWidth = width - 2 * margin;
  const sorted = [...items].sort((a, b) => b.height - a.height || b.width - a.width);
  for (const item of sorted) {
    if (!(item.width > 0 && item.height > 0) || !Number.isFinite(item.width + item.height)) throw Error('Invalid strip dimensions.');
    if (item.width > usableWidth || item.height + caption > bottom - top) {
      throw Error(`${item.name}: the unfolded strip does not fit this paper. Reduce the number of ranks or panel height, or change orientation.`);
    }
  }
  const pages = [];
  let placements = [], x = margin, y = top, shelfHeight = 0;
  const finish = () => { if (placements.length) pages.push(placements); placements = []; };
  for (const item of sorted) {
    if (x + item.width > width - margin + 1e-8) { x = margin; y += shelfHeight + gap; shelfHeight = 0; }
    if (y + caption + item.height > bottom + 1e-8) { finish(); x = margin; y = top; shelfHeight = 0; }
    placements.push({...item, x, y: y + caption, captionY: y + 2.5});
    shelfHeight = Math.max(shelfHeight, item.height + caption);
    x += item.width + gap;
  }
  finish();
  // Keep the row layout as a candidate: the new heuristics cannot add sheets.
  const candidates = [pages];
  const orders = [sorted,
    [...items].sort((a, b) => b.width * (b.height + caption) - a.width * (a.height + caption) || b.height - a.height),
    [...items].sort((a, b) => b.width - a.width || b.height - a.height)];
  for (const order of orders) for (const strategy of ['shortSide', 'area'])
    candidates.push(packFreeRectangles(order, {margin, top, caption, gap, usableWidth, usableHeight: bottom - top}, strategy));
  const extent = candidate => candidate.reduce((sum, page) => sum + Math.max(...page.map(p => p.y + p.height)) - top, 0);
  candidates.sort((a, b) => a.length - b.length || extent(a) - extent(b));
  return {width, height, pages: candidates[0], margin};
}

const EPSILON = 1e-8;

// Free rectangles may overlap each other; every placement splits all of them,
// so the remaining free space never overlaps a printed item or its caption.
function packFreeRectangles(items, {margin, top, caption, gap, usableWidth, usableHeight}, strategy) {
  const sheets = [];
  for (const item of items) {
    const w = item.width + gap, h = item.height + caption + gap;
    let best;
    for (const [pageIndex, sheet] of sheets.entries()) for (const free of sheet.free) {
      if (w > free.w + EPSILON || h > free.h + EPSILON) continue;
      const dx = Math.max(0, free.w - w), dy = Math.max(0, free.h - h);
      const score = strategy === 'area'
        ? [free.w * free.h - w * h, Math.min(dx, dy), pageIndex, free.y, free.x]
        : [Math.min(dx, dy), Math.max(dx, dy), pageIndex, free.y, free.x];
      if (!best || less(score, best.score)) best = {sheet, free, score};
    }
    if (!best) {
      const free = {x: margin, y: top, w: usableWidth + gap, h: usableHeight + gap};
      const sheet = {free: [free], items: []}; sheets.push(sheet);
      best = {sheet, free};
    }
    const {sheet, free} = best, used = {x: free.x, y: free.y, w, h};
    sheet.items.push({...item, x: used.x, y: used.y + caption, captionY: used.y + 2.5});
    const remaining = [];
    for (const r of sheet.free) {
      if (used.x >= r.x + r.w - EPSILON || used.x + w <= r.x + EPSILON ||
          used.y >= r.y + r.h - EPSILON || used.y + h <= r.y + EPSILON) { remaining.push(r); continue; }
      if (used.x > r.x + EPSILON) remaining.push({...r, w: used.x - r.x});
      if (used.x + w < r.x + r.w - EPSILON) remaining.push({...r, x: used.x + w, w: r.x + r.w - used.x - w});
      if (used.y > r.y + EPSILON) remaining.push({...r, h: used.y - r.y});
      if (used.y + h < r.y + r.h - EPSILON) remaining.push({...r, y: used.y + h, h: r.y + r.h - used.y - h});
    }
    sheet.free = remaining.filter((r, i) => !remaining.some((other, j) => j !== i &&
      other.x <= r.x + EPSILON && other.y <= r.y + EPSILON &&
      other.x + other.w >= r.x + r.w - EPSILON && other.y + other.h >= r.y + r.h - EPSILON &&
      (j < i || other.w * other.h > r.w * r.h + EPSILON)));
  }
  return sheets.map(sheet => sheet.items);
}

function less(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i] - b[i]) > EPSILON) return a[i] < b[i];
  }
  return false;
}
