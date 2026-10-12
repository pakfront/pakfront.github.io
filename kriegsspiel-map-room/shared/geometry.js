'use strict';
const Geometry = (() => {
  const clone = v => JSON.parse(JSON.stringify(v));
  const equal = (a,b) => a[0]===b[0] && a[1]===b[1];
  const distance = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1]);
  const cross = (a,b,c) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const onSegment = (a,b,p) => Math.abs(cross(a,b,p))<1e-8 && p[0]>=Math.min(a[0],b[0])-1e-8 && p[0]<=Math.max(a[0],b[0])+1e-8 && p[1]>=Math.min(a[1],b[1])-1e-8 && p[1]<=Math.max(a[1],b[1])+1e-8;
  function intersects(a,b,c,d) {
    const x=cross(a,b,c),y=cross(a,b,d),z=cross(c,d,a),w=cross(c,d,b);
    return (x*y<0 && z*w<0)||onSegment(a,b,c)||onSegment(a,b,d)||onSegment(c,d,a)||onSegment(c,d,b);
  }
  function area(ring) { let sum=0; for(let i=0;i<ring.length-1;i++) sum+=ring[i][0]*ring[i+1][1]-ring[i+1][0]*ring[i][1]; return sum/2; }
  function contains(ring,p) {
    let inside=false;
    for(let i=0,j=ring.length-2;i<ring.length-1;j=i++) {
      const a=ring[i],b=ring[j]; if(onSegment(a,b,p))return true;
      if((a[1]>p[1])!==(b[1]>p[1]) && p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
    } return inside;
  }
  function pointInPolygon(g,p) { return contains(g.coordinates[0],p) && !g.coordinates.slice(1).some(r=>contains(r,p)); }
  function validate(g) {
    if(!g || !['Point','LineString','Polygon'].includes(g.type) || Object.keys(g).some(k=>!['type','coordinates'].includes(k)))throw Error('Unsupported geometry.');
    const point=p=>Array.isArray(p)&&p.length===2&&p.every(n=>typeof n==='number'&&Number.isFinite(n));
    if(g.type==='Point'){if(!point(g.coordinates))throw Error('Invalid point coordinates.');return g;}
    const rings=g.type==='Polygon'?g.coordinates:[g.coordinates];
    if(!Array.isArray(rings)||!rings.length)throw Error('Geometry needs coordinates.');
    for(const r of rings) {
      if(!Array.isArray(r)||r.length<(g.type==='Polygon'?4:2)||!r.every(point))throw Error('Not enough valid vertices.');
      if(r.some((p,i)=>i>0&&equal(p,r[i-1])))throw Error('Adjacent vertices must be distinct.');
      if(g.type==='Polygon') {
        if(!equal(r[0],r.at(-1))||Math.abs(area(r))<1e-8)throw Error('Polygon rings must be closed with a nonzero area.');
        for(let i=0;i<r.length-1;i++)for(let j=i+1;j<r.length-1;j++) {
          if(j===i+1||(i===0&&j===r.length-2))continue;
          if(intersects(r[i],r[i+1],r[j],r[j+1]))throw Error('Polygon edges cannot cross or touch themselves.');
        }
        for(let i=0;i<r.length-1;i++) {
          const prev=r[(i+r.length-2)%(r.length-1)],next=r[i+1];
          if(Math.abs(cross(prev,r[i],next))<1e-8 && onSegment(prev,r[i],next))throw Error('Polygon edges cannot fold back.');
        }
      }
    }
    if(g.type==='Polygon')for(let h=1;h<rings.length;h++) {
      if(!contains(rings[0],rings[h][0]))throw Error('A hole must be inside its polygon.');
      for(let j=0;j<h;j++) {
        for(let a=0;a<rings[h].length-1;a++)for(let b=0;b<rings[j].length-1;b++)if(intersects(rings[h][a],rings[h][a+1],rings[j][b],rings[j][b+1]))throw Error('Polygon rings cannot intersect.');
        if(j>0&&(contains(rings[j],rings[h][0])||contains(rings[h],rings[j][0])))throw Error('Polygon holes cannot overlap.');
      }
    }
    return g;
  }
  function fromPoints(type,points) {
    const p=clone(points); if(type==='Point')return {type,coordinates:p[0]};
    if(type==='Polygon'){if(p.length && !equal(p[0],p.at(-1)))p.push(clone(p[0]));return {type,coordinates:[p]};}
    return {type,coordinates:p};
  }
  function normalize(g) {
    validate(g);const result=clone(g);
    if(g.type==='Polygon')result.coordinates.forEach((r,i)=>{if((area(r)>0)!==(i===0))r.reverse();});
    return result;
  }
  function vertices(g) {return g.type==='Point'?[g.coordinates]:g.type==='LineString'?g.coordinates:g.coordinates.flatMap(r=>r.slice(0,-1));}
  function segments(g) {const rings=g.type==='Point'?[]:g.type==='LineString'?[g.coordinates]:g.coordinates;return rings.flatMap((r,ring)=>r.slice(0,-1).map((p,index)=>({a:p,b:r[index+1],ring,index})));}
  function translate(g,dx,dy) {const result=clone(g); const move=p=>{p[0]+=dx;p[1]+=dy;};if(g.type==='Point')move(result.coordinates);else if(g.type==='LineString')result.coordinates.forEach(move);else result.coordinates.forEach(r=>r.forEach(move));return result;}
  function closest(a,b,p) {const dx=b[0]-a[0],dy=b[1]-a[1],d=dx*dx+dy*dy,t=d?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/d)):0;return [a[0]+t*dx,a[1]+t*dy];}
  const length=g=>segments(g).reduce((n,s)=>n+distance(s.a,s.b),0);
  const center=g=>{const v=vertices(g);return [v.reduce((n,p)=>n+p[0],0)/v.length,v.reduce((n,p)=>n+p[1],0)/v.length];};
  return {clone,equal,distance,validate,normalize,fromPoints,vertices,segments,translate,closest,length,center,pointInPolygon};
})();
