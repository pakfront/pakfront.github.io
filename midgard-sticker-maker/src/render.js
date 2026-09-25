import {dimensions, formation, groupFor, pack, resolveUnit, resolved, validateProject} from './model.js';
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
    const labelHeight = (p.print_settings.labels || (group && p.print_settings.contingent_labels)) ? 3 : 0;
    const result = {width, height, group, border, labelHeight, art, unit, warnings: []};
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
async function drawArtwork(ctx, p, s) {
    ctx.fillStyle = p.terrain.color; ctx.fillRect(0, 0, s.width, s.height);
    if (s.art.mode === 'figures') {
        if (p.terrain.image) {
            const img = await loadImage(p.terrain.image);
            // Keep the physical scale identical on every base; only tile (which can show a
            // seam) when a single crop at that scale can't cover an elongated or non-square base.
            const tileWidth = p.basing.frontage * (p.terrain.scale ?? 3);
            const physicalScale = tileWidth / img.width;
            const tileW = img.width * physicalScale, tileH = img.height * physicalScale;
            ctx.save(); ctx.beginPath(); ctx.rect(0, 0, s.width, s.height); ctx.clip();
            const offset = (s.unit.formation.seed % 1000) / 1000;
            if (tileW >= s.width && tileH >= s.height)
                ctx.drawImage(img, -offset * (tileW - s.width), -offset * (tileH - s.height), tileW, tileH);
            else
                for (let ty = -offset * tileH; ty < s.height; ty += tileH)
                    for (let tx = -offset * tileW; tx < s.width; tx += tileW) ctx.drawImage(img, tx, ty, tileW, tileH);
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
async function drawBase(ctx, p, s, x, y, marks = true) {
    ctx.save();
    // Snap the base to whole device pixels and derive its scale from that footprint, so the
    // artwork resolves one-to-one and the label and border still line up with its edges.
    const m = ctx.getTransform();
    const left = Math.round(m.e + x * m.a), top = Math.round(m.f + y * m.d);
    const outW = Math.round(m.e + (x + s.width) * m.a) - left, outH = Math.round(m.f + (y + s.height) * m.d) - top;
    ctx.setTransform(outW / s.width, 0, 0, outH / s.height, left, top);
    await supersampled(ctx, s.width, s.height, outW, outH, p.print_settings.supersample ?? 2, target => drawArtwork(target, p, s));
    if (s.labelHeight) {
        const color = (s.group && p.print_settings.contingent_labels) ? s.group.color : '#f4f1e7';
        ctx.fillStyle = color; ctx.fillRect(s.border, s.height - s.border - s.labelHeight, s.width - 2 * s.border, s.labelHeight);
        ctx.fillStyle = contrast(color); ctx.font = '2px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(s.unit.name, s.width / 2, s.height - s.border - s.labelHeight / 2, Math.max(1, s.width - 2 * s.border - 1));
    }
    if (s.border) {
        ctx.strokeStyle = s.group.color; ctx.lineWidth = s.border;
        ctx.strokeRect(s.border / 2, s.border / 2, s.width - s.border, s.height - s.border);
    } else if (marks && p.print_settings.cut_lines) {
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
export async function renderPage(p, catalog, layout, index, dpi, strict = false, marks = true) {
    const scale = dpi / 25.4, c = canvas(Math.round(layout.size[0] * scale), Math.round(layout.size[1] * scale));
    const ctx = c.getContext('2d'); ctx.fillStyle = 'white'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.scale(c.width / layout.size[0], c.height / layout.size[1]);
    const warnings = [];
    for (const item of layout.pages[index]) {
        const s = await scene(p, item.unit, catalog);
        warnings.push(...s.warnings);
        if (strict && s.overflow) throw Error(s.warnings[0]);
        await drawBase(ctx, p, s, item.x, item.y, marks);
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
        return {pages: urls, warnings: [...new Set(warnings)], sticker_count: p.units.length};
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
    if (!layout.pages.length) throw Error('Add a unit before exporting.');
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
            if (p.print_settings.cut_lines) for (const item of layout.pages[i]) {
                if (groupFor(p, item.unit)?.border) continue;
                page.drawRectangle({x: (item.x + .05) * pt, y: (layout.size[1] - item.y - item.height + .05) * pt,
                    width: (item.width - .1) * pt, height: (item.height - .1) * pt,
                    borderWidth: .1 * pt, borderColor: globalThis.PDFLib.rgb(.6, .6, .6)});
            }
        } else files[`sheet-${String(i + 1).padStart(2, '0')}.png`] = pngResolution(bytes, p.print_settings.dpi);
    }
    if (cancelled()) throw Error('Export cancelled.');
    return doc ? new Blob([await doc.save()], {type: 'application/pdf'}) : new Blob([zipSync(files, {level: 0})], {type: 'application/zip'});
}
