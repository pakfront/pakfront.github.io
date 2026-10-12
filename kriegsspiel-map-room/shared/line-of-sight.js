'use strict';
// Pure vector interval evaluator. Raster cells only choose targets, never sample blockers.
const LineOfSight = (() => {
  const EPS=1e-7, VERSION=2, MAX_RANGE=100000;
  const defaults=()=>({curvature:'earth',earthRadiusMeters:6371000,refractionCoefficient:0.13});
  function settings(value={}) {
    const s={...defaults(),...value};
    if(!['flat','earth','refracted'].includes(s.curvature)||!Number.isFinite(s.earthRadiusMeters)||s.earthRadiusMeters<1000000||!Number.isFinite(s.refractionCoefficient)||s.refractionCoefficient<0||s.refractionCoefficient>=1)throw Error('Invalid curvature radius or refraction coefficient (0 ≤ k < 1).');
    return s;
  }
  function endpoint(d,p) {
    const c=d.coordinateSystem;
    if(!p||![p.x,p.y,p.heightMeters].every(Number.isFinite)||p.x<0||p.y<0||p.x>c.width||p.y>c.height||p.heightMeters<0)throw Error('Choose an in-bounds position and a nonnegative height above ground.');
  }
  const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
  function segmentCuts(a,v,c,e,out) {
    const w=[e[0]-c[0],e[1]-c[1]],u=[c[0]-a[0],c[1]-a[1]],den=cross(v,w);
    if(Math.abs(den)>1e-12){const t=cross(u,w)/den,r=cross(u,v)/den;if(r>=-EPS&&r<=1+EPS)out.push(t);}
    else if(Math.abs(cross(u,v))<EPS){const vv=v[0]*v[0]+v[1]*v[1];if(vv)for(const p of [c,e])out.push(((p[0]-a[0])*v[0]+(p[1]-a[1])*v[1])/vv);}
  }
  function circleCuts(a,v,c,r,out){const u=[a[0]-c[0],a[1]-c[1]],A=v[0]**2+v[1]**2,B=2*(u[0]*v[0]+u[1]*v[1]),C=u[0]**2+u[1]**2-r*r,disc=B*B-4*A*C;if(A&&disc>=0){const z=Math.sqrt(disc);out.push((-B-z)/(2*A),(-B+z)/(2*A));}}
  function prepare(d) {
    MapDocument.validate(d);
    const scale=d.coordinateSystem.metersPerUnit,features=[],warnings=[];
    if(d.background&&!d.features.some(f=>f.category!=='annotation'))warnings.push('Background-only map: no terrain or elevations inferred from the image.');
    if(!d.coordinateSystem.calibrated)warnings.push('Uncalibrated scale: distances and curvature are approximate.');
    for(const f of d.features){
      if(f.category==='annotation')continue;
      const elevation=f.category==='elevation',los=f.properties.los;
      if(!elevation&&!los){warnings.push('Sight settings unspecified: '+(f.name||f.subtype));continue;}
      if(!elevation&&los.mode==='none')continue;
      const entry={feature:f,elevation,geometry:f.geometry,los};
      if(f.geometry.type==='Point'){
        const w=f.properties.widthMeters/scale,h=f.properties.heightMeters/scale;
        if(!(w>0&&h>0)){warnings.push('Missing point footprint: '+(f.name||f.subtype));continue;}
        const [x,y]=f.geometry.coordinates;entry.geometry=Geometry.fromPoints('Polygon',[[x-w/2,y-h/2],[x+w/2,y-h/2],[x+w/2,y+h/2],[x-w/2,y+h/2]]);
      }
      if(f.geometry.type==='LineString'){
        if(!(f.properties.widthMeters>0)){warnings.push('Missing physical line width: '+(f.name||f.subtype));continue;}
        entry.radius=f.properties.widthMeters/scale/2;
      }
      entry.segments=Geometry.segments(entry.geometry);features.push(entry);
    }
    return {document:d,features,warnings,version:VERSION};
  }
  function contains(f,p){if(f.geometry.type==='Polygon')return Geometry.pointInPolygon(f.geometry,p);return f.segments.some(s=>Geometry.distance(p,Geometry.closest(s.a,s.b,p))<=f.radius+EPS);}
  function roots(A,B,C){if(Math.abs(A)<1e-14)return Math.abs(B)<1e-14?[]:[-C/B];const disc=B*B-4*A*C;if(disc<0)return [];const q=Math.sqrt(disc);return [(-B-q)/(2*A),(-B+q)/(2*A)];}
  function test(prepared,observer,target,options={},diagnostics=true) {
    const p=prepared.document?prepared:prepare(prepared),d=p.document,s=settings(options);endpoint(d,observer);endpoint(d,target);
    const a=[observer.x,observer.y],v=[target.x-observer.x,target.y-observer.y],D=Geometry.distance(a,[target.x,target.y])*d.coordinateSystem.metersPerUnit;
    if(D>MAX_RANGE)throw Error('Local LOS supports paths up to 100 km; larger areas need a geographic evaluator.');
    const z0=MapDocument.elevationAt(d,a)+observer.heightMeters,z1=MapDocument.elevationAt(d,[target.x,target.y])+target.heightMeters;
    const q=s.curvature==='flat'?0:D*D/(2*s.earthRadiusMeters)*(s.curvature==='refracted'?1-s.refractionCoefficient:1),at=t=>[a[0]+v[0]*t,a[1]+v[1]*t],bulge=t=>q*t*(1-t),line=t=>z0+(z1-z0)*t;
    if(!D)return {visible:true,distanceMeters:0,firstBlocker:null,visibilityBudgetUsed:0,minimumClearanceMeters:null,profile:[],warnings:p.warnings.slice(),complete:!p.warnings.length,observerElevationMeters:z0,targetElevationMeters:z1};
    const cuts=[0,1];
    for(const f of p.features){for(const seg of f.segments){if(f.geometry.type==='Polygon')segmentCuts(a,v,seg.a,seg.b,cuts);else{
      const dx=seg.b[0]-seg.a[0],dy=seg.b[1]-seg.a[1],len=Math.hypot(dx,dy),nx=-dy/len*f.radius,ny=dx/len*f.radius;
      segmentCuts(a,v,[seg.a[0]+nx,seg.a[1]+ny],[seg.b[0]+nx,seg.b[1]+ny],cuts);segmentCuts(a,v,[seg.a[0]-nx,seg.a[1]-ny],[seg.b[0]-nx,seg.b[1]-ny],cuts);circleCuts(a,v,seg.a,f.radius,cuts);circleCuts(a,v,seg.b,f.radius,cuts);
    }}}
    const ordered=[...new Set(cuts.filter(t=>t>=0&&t<=1).map(t=>Math.round(t*1e12)/1e12))].sort((a,b)=>a-b);
    let first=null,min=Infinity,minT=null,budgetUsed=0;const profile=[];
    function block(t,f,reason){if(t<=EPS||t>=1-EPS)return;if(!first||t<first.t)first={t,featureId:f?.feature.id||null,name:f?.feature.name||'Ground / Earth curvature',reason,position:at(t),distanceMeters:t*D};}
    for(let i=0;i<ordered.length-1;i++){
      const lo=ordered[i],hi=ordered[i+1],mid=(lo+hi)/2,point=at(mid),ground=MapDocument.elevationAt(d,point),active=p.features.filter(f=>!f.elevation&&contains(f,point));
      const groundFeatures=p.features.filter(f=>f.elevation&&contains(f,point)).sort((a,b)=>a.feature.properties.priority-b.feature.properties.priority||d.features.indexOf(a.feature)-d.features.indexOf(b.feature)),groundFeature=groundFeatures.at(-1)||null;
      const surfaces=[{height:ground,f:null},...active.map(f=>({height:ground+f.los.heightMeters,f}))];
      const critical=Math.min(hi,Math.max(lo,q?(q-(z1-z0))/(2*q):mid));
      const parts=[lo,hi];let top=ground;
      for(const surface of surfaces){
        top=Math.max(top,surface.height);const C=z0-surface.height,B=z1-z0-q,value=t=>q*t*t+B*t+C;
        for(const t of [lo,critical,hi])if(t>EPS&&t<1-EPS&&value(t)<min){min=value(t);minT=t;}
        const rr=roots(q,B,C);parts.push(...rr.filter(t=>t>lo&&t<hi));
        if(!surface.f||surface.f.los.mode==='opaque'){
          const inner=[lo,...rr.filter(t=>t>lo&&t<hi).sort((a,b)=>a-b),hi];
          for(let j=0;j<inner.length-1;j++){const l=inner[j],h=inner[j+1],m=(l+h)/2;
            // Endpoint contact with flat ground is allowed; penetrating ground is not.
            if(value(m)<-EPS||(surface.f&&value(m)<=EPS))block(Math.max(l,EPS*2),surface.f||groundFeature,surface.f?'Opaque obstruction':'Ground / Earth curvature');
          }
          if(critical>lo+EPS&&critical<hi-EPS&&Math.abs(value(critical))<=EPS&&q>0)block(critical,surface.f,'Tangency');
        }
      }
      const sub=[...new Set(parts)].sort((a,b)=>a-b);
      for(let j=0;j<sub.length-1;j++){const l=sub[j],h=sub[j+1],m=(l+h)/2,limited=active.filter(f=>f.los.mode==='limited'&&line(m)-bulge(m)<=ground+f.los.heightMeters+EPS);
        if(limited.length){
          // One shared budget for every category. Overlaps use the strongest density.
          const allowance=Math.min(...limited.map(f=>f.los.penetrationMeters)),length=(h-l)*D;
          const contribution=allowance>0?length/allowance:Infinity;
          if(budgetUsed+contribution>1+EPS){
            const t=l+Math.max(0,1-budgetUsed)*allowance/D;
            block(Math.max(t,EPS*2),limited.find(f=>f.los.penetrationMeters===allowance),'Visibility budget exhausted');
          }
          budgetUsed+=contribution;
        }
      }
      if(diagnostics)for(const t of [lo,critical,hi])profile.push({distanceMeters:t*D,groundMeters:ground+bulge(t),obstructionMeters:top+bulge(t),sightMeters:line(t)});
    }
    // Include zero-length footprint contacts (a ray tangent to an opaque wall/building).
    for(const t of ordered)if(t>EPS&&t<1-EPS){const point=at(t),ground=MapDocument.elevationAt(d,point);for(const f of p.features)if(!f.elevation&&f.los.mode==='opaque'&&contains(f,point)&&line(t)-bulge(t)<=ground+f.los.heightMeters+EPS)block(t,f,'Opaque obstruction');}
    const result={visible:!first,distanceMeters:D,firstBlocker:first,visibilityBudgetUsed:budgetUsed,minimumClearanceMeters:Number.isFinite(min)?min:null,clearancePosition:minT===null?null:at(minT),profile:profile.sort((a,b)=>a.distanceMeters-b.distanceMeters),warnings:p.warnings.slice(),complete:!p.warnings.length,observerElevationMeters:z0,targetElevationMeters:z1};
    if(diagnostics&&first){
      function required(which){let lo=0,hi=1;const endpoint=which==='observer'?observer:target;const clear=extra=>{try{return test(p,which==='observer'?{...endpoint,heightMeters:endpoint.heightMeters+extra}:observer,which==='target'?{...endpoint,heightMeters:endpoint.heightMeters+extra}:target,s,false).visible;}catch(e){return false;}};
        while(hi<10000&&!clear(hi))hi*=2;if(!clear(hi))return null;for(let n=0;n<32;n++){const m=(lo+hi)/2;if(clear(m))hi=m;else lo=m;}return Math.ceil((hi+0.001)*100)/100;
      }
      result.additionalObserverHeightMeters=required('observer');result.additionalTargetHeightMeters=required('target');
    }
    return result;
  }
  function fingerprint(d){return JSON.stringify({id:d.id,coordinateSystem:d.coordinateSystem,features:d.features.filter(f=>f.category!=='annotation').map(f=>({id:f.id,category:f.category,subtype:f.subtype,geometry:f.geometry,properties:f.properties}))});}
  return {VERSION,MAX_RANGE,defaults,settings,endpoint,prepare,test,fingerprint};
})();
