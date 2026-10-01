import {contingentTag, dimensions, formation, groupFor, pack, resolveUnit, resolved, validateProject} from './model.js';
import {zipSync} from '../vendor/fflate.js';

const images = new Map();
export async function loadImage(path) {
    if (images.has(path)) return images.get(path);
    const img = new Image(); img.src = path;
    await img.decode();
    if (img.width * img.height > 20_000_000) throw Error('Images must be at most 20 megapixels.');
    // Bound the decoded-image cache, especially after replacing imported assets.
    if (images.size >= 40) images.delete(images.keys().next().value);
    images.set(path, img); return img;
}
export function canvasBlob(canvas) {
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(Error('Could not encode the print image.')), 'image/png'));
}
function canvas(w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}
function fitImage(ctx, img, x, y, w, h, fit = 'contain') {
    if (fit === 'stretch') { ctx.drawImage(img, x, y, w, h); return; }
    const scale = Math[fit === 'cover' ? 'max' : 'min'](w / img.width, h / img.height);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.drawImage(img, x + (w - img.width * scale) / 2, y + (h - img.height * scale) / 2, img.width * scale, img.height * scale); ctx.restore();
}
// A 1024x1536 figure lands on the page about 100 px tall. Canvas resolves that in one
// step with too few samples per output pixel, so fine linework aliases into the speckled,
// gritty look that print exposes. Painting the artwork at a multiple of the output
// resolution and resolving it afterwards averages those samples properly instead.
async function supersampled(ctx, w, h, outW, outH, factor, paint) {
    // A wide base at 600 DPI is already 4 megapixels; keep the intermediate off the cliff
    // where the browser silently hands back a blank canvas.
    while (factor > 1 && outW * outH * factor * factor > 40_000_000) factor /= 2;
    // The offscreen canvas below is the base's own size, so anything crossing its edge is
    // cropped. Clip the direct path to match: without it, a figure past the safe area would
    // paint over the neighbouring base at Draft sampling and be cropped at every other setting.
    if (factor <= 1) {
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
        await paint(ctx);
        ctx.restore();
        return;
    }
    const big = canvas(outW * factor, outH * factor), bx = big.getContext('2d');
    bx.scale(big.width / w, big.height / h);
    await paint(bx);
    // Halve rather than reduce in one jump: a single large reduction undersamples the same
    // way the original draw did, one level up.
    let src = big;
    while (src.width > outW) {
        const step = canvas(Math.max(outW, src.width >> 1), Math.max(outH, src.height >> 1));
        step.getContext('2d').drawImage(src, 0, 0, step.width, step.height);
        src.width = src.height = 1; src = step;
    }
    // Copy onto the device pixels the base was snapped to. Going back through the
    // millimetre transform would land on a fractional offset and resample a second time,
    // which blurs away most of what the supersampling just bought.
    const t = ctx.getTransform();
    ctx.save(); ctx.setTransform(1, 0, 0, 1, t.e, t.f); ctx.drawImage(src, 0, 0); ctx.restore();
    src.width = src.height = 1;
}
// Labels print in a bundled face so a sheet looks the same whichever computer exports it. A
// missing font file falls back to the system sans-serif rather than failing the print.
const LABEL_FAMILY = 'Atkinson Hyperlegible';
let labelFontLoad;
function loadLabelFont() {
    labelFontLoad ??= new FontFace(LABEL_FAMILY, 'url(assets/fonts/AtkinsonHyperlegible-Bold.ttf)', {weight: 'bold'}).load()
        .then(face => { document.fonts.add(face); }).catch(() => {});
    return labelFontLoad;
}
function labelFont(size) {
    return `bold ${size}px "${LABEL_FAMILY}", sans-serif`;
}
// Canvas lays text out at the font's pixel size, and under the millimetre transform a 2 mm label
// is a 2 px font: every advance rounds to a whole pixel and the letters space erratically. Lay
// the text out large and scale it down instead.
const TEXT_SCALE = 64;
function measureText(ctx, text, size) {
    ctx.font = labelFont(size * TEXT_SCALE);
    return ctx.measureText(text).width / TEXT_SCALE;
}
function drawText(ctx, text, x, y, size, maxWidth = null) {
    ctx.save(); ctx.translate(x, y); ctx.scale(1 / TEXT_SCALE, 1 / TEXT_SCALE);
    ctx.font = labelFont(size * TEXT_SCALE);
    if (maxWidth === null) ctx.fillText(text, 0, 0); else ctx.fillText(text, 0, 0, maxWidth * TEXT_SCALE);
    ctx.restore();
}
// Fit a label into a width without squeezing the glyphs: shrink it first, then break it over two
// lines, and only compress it horizontally when neither leaves it readable. Two lines at 70% of
// the chosen size still fit the strip, which is 1.5 times that size tall.
export function fitLabel(ctx, text, width, size) {
    const measure = (value, s) => measureText(ctx, value, s);
    const floor = Math.min(size, Math.max(1, size * .7));
    const full = measure(text, size);
    if (full <= width) return {size, lines: [text]};
    // Text width is proportional to its size, so solve for the size that fits.
    if (size * width / full >= floor) return {size: size * width / full, lines: [text]};
    const words = text.split(/\s+/);
    let best = null;
    for (let i = 1; i < words.length; i++) {
        const lines = [words.slice(0, i).join(' '), words.slice(i).join(' ')];
        const widest = Math.max(...lines.map(line => measure(line, size)));
        const fitted = Math.min(size * .7, size * width / widest);
        if (!best || fitted > best.size) best = {size: fitted, lines};
    }
    if (best && best.size >= Math.min(1, floor)) return best;
    return {size: floor, lines: [text]};
}
function shade(hex, amount) {
    const channel = i => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - amount)).toString(16).padStart(2, '0');
    return `#${channel(1)}${channel(3)}${channel(5)}`;
}
function contrast(hex) {
    const channels = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
    return channels.reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0) > .179 ? '#000000' : '#ffffff';
}
export async function scene(p, unit, catalog) {
    const art = catalog.artwork.find(a => a.id === unit.artwork_id);
    if (!art) throw Error(`${unit.name}: choose replacement artwork.`);
    if (art.entity_kind !== unit.entity_kind) throw Error(`${unit.name}: artwork category does not match this unit.`);
    const [width, height] = dimensions(unit, p.basing), group = groupFor(p, unit);
    // Border/label markings apply army-wide; only the color drawn is per-contingent.
    const border = (group && p.print_settings.contingent_border) ? p.print_settings.contingent_border_width_mm : 0;
    // The label strip grows with its text, so a larger name takes room from the figures, not the edge.
    const s = p.print_settings;
    const stamina = s.stamina_style && s.stamina_style !== 'off' ? unit.stamina ?? null : null;
    const armour = s.show_armour ? unit.armour ?? null : null;
    // A tag only tells contingents apart, so a single-contingent army prints none. It stands on
    // its own: with colored labels off it is the one contingent mark on a neutral strip.
    const tag = group && s.contingent_tags && p.contingents.length > 1 ? contingentTag(p, group) : null;
    const labelHeight = (s.labels || (group && s.contingent_labels) || tag || stamina || armour) ? 1.5 * (s.label_font_mm ?? 2) : 0;
    const result = {width, height, group, border, labelHeight, tag, stamina, armour, art, unit, warnings: []};
    if (labelHeight) await loadLabelFont();
    if (art.mode === 'figures') {
        const loaded = new Map();
        for (const pose of art.variants) loaded.set(pose.path, await loadImage(pose.path));
        const f = formation(unit, p.basing, art.variants, loaded, Math.max(1, border + .4), labelHeight);
        result.figures = f.figures; result.images = loaded;
        if (f.overflow) result.warnings.push(`${unit.name}: figures cross the safe area. ` + (p.print_settings.allow_overflow
            ? 'Exporting anyway; anything past the base edge is cropped.'
            : 'Reduce scale, rows/columns or irregularity before export.'));
        result.overflow = f.overflow;
    } else {
        const variant = art.variants.find(v => v.id === unit.variant_id);
        if (!variant) throw Error(`${unit.name}: choose a replacement image variant.`);
        result.image = await loadImage(variant.path);
        if (Math.abs(result.image.width / result.image.height - width / height) > .1) result.warnings.push(`${unit.name}: full-unit artwork has a different aspect ratio; review the fit setting.`);
    }
    return result;
}
// Terrain and figures only. Labels, borders and cut lines are drawn at the output
// resolution instead, where a crisp 0.1 mm line and small type beat any smoothing.
// With bleed, ground and terrain run that far past every base edge so a slightly-off cut still
// shows artwork rather than white paper. Figures stay put inside the safe area.
async function drawArtwork(ctx, p, s, bleed = 0) {
    const left = -bleed, top = -bleed, width = s.width + 2 * bleed, height = s.height + 2 * bleed;
    ctx.fillStyle = p.terrain.color; ctx.fillRect(left, top, width, height);
    if (s.art.mode === 'figures') {
        if (p.terrain.image) {
            const img = await loadImage(p.terrain.image);
            // Keep the physical scale identical on every base; only tile (which can show a
            // seam) when a single crop at that scale can't cover an elongated or non-square base.
            const tileWidth = p.basing.frontage * (p.terrain.scale ?? 3);
            const physicalScale = tileWidth / img.width;
            const tileW = img.width * physicalScale, tileH = img.height * physicalScale;
            ctx.save(); ctx.beginPath(); ctx.rect(left, top, width, height); ctx.clip();
            const offset = (s.unit.formation.seed % 1000) / 1000;
            // Texture strength fades the image toward the ground color beneath it.
            ctx.globalAlpha = p.terrain.opacity ?? 1;
            if (tileW >= width && tileH >= height)
                ctx.drawImage(img, left - offset * (tileW - width), top - offset * (tileH - height), tileW, tileH);
            else
                for (let ty = top - offset * tileH; ty < top + height; ty += tileH)
                    for (let tx = left - offset * tileW; tx < left + width; tx += tileW) ctx.drawImage(img, tx, ty, tileW, tileH);
            // Tint recolors toward the ground color but keeps the texture's light and shade:
            // the "color" blend takes hue and saturation from the fill, luminosity from below.
            if (p.terrain.tint) {
                ctx.globalAlpha = p.terrain.tint;
                ctx.globalCompositeOperation = 'color';
                ctx.fillStyle = p.terrain.color; ctx.fillRect(left, top, width, height);
            }
            ctx.restore();
        }
        // Preview retains overflow for diagnosis; export refuses it too, unless the project
        // has turned the safe area off, in which case it prints as laid out.
        for (const f of s.figures) {
            ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.angle);
            ctx.drawImage(s.images.get(f.path), -f.width / 2, -f.height / 2, f.width, f.height); ctx.restore();
        }
    } else fitImage(ctx, s.image, s.border, s.border, s.width - 2 * s.border, s.height - 2 * s.border - s.labelHeight, p.print_settings.fit);
}
// A white badge with a black number: a disc for stamina, a shield for armour, so the two read
// apart at a glance. Returns the width it took.
function drawBadge(ctx, value, right, middle, h, shape) {
    const radius = h * .42, cx = right - radius;
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#000000'; ctx.lineWidth = .15;
    ctx.beginPath();
    if (shape === 'shield') {
        const top = middle - radius, halfWidth = radius * .9;
        ctx.moveTo(cx - halfWidth, top); ctx.lineTo(cx + halfWidth, top);
        ctx.lineTo(cx + halfWidth, middle);
        ctx.quadraticCurveTo(cx + halfWidth, middle + radius * .7, cx, middle + radius);
        ctx.quadraticCurveTo(cx - halfWidth, middle + radius * .7, cx - halfWidth, middle);
        ctx.closePath();
    } else ctx.arc(cx, middle, radius, 0, 2 * Math.PI);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#000000'; ctx.textAlign = 'center';
    // The shield's point takes the bottom of the badge, so its number sits a little higher.
    drawText(ctx, String(value), cx, middle + radius * (shape === 'shield' ? -.1 : .05), radius * (shape === 'shield' ? 1.15 : 1.3), radius * 1.6);
    return 2 * radius;
}
// The label strip, left to right: contingent tag, the name fitted into whatever room is left,
// armour as a shield, then stamina as a badge or a row of tick-off pips.
function drawLabel(ctx, p, s, bleed = 0) {
    const size = p.print_settings.label_font_mm ?? 2, h = s.labelHeight;
    const color = (s.group && p.print_settings.contingent_labels) ? s.group.color : '#f4f1e7', ink = contrast(color);
    const left = s.border, right = s.width - s.border, top = s.height - s.border - h, middle = top + h / 2, pad = .5;
    // Without a border the strip meets the cut, so it carries on into the bleed like the ground.
    const run = s.border ? 0 : bleed;
    ctx.fillStyle = color; ctx.fillRect(left - run, top, right - left + 2 * run, h + run);
    // A darker edge keeps a pale strip from melting into pale terrain.
    ctx.fillStyle = shade(color, .35); ctx.fillRect(left - run, top, right - left + 2 * run, .15);
    ctx.textBaseline = 'middle';
    let nameLeft = left + pad, nameRight = right - pad;
    if (s.tag) {
        ctx.textAlign = 'left'; ctx.fillStyle = ink;
        drawText(ctx, s.tag, nameLeft, middle, size);
        nameLeft += measureText(ctx, s.tag, size) + pad;
        ctx.fillRect(nameLeft, top + h * .2, .15, h * .6);
        nameLeft += .15 + pad;
    }
    if (s.stamina) {
        const pip = h * .45, step = pip * 1.3, pipsWidth = s.stamina * step;
        const armourWidth = s.armour ? h * .84 + pad : 0;
        // Pips only when they leave the name at least half the strip; otherwise the badge.
        if (p.print_settings.stamina_style === 'pips' && nameRight - pipsWidth - armourWidth - nameLeft >= (right - left) / 2) {
            // White with a dark ring on any strip color, so a pencil mark shows.
            ctx.strokeStyle = '#000000'; ctx.lineWidth = Math.max(.12, pip * .12); ctx.fillStyle = '#ffffff';
            for (let i = 0; i < s.stamina; i++) {
                ctx.beginPath(); ctx.arc(nameRight - pipsWidth + step * (i + .5), middle, pip / 2, 0, 2 * Math.PI);
                ctx.fill(); ctx.stroke();
            }
            nameRight -= pipsWidth + pad;
        } else nameRight -= drawBadge(ctx, s.stamina, nameRight, middle, h, 'disc') + pad;
    }
    if (s.armour) nameRight -= drawBadge(ctx, s.armour, nameRight, middle, h, 'shield') + pad;
    // A tag or stats alone give a strip even with names off; it then carries no name.
    if (!p.print_settings.labels && !(s.group && p.print_settings.contingent_labels)) return;
    const width = Math.max(1, nameRight - nameLeft), fit = fitLabel(ctx, s.unit.print_name || s.unit.name, width, size);
    ctx.textAlign = 'center'; ctx.fillStyle = ink;
    const lineHeight = fit.size * 1.05;
    fit.lines.forEach((line, i) => drawText(ctx, line, (nameLeft + nameRight) / 2, middle + (i - (fit.lines.length - 1) / 2) * lineHeight, fit.size, width));
}
// With bleed, a full outline would print on the sticker if the cut strays, so the guides become
// corner ticks that continue each edge out through the bleed that is trimmed away.
export function cornerTicks(width, height, bleed) {
    const ticks = [];
    for (const [x, dx] of [[0, -1], [width, 1]]) for (const [y, dy] of [[0, -1], [height, 1]])
        ticks.push([x, y, x + dx * bleed, y], [x, y, x, y + dy * bleed]);
    return ticks;
}
async function drawBase(ctx, p, s, x, y, marks = true, bleed = 0) {
    ctx.save();
    // Snap the base to whole device pixels and derive its scale from that footprint, so the
    // artwork resolves one-to-one and the label and border still line up with its edges.
    const m = ctx.getTransform();
    const left = Math.round(m.e + x * m.a), top = Math.round(m.f + y * m.d);
    const outW = Math.round(m.e + (x + s.width) * m.a) - left, outH = Math.round(m.f + (y + s.height) * m.d) - top;
    const sx = outW / s.width, sy = outH / s.height;
    // The bleed is snapped to whole pixels too, so the artwork box keeps the base's own scale.
    const bleedX = Math.round(bleed * sx), bleedY = Math.round(bleed * sy);
    ctx.setTransform(sx, 0, 0, sy, left - bleedX, top - bleedY);
    await supersampled(ctx, s.width + 2 * bleedX / sx, s.height + 2 * bleedY / sy, outW + 2 * bleedX, outH + 2 * bleedY,
        p.print_settings.supersample ?? 2, target => { target.translate(bleedX / sx, bleedY / sy); return drawArtwork(target, p, s, bleed); });
    ctx.setTransform(sx, 0, 0, sy, left, top);
    if (s.labelHeight) drawLabel(ctx, p, s, bleed);
    if (s.border) {
        // The border band widens outward to cover the bleed; on the base itself it is unchanged.
        ctx.strokeStyle = s.group.color; ctx.lineWidth = s.border + bleed;
        const inset = (s.border - bleed) / 2;
        ctx.strokeRect(inset, inset, s.width - 2 * inset, s.height - 2 * inset);
    }
    if (marks && p.print_settings.cut_lines && bleed) {
        ctx.strokeStyle = '#555555'; ctx.lineWidth = .1; ctx.beginPath();
        for (const [x1, y1, x2, y2] of cornerTicks(s.width, s.height, bleed)) { ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); }
        ctx.stroke();
    } else if (marks && p.print_settings.cut_lines && !s.border) {
        ctx.strokeStyle = '#999999'; ctx.lineWidth = .1; ctx.strokeRect(.05, .05, s.width - .1, s.height - .1);
    }
    ctx.restore();
}
export async function renderUnitPreview(p, unit, catalog, pixelWidth = 420) {
    const s = await scene(p, resolveUnit(p, unit), catalog), c = canvas(pixelWidth, Math.round(pixelWidth * s.height / s.width));
    const ctx = c.getContext('2d'); ctx.scale(c.width / s.width, c.height / s.height);
    await drawBase(ctx, p, s, 0, 0);
    return {canvas: c, warnings: s.warnings};
}
// A 50 mm bar in the bottom margin, so a print can be checked for 100% scale with a ruler
// before any base is cut. It needs room: a 5 mm margin and a page wider than the bar.
const SCALE_BAR_MM = 50;
export function scaleBarFits(p, size) {
    const margin = Math.max(p.print_settings.margin_mm, p.print_settings.bleed_mm ?? 0);
    return margin >= 5 && size[0] - 2 * margin >= SCALE_BAR_MM;
}
function drawScaleBar(ctx, p, size) {
    const margin = Math.max(p.print_settings.margin_mm, p.print_settings.bleed_mm ?? 0);
    const x = margin, y = size[1] - margin + 1.5;
    ctx.fillStyle = '#000000';
    ctx.fillRect(x, y, SCALE_BAR_MM, .3);
    for (let mm = 0; mm <= SCALE_BAR_MM; mm += 10) ctx.fillRect(x + mm - .075, y - .6, .15, mm % 50 ? 1.2 : 1.8);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    if (size[0] - 2 * margin >= SCALE_BAR_MM + 30) drawText(ctx, '50 mm at 100% scale', x + SCALE_BAR_MM + 1.5, y + .15, 1.6);
}
export async function renderPage(p, catalog, layout, index, dpi, strict = false, marks = true) {
    const scale = dpi / 25.4, c = canvas(Math.round(layout.size[0] * scale), Math.round(layout.size[1] * scale));
    const ctx = c.getContext('2d'); ctx.fillStyle = 'white'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.scale(c.width / layout.size[0], c.height / layout.size[1]);
    const warnings = [];
    for (const item of layout.pages[index]) {
        const s = await scene(p, item.unit, catalog);
        warnings.push(...s.warnings);
        if (strict && s.overflow) throw Error(s.warnings[0]);
        await drawBase(ctx, p, s, item.x, item.y, marks, p.print_settings.bleed_mm ?? 0);
    }
    if (p.print_settings.scale_bar) {
        if (scaleBarFits(p, layout.size)) { await loadLabelFont(); drawScaleBar(ctx, p, layout.size); }
        else warnings.push('Scale bar left out: it needs a margin of at least 5 mm.');
    }
    return {canvas: c, warnings};
}
export async function previewProject(project, catalog, stale = () => false) {
    // Templates are an editor and storage concept; everything below this line sees whole units.
    const p = resolved(validateProject(project)), layout = pack(p), urls = [], warnings = [];
    try {
        for (let i = 0; i < layout.pages.length; i++) {
            if (stale()) break;
            const result = await renderPage(p, catalog, layout, i, 90);
            urls.push(URL.createObjectURL(await canvasBlob(result.canvas))); warnings.push(...result.warnings);
            result.canvas.width = result.canvas.height = 1;
        }
        // Every project always has a contingent to hold units, even for someone who never
        // touches the feature; only nag about a missing commander once contingents are
        // actually in active use (more than just that default one).
        if (p.contingents.length > 1) for (const g of p.contingents) if (!g.commander_id) warnings.push(`${g.name}: choose a commanding leader when ready.`);
        return {pages: urls, warnings: [...new Set(warnings)], sticker_count: layout.pages.flat().length, unit_count: p.units.length};
    } catch (error) { urls.forEach(URL.revokeObjectURL); throw error; }
}
// PNG pHYs metadata: Canvas defaults to 96 DPI, so explicitly encode the selected print resolution.
function crc32(bytes) {
    let crc = -1;
    for (const b of bytes) { crc ^= b; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
    return (crc ^ -1) >>> 0;
}
export function pngResolution(bytes, dpi) {
    const chunk = new Uint8Array(21), view = new DataView(chunk.buffer);
    view.setUint32(0, 9); chunk.set([112, 72, 89, 115], 4);
    view.setUint32(8, Math.round(dpi / .0254)); view.setUint32(12, Math.round(dpi / .0254)); chunk[16] = 1;
    view.setUint32(17, crc32(chunk.subarray(4, 17)));
    const parts = [bytes.subarray(0, 8)]; let offset = 8;
    while (offset < bytes.length) {
        const len = new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0) + 12;
        const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
        if (type !== 'pHYs') parts.push(bytes.subarray(offset, offset + len));
        if (type === 'IHDR') parts.push(chunk);
        offset += len;
    }
    const output = new Uint8Array(parts.reduce((n, part) => n + part.length, 0)); offset = 0;
    for (const part of parts) { output.set(part, offset); offset += part.length; }
    return output;
}
export async function exportProject(project, catalog, kind, progress = () => {}, cancelled = () => false) {
    const p = resolved(validateProject(project)), layout = pack(p);
    if (!layout.pages.length) throw Error(p.units.length ? 'Select at least one base to print.' : 'Add a unit before exporting.');
    const pixelCount = Math.round(layout.size[0] * p.print_settings.dpi / 25.4) * Math.round(layout.size[1] * p.print_settings.dpi / 25.4);
    if (pixelCount * layout.pages.length > 120_000_000) throw Error('Export too large. Reduce DPI or split this army into smaller projects.');
    const doc = kind === 'pdf' ? await globalThis.PDFLib.PDFDocument.create() : null, files = {};
    if (doc) doc.setTitle(p.title);
    for (let i = 0; i < layout.pages.length; i++) {
        if (cancelled()) throw Error('Export cancelled.');
        progress(`Rendering page ${i + 1} of ${layout.pages.length}…`);
        await new Promise(resolve => setTimeout(resolve, 0));
        const result = await renderPage(p, catalog, layout, i, p.print_settings.dpi, !p.print_settings.allow_overflow, !doc);
        const bytes = new Uint8Array(await (await canvasBlob(result.canvas)).arrayBuffer());
        result.canvas.width = result.canvas.height = 1;
        if (doc) {
            const pt = 72 / 25.4, page = doc.addPage(layout.size.map(mm => mm * pt));
            const image = await doc.embedPng(bytes);
            page.drawImage(image, {x: 0, y: 0, width: layout.size[0] * pt, height: layout.size[1] * pt});
            const bleed = p.print_settings.bleed_mm ?? 0;
            if (p.print_settings.cut_lines) for (const item of layout.pages[i]) {
                if (bleed) {
                    for (const [x1, y1, x2, y2] of cornerTicks(item.width, item.height, bleed))
                        page.drawLine({start: {x: (item.x + x1) * pt, y: (layout.size[1] - item.y - y1) * pt},
                            end: {x: (item.x + x2) * pt, y: (layout.size[1] - item.y - y2) * pt},
                            thickness: .1 * pt, color: globalThis.PDFLib.rgb(.33, .33, .33)});
                    continue;
                }
                // A contingent border already marks the edge, as it does on the PNG sheets.
                if (p.print_settings.contingent_border && groupFor(p, item.unit)) continue;
                page.drawRectangle({x: (item.x + .05) * pt, y: (layout.size[1] - item.y - item.height + .05) * pt,
                    width: (item.width - .1) * pt, height: (item.height - .1) * pt,
                    borderWidth: .1 * pt, borderColor: globalThis.PDFLib.rgb(.6, .6, .6)});
            }
        } else files[`sheet-${String(i + 1).padStart(2, '0')}.png`] = pngResolution(bytes, p.print_settings.dpi);
    }
    if (cancelled()) throw Error('Export cancelled.');
    return doc ? new Blob([await doc.save()], {type: 'application/pdf'}) : new Blob([zipSync(files, {level: 0})], {type: 'application/zip'});
}
