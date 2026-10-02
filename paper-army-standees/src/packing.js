// Physical layout is in millimetres. Keep this separate from artwork rendering.
export function paperSize(paper, orientation) {
  const size = paper === 'letter' ? [215.9, 279.4] : [210, 297];
  return orientation === 'landscape' ? size.reverse() : size;
}

export function pack(items, {paper = 'a4', orientation = 'portrait', margin = 10, gap = 4} = {}) {
  const [width, height] = paperSize(paper, orientation);
  // Reserve space for page title, strip captions, and a calibration rule.
  const top = margin + 9, bottom = height - margin - 9, caption = 4;
  const usableWidth = width - 2 * margin;
  const pages = [];
  let placements = [], x = margin, y = top, shelfHeight = 0;
  const finish = () => { if (placements.length) pages.push(placements); placements = []; };
  for (const item of [...items].sort((a, b) => b.height - a.height || b.width - a.width)) {
    if (!(item.width > 0 && item.height > 0) || !Number.isFinite(item.width + item.height)) throw Error('Invalid strip dimensions.');
    if (item.width > usableWidth || item.height + caption > bottom - top) {
      throw Error(`${item.name}: the unfolded strip does not fit this paper. Reduce the number of ranks or panel height, or change orientation.`);
    }
    if (x + item.width > width - margin + 1e-8) { x = margin; y += shelfHeight + gap; shelfHeight = 0; }
    if (y + caption + item.height > bottom + 1e-8) { finish(); x = margin; y = top; shelfHeight = 0; }
    placements.push({...item, x, y: y + caption, captionY: y + 2.5});
    shelfHeight = Math.max(shelfHeight, item.height + caption);
    x += item.width + gap;
  }
  finish();
  return {width, height, pages, margin};
}
