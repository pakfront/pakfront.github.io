'use strict';
// Authoring diagnostics are transient; physical map JSON and map-only exports stay reusable.
const MapMakerLosUI = (() => {
  const panel=document.createElement('details');panel.id='mapMakerLosPanel';
  panel.innerHTML=`<summary>Line of sight testing</summary><p class="hint">Test the current terrain in place. Points and masks are temporary and excluded from map saves and exports.</p>
    <div class="node-actions"><button id="losPlaceObserver">Place observer</button><button id="losPlaceTarget">Place target</button></div>
    <label>Observer preset<select id="losPreset"><option value="1.7">Standing (1.7 m)</option><option value="2.5">Mounted (2.5 m)</option><option value="11.7">Tower + eye (11.7 m)</option><option value="100">Balloon (100 m)</option></select></label>
    <div class="los-pair"><label>Observer X<input id="losObserverX" type="number" min="0" step="any"></label><label>Observer Y<input id="losObserverY" type="number" min="0" step="any"></label></div>
    <label>Observer height above ground (m)<input id="losObserverHeight" type="number" min="0" step="any" value="1.7"></label>
    <div class="los-pair"><label>Target X<input id="losTargetX" type="number" min="0" step="any"></label><label>Target Y<input id="losTargetY" type="number" min="0" step="any"></label></div>
    <label>Point target height above ground (m)<input id="losTargetHeight" type="number" min="0" step="any" value="1.7"></label>
    <label>Earth model<select id="losCurvature"><option value="earth">Earth curvature</option><option value="flat">Flat Earth</option><option value="refracted">Curvature + refraction</option></select></label>
    <label id="losRefractionLabel" hidden>Refraction coefficient (0 ≤ k &lt; 1)<input id="losRefraction" type="number" min="0" max="0.9999" step="any" value="0.13"></label>
    <label>Earth radius (m)<input id="losRadius" type="number" min="1000000" step="any" value="6371000"></label>
    <button id="losTest">Test point-to-point LOS</button><p id="losResult" role="status" class="hint">Place an observer and target. Results update after terrain edits and undo/redo.</p><svg id="losProfile" viewBox="0 0 260 130" aria-label="Elevation profile: brown ground, green obstruction, blue sight line" hidden></svg>
    <h3>Visibility preview</h3><label>Mask target height above ground (m)<input id="losMaskHeight" type="number" min="0" step="any" value="0"></label>
    <div class="los-pair"><label>Range (m)<input id="losRange" type="number" min="1" max="100000" value="5000"></label><label>Cell size (m)<input id="losCell" type="number" min="0.01" step="any" value="50"></label></div>
    <p id="losEstimate" class="hint"></p><div class="node-actions"><button id="losCalculate">Calculate / recalculate preview</button><button id="losCancel" disabled>Cancel</button></div><progress id="losProgress" max="1" value="0" hidden></progress><p id="losMaskStatus" role="status" class="hint">No visibility preview.</p>
    <label class="check"><input id="losShowMask" type="checkbox" checked>Show visibility preview</label><label>Unseen terrain<select id="losTreatment"><option value="overlay">Shade</option><option value="conceal">Conceal</option><option value="fade">Fade</option></select></label>
    <label>Brush radius (m)<input id="losBrushSize" type="number" min="0.1" step="any" value="100"></label><div class="node-actions"><button data-tool="los-reveal">Reveal</button><button data-tool="los-hide">Hide</button><button data-tool="los-erase">Erase override</button></div>
    <div class="node-actions"><button id="losBrushUndo">Undo mask edit</button><button id="losBrushRedo">Redo mask edit</button></div><button id="losReset">Reset overrides</button><button id="losClear">Clear LOS tests</button>`;
  document.querySelector('main > aside:last-child').prepend(panel);
  for(const [toolName,label]of [['los','Test LOS'],['los-observer','Visibility preview']]){
    const button=document.createElement('button');button.dataset.tool=toolName;button.textContent=label;$('tools').append(button);
  }
  for(const button of document.querySelectorAll('[data-tool^="los"]'))button.onclick=()=>choose(button.dataset.tool);

  let observer=null,target=null,result=null,mask=null,dragging=null,stroke=null,controller=null,mapId=mapDocument.id;
  let pointKey='',renderedMaskKey='',preview=null,previewKey='',error='',runningFingerprint='';
  const edits=DocumentHistory.create();
  function numeric(id){if(!$(id).value.trim())throw Error('Enter '+$(id).closest('label').textContent.trim()+'.');const value=Number($(id).value);if(!Number.isFinite(value))throw Error('Enter a finite number.');return value;}
  const model=()=>LineOfSight.settings({curvature:$('losCurvature').value,earthRadiusMeters:numeric('losRadius'),refractionCoefficient:numeric('losRefraction')});
  const readObserver=()=>({x:numeric('losObserverX'),y:numeric('losObserverY'),heightMeters:numeric('losObserverHeight')});
  const readTarget=()=>({x:numeric('losTargetX'),y:numeric('losTargetY'),heightMeters:numeric('losTargetHeight')});
  const options=()=>({targetHeightMeters:numeric('losMaskHeight'),rangeMeters:numeric('losRange'),cellMeters:numeric('losCell'),settings:model()});
  function showEndpoints(){for(const [p,prefix]of [[observer,'losObserver'],[target,'losTarget']])for(const [key,suffix]of [['x','X'],['y','Y'],['heightMeters','Height']]){if(p)$(prefix+suffix).value=p[key];else if(key!=='heightMeters')$(prefix+suffix).value='';}}
  function stale(){if(!mask)return false;try{const inputs={...mask,observer:readObserver(),...options()};return VisibilityMask.stale(inputs,mapDocument);}catch(e){return true;}}
  function profile(r){const svg=$('losProfile');svg.replaceChildren();svg.hidden=!r?.profile.length;if(svg.hidden)return;
    const values=r.profile.flatMap(p=>[p.groundMeters,p.obstructionMeters,p.sightMeters]),low=Math.min(...values),span=Math.max(1,Math.max(...values)-low);
    for(const [key,color]of [['groundMeters','#a3854c'],['obstructionMeters','#47704b'],['sightMeters','#306fb0']])R.node('polyline',{points:r.profile.map(p=>[12+p.distanceMeters/r.distanceMeters*236,105-(p[key]-low)/span*90].join(',')).join(' '),fill:'none',stroke:color,'stroke-width':2},svg);
    R.text(svg,[130,125],'Distance → · corrected elevation ↑',10);
  }
  function test(){try{
    observer=readObserver();target=readTarget();const settings=model();result=LineOfSight.test(mapDocument,observer,target,settings);
    pointKey=JSON.stringify([LineOfSight.fingerprint(mapDocument),observer,target,settings]);const r=result;
    $('losResult').textContent=`${r.visible?'Visible':'Blocked'} · ${r.distanceMeters.toFixed(1)} m · endpoint elevations ${r.observerElevationMeters.toFixed(2)} / ${r.targetElevationMeters.toFixed(2)} m · ${$('losCurvature').selectedOptions[0].textContent}${settings.curvature==='refracted'?' (k='+settings.refractionCoefficient+')':''} · ${Number.isFinite(r.visibilityBudgetUsed)?'sight budget '+(r.visibilityBudgetUsed*100).toFixed(0)+'%':'zero-penetration obstruction'}${r.minimumClearanceMeters===null?'':' · minimum clearance '+r.minimumClearanceMeters.toFixed(2)+' m'}${r.firstBlocker?' · '+r.firstBlocker.name+' at '+r.firstBlocker.distanceMeters.toFixed(1)+' m · raise observer '+(r.additionalObserverHeightMeters??'unavailable')+' m or target '+(r.additionalTargetHeightMeters??'unavailable')+' m':''}${r.warnings.length?' · Approximate / incomplete: '+r.warnings.slice(0,3).join(' · '):''}`;
    profile(r);
  }catch(e){result=null;pointKey='';$('losResult').textContent=e.message;profile(null);}render();}
  function reset(){controller?.abort();observer=target=result=mask=null;dragging=stroke=null;pointKey='';error='';edits.clear();showEndpoints();profile(null);$('losResult').textContent='Place an observer and target.';}
  function sync(){
    if(mapDocument.id!==mapId){reset();mapId=mapDocument.id;}
    $('losRefractionLabel').hidden=$('losCurvature').value!=='refracted';
    if(observer&&target&&!dragging){try{const key=JSON.stringify([LineOfSight.fingerprint(mapDocument),readObserver(),readTarget(),model()]);if(key!==pointKey)test();}catch(e){result=null;$('losResult').textContent=e.message;profile(null);}}
    const isStale=stale();if(controller&&runningFingerprint!==LineOfSight.fingerprint(mapDocument))controller.abort();
    $('losMaskStatus').textContent=error||(mask?`${isStale?'Stale preview hidden — recalculate after terrain or observer changes':'Visibility preview calculated'}${mask.warnings.length?' · Approximate / incomplete: '+mask.warnings.slice(0,3).join(' · '):''}`:'No visibility preview.');
    for(const button of panel.querySelectorAll('[data-tool]'))button.disabled=!mask||isStale||!!controller;
    $('losBrushUndo').disabled=!mask||isStale||!edits.canUndo||!!controller;$('losBrushRedo').disabled=!mask||isStale||!edits.canRedo||!!controller;$('losReset').disabled=!mask||isStale||!!controller;
    $('losCalculate').disabled=!!controller;$('losCancel').disabled=!controller;
    try{const g=VisibilityMask.grid(mapDocument,numeric('losCell'));$('losEstimate').textContent=`${g.columns} × ${g.rows} · ${(g.columns*g.rows).toLocaleString()} cells`;}catch(e){$('losEstimate').textContent=e.message;}
    render();
  }
  function render(){
    const currentMask=stroke?.mask||mask,treatment=$('losTreatment').value;
    const key=currentMask&&$('losShowMask').checked&&!stale()?JSON.stringify([currentMask.grid,currentMask.calculated,currentMask.overrides,treatment]):'';
    if(key!==renderedMaskKey){if(key){if(previewKey!==key){preview=VisibilityMask.project(currentMask,treatment);previewKey=key;}VisibilityMask.render($('losVisibility'),preview);}else $('losVisibility').replaceChildren();renderedMaskKey=key;}
    const parent=$('losDrawing');parent.replaceChildren();const size=MapViewport.tolerance($('map'),6);
    if(observer&&target){
      R.node('line',{x1:observer.x,y1:observer.y,x2:target.x,y2:target.y,stroke:result?.visible?'#268259':'#c47f25','stroke-width':3,'vector-effect':'non-scaling-stroke','pointer-events':'none'},parent);
      const c=mapDocument.coordinateSystem,distance=Geometry.distance([observer.x,observer.y],[target.x,target.y])*c.metersPerUnit;
      const label=R.text(parent,[(observer.x+target.x)/2,(observer.y+target.y)/2-size*2],`${distance.toFixed(0)} m${c.calibrated?'':' (provisional)'}`,16);
      label.setAttribute('data-los-distance','');label.setAttribute('pointer-events','none');
    }
    for(const [p,name,color]of [[observer,'observer','#306fb0'],[target,'target','#ae5f3c']])if(p){R.node('circle',{cx:p.x,cy:p.y,r:size,fill:color,stroke:'#fff','stroke-width':2,'vector-effect':'non-scaling-stroke','data-los-endpoint':name},parent);R.text(parent,[p.x,p.y-size*2],name==='observer'?'Observer':'Target',14);}
    if(result?.firstBlocker){const p=result.firstBlocker.position;R.node('circle',{cx:p[0],cy:p[1],r:size*1.5,fill:'none',stroke:'#d63838','stroke-width':3,'vector-effect':'non-scaling-stroke','pointer-events':'none'},parent);}
  }
  async function calculate(){if(controller)return;error='';try{
    const source=D.clone(mapDocument),obs=readObserver(),settings=options(),g=VisibilityMask.grid(source,settings.cellMeters);observer=obs;
    const sameGrid=mask&&JSON.stringify(mask.grid)===JSON.stringify(g);
    if(mask&&!sameGrid&&!confirm('Preview resolution changed. Recalculate and clear manual overrides?'))return;
    const inputs=JSON.stringify([obs,settings]);runningFingerprint=LineOfSight.fingerprint(source);controller=new AbortController();$('losProgress').hidden=false;$('losProgress').value=0;sync();
    const next=await VisibilityMask.calculate(source,obs,settings,{signal:controller.signal,onProgress:v=>$('losProgress').value=v});
    if(LineOfSight.fingerprint(source)!==LineOfSight.fingerprint(mapDocument)||inputs!==JSON.stringify([readObserver(),options()]))throw Error('Terrain or test settings changed during calculation. Recalculate the preview.');
    if(sameGrid)next.overrides=mask.overrides;mask=next;edits.clear();$('losShowMask').checked=true;
  }catch(e){error=e.message;status(e.message);}finally{controller=null;$('losProgress').hidden=true;sync();}}
  function activate(t){if(t.startsWith('los')){panel.open=true;panel.scrollIntoView({block:'nearest'});}}
  function pointerDown(e,p){if(!tool.startsWith('los'))return false;if(controller)return true;
    if(['los-reveal','los-hide','los-erase'].includes(tool)){if(!mask||stale())return true;try{const radius=numeric('losBrushSize')/mapDocument.coordinateSystem.metersPerUnit;if(radius<=0)throw Error('Enter a positive brush radius.');stroke={mask:D.clone(mask),before:D.clone(mask.overrides),radius,value:{'los-reveal':1,'los-hide':2,'los-erase':0}[tool],last:p,changed:false};paint(p);$('map').setPointerCapture(e.pointerId);}catch(e){error=e.message;sync();}return true;}
    const handle=MapInput.handle($('map'),e,'[data-los-endpoint]');if(handle){const name=handle.dataset.losEndpoint;dragging={name,screen:[e.clientX,e.clientY],before:D.clone(name==='observer'?observer:target)};$('map').setPointerCapture(e.pointerId);return true;}
    try{p=snap(p,e);if(tool==='los-observer'||!observer)observer={x:p[0],y:p[1],heightMeters:numeric('losObserverHeight')};else target={x:p[0],y:p[1],heightMeters:numeric('losTargetHeight')};showEndpoints();error='';if(observer&&target)test();sync();}catch(e){error=e.message;status(e.message);sync();}return true;
  }
  function paint(p){const s=stroke,distance=G.distance(s.last,p),steps=Math.max(1,Math.ceil(distance/Math.max(s.radius/2,s.mask.grid.step/4)));for(let i=1;i<=steps;i++)s.changed=VisibilityMask.brush(s.mask,[s.last[0]+(p[0]-s.last[0])*i/steps,s.last[1]+(p[1]-s.last[1])*i/steps],s.radius,s.value)||s.changed;s.last=p;render();}
  function pointerMove(e,p){if(stroke){paint(p);return true;}if(!dragging)return false;if(!MapInput.moved(dragging,e))return true;const c=mapDocument.coordinateSystem,endpoint=dragging.name==='observer'?observer:target,q=snap(p,e);endpoint.x=Math.max(0,Math.min(c.width,q[0]));endpoint.y=Math.max(0,Math.min(c.height,q[1]));result=null;showEndpoints();render();return true;}
  function pointerUp(){if(dragging){dragging=null;if(observer&&target)test();}if(stroke){const s=stroke;stroke=null;if(s.changed){edits.record(s.before);mask.overrides=s.mask.overrides;}}sync();}
  function cancelDrag(){if(dragging){if(dragging.name==='observer')observer=dragging.before;else target=dragging.before;dragging=null;showEndpoints();pointKey='';}stroke=null;}
  $('losPlaceObserver').onclick=()=>choose('los-observer');$('losPlaceTarget').onclick=()=>choose('los-target');$('losTest').onclick=test;
  for(const id of ['losObserverX','losObserverY','losObserverHeight','losTargetX','losTargetY','losTargetHeight','losCurvature','losRadius','losRefraction','losMaskHeight','losRange','losCell'])$(id).onchange=()=>{controller?.abort();error='';try{if($('losObserverX').value&&$('losObserverY').value)observer=readObserver();if($('losTargetX').value&&$('losTargetY').value)target=readTarget();if(observer&&target)test();}catch(e){error=e.message;}sync();};
  $('losPreset').onchange=()=>{$('losObserverHeight').value=$('losPreset').value;$('losObserverHeight').onchange();};
  $('losCalculate').onclick=calculate;$('losCancel').onclick=()=>controller?.abort();$('losTreatment').onchange=render;$('losShowMask').onchange=render;
  for(const [id,method]of [['losBrushUndo','undo'],['losBrushRedo','redo']])$(id).onclick=()=>{if(!mask||stale())return;const value=edits[method](mask.overrides);if(value)mask.overrides=value;sync();};
  $('losReset').onclick=()=>{if(mask&&!stale()){edits.record(mask.overrides);mask.overrides=[[0,mask.grid.columns*mask.grid.rows]];sync();}};
  $('losClear').onclick=()=>{reset();choose('select');sync();};
  sync();return {sync,render,activate,pointerDown,pointerMove,pointerUp,cancelDrag};
})();
