'use strict';
const MapRenderer = (() => {
  const NS='http://www.w3.org/2000/svg';
  function node(tag,attrs,parent){const n=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,String(v));parent.append(n);return n;}
  function text(parent,p,value,size=18){const n=node('text',{x:p[0],y:p[1],'text-anchor':'middle','font-family':'Georgia','font-size':size,style:`font-size:${size}px`,fill:'#263b2d',stroke:'#fff6dc','stroke-width':3,'paint-order':'stroke'},parent);n.textContent=value;return n;}
  function feature(parent,f,{interactive=false,selected=false}={}) {
    const g=node('g',interactive?{'data-feature':f.id}:{},parent),s=f.style,geo=f.geometry;
    const attrs={stroke:s.stroke,'stroke-width':s.strokeWidth,fill:'none','stroke-linejoin':'round','stroke-linecap':'round'};
    if(s.dashed)attrs['stroke-dasharray']='9 6';
    if(geo.type==='Polygon') {
      const d=geo.coordinates.map(r=>'M'+r.map(p=>p.join(' ')).join(' L')+' Z').join(' ');
      node('path',{...attrs,d,fill:s.fill,'fill-opacity':s.opacity,'fill-rule':'evenodd'},g);
    } else if(geo.type==='LineString') {
      node('polyline',{...attrs,points:geo.coordinates.map(p=>p.join(',')).join(' '),opacity:s.opacity},g);
      if(interactive)node('polyline',{points:geo.coordinates.map(p=>p.join(',')).join(' '),fill:'none',stroke:'transparent','stroke-width':Math.max(s.strokeWidth,14),'vector-effect':'non-scaling-stroke'},g);
      if(f.subtype==='arrow'){const p=geo.coordinates.at(-1),a=geo.coordinates.at(-2),angle=Math.atan2(p[1]-a[1],p[0]-a[0]),size=Math.max(12,s.strokeWidth*3);node('path',{d:`M${p[0]-size*Math.cos(angle-.45)} ${p[1]-size*Math.sin(angle-.45)} L${p.join(' ')} L${p[0]-size*Math.cos(angle+.45)} ${p[1]-size*Math.sin(angle+.45)}`,fill:'none',stroke:s.stroke,'stroke-width':s.strokeWidth},g);}
      if(f.subtype==='railroad')node('polyline',{points:geo.coordinates.map(p=>p.join(',')).join(' '),fill:'none',stroke:s.stroke,'stroke-width':s.strokeWidth+5,'stroke-dasharray':'2 12'},g);
    } else if(f.subtype!=='label') {
      const p=geo.coordinates;node('rect',{x:p[0]-9,y:p[1]-9,width:18,height:18,rx:f.subtype==='landmark'?9:2,fill:s.fill,stroke:s.stroke,'stroke-width':2,opacity:s.opacity},g);
      if(['bridge','gate','ford'].includes(f.subtype))text(g,[p[0],p[1]+4],{bridge:'B',gate:'G',ford:'F'}[f.subtype],12);
    }
    if(f.name || f.category==='elevation') {
      const p=f.category==='elevation'?[(geo.coordinates[0][0][0]+geo.coordinates[0][1][0])/2,(geo.coordinates[0][0][1]+geo.coordinates[0][1][1])/2-s.fontSize]:Geometry.center(geo),label=f.category==='elevation'?`${f.name} (${f.properties.relativeHeightMeters>=0?'+':''}${f.properties.relativeHeightMeters} m)`:f.name;
      text(g,[p[0],p[1]+(geo.type==='Point'&&f.subtype!=='label'?28:0)],label,s.fontSize);
    }
    return g;
  }
  function render(parent,d,{interactive=false,hidden=new Set(),selectedId=null}={}) {
    parent.replaceChildren();const c=d.coordinateSystem;
    node('rect',{width:c.width,height:c.height,fill:'#faf4e4'},parent);
    if(d.background){const b=d.background;node('image',{href:b.data,x:b.x,y:b.y,width:b.width,height:b.height},parent);}
    for(const l of d.layers.slice().sort((a,b)=>a.order-b.order)){if(hidden.has(l.id))continue;const g=node('g',{'data-layer':l.id},parent);for(const f of d.features.filter(f=>f.layerId===l.id))feature(g,f,{interactive,selected:f.id===selectedId});}
  }
  return {node,text,feature,render};
})();
