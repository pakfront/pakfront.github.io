'use strict';
const MapViewport = (() => {
  function position(svg,e) {const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const v=p.matrixTransform(svg.getScreenCTM().inverse());return [v.x,v.y];}
  function tolerance(svg,pixels=10) {const m=svg.getScreenCTM();return pixels/Math.hypot(m.a,m.b);}
  function zoom(box,p,delta,width) {const f=delta>0?1.12:1/1.12; if(box[2]*f<20 || box[2]*f>width*10)return box;return [p[0]+(box[0]-p[0])*f,p[1]+(box[1]-p[1])*f,box[2]*f,box[3]*f];}
  const fit=d=>[0,0,d.coordinateSystem.width,d.coordinateSystem.height];
  return {position,tolerance,zoom,fit};
})();
