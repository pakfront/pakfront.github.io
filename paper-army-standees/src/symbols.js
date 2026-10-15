// Small solid emblems use polygons so screen previews and PDFs stay crisp.
const stroke = (points, width = 1.3) => points.slice(1).map((b, i) => {
  const a = points[i], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = (b[1] - a[1]) / length * width / 2, dy = (a[0] - b[0]) / length * width / 2;
  return {points: [[a[0]+dx,a[1]+dy],[b[0]+dx,b[1]+dy],[b[0]-dx,b[1]-dy],[a[0]-dx,a[1]-dy]]};
});
const polygon = (points, cutout = false) => ({points, cutout});
const tree = [
  ...stroke([[5,9],[5,1]], 1.2),
  ...stroke([[1,4],[3,5],[5,4],[7,5],[9,4]], 1.1),
  ...stroke([[2,1.8],[3,3],[5,2],[7,3],[8,1.8]], 1.1),
  polygon([[2.5,9],[5,7.5],[7.5,9]]),
];
const horse = [polygon([[2,9],[2.8,5.8],[1,5],[1,3.8],[3.2,2],[3.4,.6],[4.8,1.7],[6,1],[7.8,2.8],[8.6,5.5],[8.6,9]]),
  polygon([[2.3,4],[3.2,3.5],[3.3,4.3]], true)];
const eye = [polygon([[.5,5],[2.5,2.6],[5,1.8],[7.5,2.6],[9.5,5],[7.5,7.4],[5,8.2],[2.5,7.4]]),
  polygon([[2,5],[3.5,3.8],[5,3.2],[6.5,3.8],[8,5],[6.5,6.2],[5,6.8],[3.5,6.2]], true),
  polygon([[5,2.8],[6,5],[5,7.2],[4,5]])];
const hand = [polygon([[3.2,9.2],[2.8,6.8],[.8,4.4],[1.6,3.6],[3,4.8],[2.4,1.6],[3.5,1.4],[4.1,4.3],[4,.5],[5.2,.5],[5.4,4.2],[6,.9],[7.1,1.1],[6.8,4.5],[7.8,2.2],[8.8,2.7],[7.5,6.7],[7,9.2]])];
const snake = [...stroke([[2,8.6],[7.7,8.6],[8.4,6.5],[2.5,4.9],[2,2.7],[6.8,2.7]], 1.5),
  polygon([[6,1.2],[9.2,2.5],[6,4]])];
const axe = [...stroke([[2,9],[7,1]], 1.5), polygon([[3.5,2.3],[5.2,.7],[6.7,1.2],[9.2,3],[8,5],[5.4,3.3]])];
const spear = [polygon([[4.2,9.4],[5.8,9.4],[5.8,4.7],[8.5,5.2],[5,.5],[1.5,5.2],[4.2,4.7]])];
const star = [polygon(Array.from({length:10}, (_,i) => {
  const angle = -Math.PI/2+i*Math.PI/5, radius=i%2 ? 2 : 4.6;
  return [5+Math.cos(angle)*radius,5+Math.sin(angle)*radius];
}))];
const sabres = [...stroke([[1.5,1],[8.5,8]], 1.4), ...stroke([[8.5,1],[1.5,8]], 1.4),
  ...stroke([[5.8,8.5],[8.8,5.5]], 1), ...stroke([[1.2,5.5],[4.2,8.5]], 1)];
const eagle = [polygon([[5,.6],[6.3,2.2],[5.8,3.4],[9.5,1.6],[8.8,5],[6.2,5.8],[7.5,9],[5,7.8],[2.5,9],[3.8,5.8],[1.2,5],[.5,1.6],[4.2,3.4],[4,1.4]])];
const tower = [polygon([[1,9],[1,7.7],[2,7.7],[2,1],[3.5,1],[3.5,2.5],[4.3,2.5],[4.3,1],[5.7,1],[5.7,2.5],[6.5,2.5],[6.5,1],[8,1],[8,7.7],[9,7.7],[9,9]]),
  polygon([[4,9],[4,6],[5,5.4],[6,6],[6,9]], true)];

export const factionSymbols = {
  'middle-earth-third-age': {
    Gondor: {name: 'Tree', shapes: tree}, Rohan: {name: 'Horse head', shapes: horse},
    Mordor: {name: 'Eye', shapes: eye}, Isengard: {name: 'Hand', shapes: hand},
    Harad: {name: 'Serpent', shapes: snake}, Orcs: {name: 'Axe', shapes: axe}, Goblins: {name: 'Spearhead', shapes: spear},
  },
  'american-civil-war': {USA: {name: 'Star', shapes: star}, CSA: {name: 'Crossed sabres', shapes: sabres}},
  napoleonic: {French: {name: 'Eagle', shapes: eagle}, Spanish: {name: 'Tower', shapes: tower}},
};

// Coordinates are relative to the strip body; tabs never change this placement.
export function groundSymbol(strip, setup) {
  if (!setup.factionSymbols || strip.kind === 'nameplate' || strip.rearDepth) return null;
  const symbol = factionSymbols[strip.art.era]?.[strip.art.faction];
  if (!symbol) return null;
  const grounds = strip.sections.filter(s => s.kind === 'ground');
  const mounted = strip.art.kind === 'Mounted';
  const internal = grounds.slice(1, -1);
  const section = mounted && internal.length ? internal[Math.floor((internal.length - 1) / 2)] : grounds.at(-1);
  if (!section) return null;
  const size = Math.min(8, (strip.bodyWidth ?? strip.width) - 1.2, section.height - 1.2);
  if (size < 3) return null;
  return {symbol, section, size, x: ((strip.bodyWidth ?? strip.width) - size) / 2,
    y: section.y + (section.height - size) / 2, rotation: mounted ? 90 : 0};
}

export function symbolPolygons(mark, x, y, foreground, background) {
  return mark.symbol.shapes.map(shape => ({type: 'polygon', symbol: mark.symbol.name,
    fill: shape.cutout ? background : foreground,
    points: shape.points.map(([px, py]) => {
      if (mark.rotation === 90) [px, py] = [10 - py, px];
      return [x + px / 10 * mark.size, y + py / 10 * mark.size];
    })}));
}
