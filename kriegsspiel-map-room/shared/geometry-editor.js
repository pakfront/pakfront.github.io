'use strict';
const GeometryEditor = (() => {
  function handles(g) {
    if(g.type==='Point')return [{point:g.coordinates,ring:0,index:0}];
    const rings=g.type==='LineString'?[g.coordinates]:g.coordinates;
    return rings.flatMap((r,ring)=>(g.type==='Polygon'?r.slice(0,-1):r).map((point,index)=>({point,ring,index})));
  }
  function moveVertex(g,ring,index,p) {const n=Geometry.clone(g);if(n.type==='Point')n.coordinates=p;else{const r=n.type==='LineString'?n.coordinates:n.coordinates[ring];r[index]=p;if(n.type==='Polygon'&&index===0)r[r.length-1]=Geometry.clone(p);}return n;}
  function removeVertex(g,ring,index) {const n=Geometry.clone(g);if(n.type==='Point')throw Error('Delete the point feature instead.');const r=n.type==='LineString'?n.coordinates:n.coordinates[ring];if(r.length<=(n.type==='Polygon'?4:2))throw Error('Keep the minimum number of vertices.');r.splice(index,1);if(n.type==='Polygon'&&index===0)r[r.length-1]=Geometry.clone(r[0]);Geometry.validate(n);return n;}
  function insertVertex(g,p) {const n=Geometry.clone(g);let best=null;for(const s of Geometry.segments(g)){const q=Geometry.closest(s.a,s.b,p),d=Geometry.distance(q,p);if(!best||d<best.d)best={...s,q,d};}if(!best)throw Error('Point features have no segments.');const r=n.type==='LineString'?n.coordinates:n.coordinates[best.ring];r.splice(best.index+1,0,best.q);Geometry.validate(n);return n;}
  function snap(p,features,tolerance,grid=0,excludeId=null) {
    let result=p,best=tolerance,target=false;
    for(const f of features) {if(f.id===excludeId)continue;for(const q of Geometry.vertices(f.geometry)){const d=Geometry.distance(p,q);if(d<best){best=d;result=q;target=true;}}}
    if(!target)for(const f of features){if(f.id===excludeId)continue;for(const s of Geometry.segments(f.geometry)){const q=Geometry.closest(s.a,s.b,p),d=Geometry.distance(p,q);if(d<best){best=d;result=q;target=true;}}}
    if(!target&&grid>0){const q=p.map(v=>Math.round(v/grid)*grid);if(Geometry.distance(p,q)<tolerance){result=q;target=true;}}
    return {point:Geometry.clone(result),target};
  }
  return {handles,moveVertex,removeVertex,insertVertex,snap};
})();
