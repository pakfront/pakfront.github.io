'use strict';
const LosUI = (() => {
  const panel=document.createElement('section');panel.id='losPanel';
  panel.innerHTML=`<h2>Line of sight</h2><p class="hint">Test terrain visibility. Unit knowledge remains under umpire control.</p>
    <div class="node-actions"><button id="losPlaceObserver">Place observer</button><button id="losPlaceTarget">Place target</button></div>
    <label>Observer preset<select id="losPreset"><option value="1.7">Standing (1.7 m)</option><option value="2.5">Mounted (2.5 m)</option><option value="11.7">Tower + eye (11.7 m)</option><option value="100">Balloon (100 m)</option></select></label>
    <div class="los-pair"><label>Observer X<input id="losObserverX" type="number" min="0" step="any"></label><label>Observer Y<input id="losObserverY" type="number" min="0" step="any"></label></div>
    <label>Observer height above ground (m)<input id="losObserverHeight" type="number" min="0" step="any" value="1.7"></label>
    <div class="los-pair"><label>Target X<input id="losTargetX" type="number" min="0" step="any"></label><label>Target Y<input id="losTargetY" type="number" min="0" step="any"></label></div>
    <label>Point target height above ground (m)<input id="losTargetHeight" type="number" min="0" step="any" value="1.7"></label>
    <label>Earth model<select id="losCurvature"><option value="earth">Earth curvature</option><option value="flat">Flat Earth</option><option value="refracted">Curvature + refraction</option></select></label>
    <label id="losRefractionLabel">Refraction coefficient (0 ≤ k &lt; 1)<input id="losRefraction" type="number" min="0" max="0.9999" step="any" value="0.13"></label>
    <label>Earth radius (m)<input id="losRadius" type="number" min="1000000" step="any" value="6371000"></label>
    <button id="losTest">Test point-to-point LOS</button><p id="losResult" role="status" class="hint">Place an observer and target.</p><svg id="losProfile" viewBox="0 0 260 130" aria-label="Elevation profile: brown ground, green obstacle top, blue sight line" hidden></svg>
    <h3>Visibility mask</h3><label>Saved mask<select id="losMask"><option value="">New mask</option></select></label><label>Mask name<input id="losMaskName" value="Visibility mask"></label>
    <label>Mask target height above ground (m)<input id="losMaskHeight" type="number" min="0" step="any" value="0"></label>
    <div class="los-pair"><label>Range (m)<input id="losRange" type="number" min="1" max="100000" value="5000"></label><label>Cell size (m)<input id="losCell" type="number" min="0.01" step="any" value="50"></label></div>
    <p id="losEstimate" class="hint"></p><div class="node-actions"><button id="losCalculate">Calculate / recalculate</button><button id="losCancel" disabled>Cancel</button></div><progress id="losProgress" max="1" value="0" hidden></progress><p id="losMaskStatus" role="status" class="hint"></p>
    <label>Brush radius (m)<input id="losBrushSize" type="number" min="0.1" step="any" value="100"></label><div class="node-actions"><button data-tool="los-reveal">Reveal</button><button data-tool="los-hide">Hide</button><button data-tool="los-erase">Erase override</button></div>
    <div class="node-actions"><button id="losBrushUndo">Undo mask edit</button><button id="losBrushRedo">Redo mask edit</button></div><button id="losReset">Reset overrides</button>
    <label>Copy mask to<select id="losCopyTarget"></select></label><button id="losCopy">Copy independent mask</button><button id="losDelete">Delete mask</button>
    <button id="losAccept">Accept approximate / stale result for publication</button><p class="hint">Acceptance records an umpire decision. Recalculation or edits require another review.</p>
    <label>Mask for this view's export<select id="losExportMask"><option value="">None</option></select></label><label>Unseen terrain<select id="losTreatment"><option value="overlay">Shade</option><option value="conceal">Conceal</option><option value="fade">Fade</option></select></label>`;
  $('terrainFeature').closest('label').previousElementSibling.before(panel);
  const testButton=document.createElement('button');testButton.dataset.tool='los';testButton.textContent='Test LOS';$('tools').append(testButton);
  for(const b of document.querySelectorAll('[data-tool^="los"]'))b.onclick=()=>choose(b.dataset.tool);
  let observer=null,target=null,maskId='',lastActive=null,lastState=null,result=null,stroke=null,endpointDrag=null,calculation=null,previewCache=null;
  const brushHistory=new Map();
  const selectedMask=()=>state.visibilityMasks.find(m=>m.id===maskId&&M.effectiveView(state,active).masks.some(v=>v.id===m.id));
  const editable=m=>!!m&&m.ownerId===active&&view()!=='published';
  const numeric=id=>{if($(id).value.trim()==='')throw Error('Enter '+$(id).closest('label').textContent.trim()+'.');const n=Number($(id).value);if(!Number.isFinite(n))throw Error('Enter a finite number.');return n;};
  const model=()=>LineOfSight.settings({curvature:$('losCurvature').value,earthRadiusMeters:numeric('losRadius'),refractionCoefficient:numeric('losRefraction')});
  function inputObserver(){observer={x:numeric('losObserverX'),y:numeric('losObserverY'),heightMeters:numeric('losObserverHeight')};return observer;}
  function inputTarget(){target={x:numeric('losTargetX'),y:numeric('losTargetY'),heightMeters:numeric('losTargetHeight')};return target;}
  function showEndpoints(){for(const [p,prefix]of [[observer,'losObserver'],[target,'losTarget']])if(p){$(prefix+'X').value=p.x;$(prefix+'Y').value=p.y;$(prefix+'Height').value=p.heightMeters;}}
  function readMask(){const m=selectedMask();if(!m)return;observer=M.copy(m.observer);$('losMaskName').value=m.name;$('losMaskHeight').value=m.targetHeightMeters;$('losRange').value=m.rangeMeters;$('losCell').value=m.cellMeters;$('losCurvature').value=m.settings.curvature;$('losRadius').value=m.settings.earthRadiusMeters;$('losRefraction').value=m.settings.refractionCoefficient;showEndpoints();result=null;}
  function maskHistory(m){if(!brushHistory.has(m.id))brushHistory.set(m.id,DocumentHistory.create());return brushHistory.get(m.id);}
  function estimate(){try{const g=VisibilityMask.grid(state.mapDocument,numeric('losCell'));$('losEstimate').textContent=`${g.columns} × ${g.rows} · ${(g.columns*g.rows).toLocaleString()} cells · target height ${$('losMaskHeight').value} m`;}catch(e){$('losEstimate').textContent=e.message;}}
  function sync(){
    if(lastActive!==active){maskId=current().maskId||'';lastActive=active;readMask();}if(lastState!==state){lastState=state;brushHistory.clear();if(maskId)readMask();}
    const masks=M.effectiveView(state,active).masks,m=selectedMask(),published=view()==='published';
    if(maskId&&!m)maskId='';
    for(const [id,empty]of [['losMask','New mask'],['losExportMask','None']]){const select=$(id);select.replaceChildren(new Option(empty,''));for(const mask of masks)select.add(new Option(`${mask.name}${mask.ownerId===active?'':' (inherited)'}`,mask.id));select.value=id==='losMask'?maskId:current().maskId||'';if(id==='losExportMask'&&current().maskId&&!masks.some(v=>v.id===current().maskId))select.add(new Option('Unavailable inherited mask — choose None',current().maskId,true,true));}
    $('losCopyTarget').innerHTML=destinations();$('losCopyTarget').value=active;$('losTreatment').value=current().maskTreatment||'overlay';
    $('losRefractionLabel').hidden=$('losCurvature').value!=='refracted';
    for(const id of ['losCalculate','losPlaceObserver','losPlaceTarget','losPreset','losObserverX','losObserverY','losObserverHeight','losMaskHeight','losCurvature','losRefraction','losRadius','losRange','losCell','losMaskName'])$(id).disabled=published||!!calculation||!!m&&!editable(m);
    for(const id of ['losReset','losDelete','losAccept','losBrushUndo','losBrushRedo'])$(id).disabled=!editable(m)||!!calculation;
    $('losBrushUndo').disabled ||= !m||!maskHistory(m).canUndo;$('losBrushRedo').disabled ||= !m||!maskHistory(m).canRedo;
    for(const b of panel.querySelectorAll('[data-tool]'))b.disabled=!editable(m)||!!calculation;
    $('losExportMask').disabled=published;$('losTreatment').disabled=published;$('losCopy').disabled=!m||published||!!calculation;
    const stale=m&&VisibilityMask.stale(m,state.mapDocument);$('losMaskStatus').textContent=m?`${m.ownerId===active?'Owned here':'Inherited: edit at '+pathName(m.ownerId)} · ${stale?'Stale calculation':'Calculated'} · ${m.warnings.length?'Approximate / incomplete':'Configured terrain'}${VisibilityMask.approved(m,state.mapDocument)?' · Umpire accepted':''}${m.warnings.length?' · '+m.warnings.slice(0,3).join(' · '):''}`:'Calculate a mask to save it in this view.';
    estimate();render();
  }
  function preview(snapshot){if(view()==='published')return snapshot?.visibilityMask||null;const m=stroke?.mask||selectedMask();if(!m||!VisibilityMask.aligned(m,state.mapDocument))return null;const treatment=current().maskTreatment||'overlay',key=JSON.stringify([m.grid,m.calculated,m.overrides,treatment]);if(previewCache?.key===key)return previewCache.value;const value=VisibilityMask.project(m,treatment);previewCache={key,value};return value;}
  let renderedKey='';
  function render(snapshot=current().published){const mask=preview(snapshot),key=JSON.stringify(mask);if(key!==renderedKey){VisibilityMask.render($('visibility'),mask);renderedKey=key;}$('losDrawing').replaceChildren();if(view()==='published')return;
    const parent=$('losDrawing'),size=MapViewport.tolerance($('map'),6);
    if(observer&&target){
      MapRenderer.node('line',{x1:observer.x,y1:observer.y,x2:target.x,y2:target.y,stroke:result?.visible?'#268259':'#c47f25','stroke-width':3,'vector-effect':'non-scaling-stroke','pointer-events':'none'},parent);
      const c=state.mapDocument.coordinateSystem,distance=Geometry.distance([observer.x,observer.y],[target.x,target.y])*c.metersPerUnit;
      const label=MapRenderer.text(parent,[(observer.x+target.x)/2,(observer.y+target.y)/2-size*2],`${distance.toFixed(0)} m${c.calibrated?'':' (provisional)'}`,16);
      label.setAttribute('data-los-distance','');label.setAttribute('pointer-events','none');
    }
    for(const [p,name,color]of [[observer,'observer','#306fb0'],[target,'target','#ae5f3c']])if(p){MapRenderer.node('circle',{cx:p.x,cy:p.y,r:size,fill:color,stroke:'#fff','stroke-width':2,'vector-effect':'non-scaling-stroke','data-los-endpoint':name},parent);MapRenderer.text(parent,[p.x,p.y-size*2],name==='observer'?'Observer':'Target',14);}
    if(result?.firstBlocker){const p=result.firstBlocker.position;MapRenderer.node('circle',{cx:p[0],cy:p[1],r:size*1.5,fill:'none',stroke:'#d63838','stroke-width':3,'vector-effect':'non-scaling-stroke','pointer-events':'none'},parent);}
  }
  function test(){try{result=LineOfSight.test(state.mapDocument,inputObserver(),inputTarget(),model());const r=result;
    $('losResult').textContent=`${r.visible?'Visible':'Blocked'} · ${r.distanceMeters.toFixed(1)} m · endpoint elevations ${r.observerElevationMeters.toFixed(2)} / ${r.targetElevationMeters.toFixed(2)} m · ${$('losCurvature').selectedOptions[0].textContent}${model().curvature==='refracted'?' (k='+model().refractionCoefficient+')':''}${Number.isFinite(r.visibilityBudgetUsed)?' · sight budget '+(r.visibilityBudgetUsed*100).toFixed(0)+'%':' · zero-penetration obstruction'}${r.minimumClearanceMeters!==null?' · minimum clearance '+r.minimumClearanceMeters.toFixed(2)+' m':''}${r.firstBlocker?' · '+r.firstBlocker.name+' at '+r.firstBlocker.distanceMeters.toFixed(1)+' m · raise observer '+(r.additionalObserverHeightMeters??'unavailable')+' m or target '+(r.additionalTargetHeightMeters??'unavailable')+' m':''}${r.warnings.length?' · Approximate / incomplete: '+r.warnings.slice(0,3).join(' · '):''}`;profile(r);render();
  }catch(e){result=null;$('losResult').textContent=e.message;$('losProfile').hidden=true;render();}}
  function profile(r){const svg=$('losProfile');svg.replaceChildren();svg.hidden=!r.profile.length;if(svg.hidden)return;const values=r.profile.flatMap(p=>[p.groundMeters,p.obstructionMeters,p.sightMeters]),low=Math.min(...values),high=Math.max(...values),span=Math.max(1,high-low),x=p=>12+p.distanceMeters/r.distanceMeters*236,y=v=>105-(v-low)/span*90;
    for(const [key,color]of [['groundMeters','#a3854c'],['obstructionMeters','#47704b'],['sightMeters','#306fb0']])MapRenderer.node('polyline',{points:r.profile.map(p=>[x(p),y(p[key])].join(',')).join(' '),fill:'none',stroke:color,'stroke-width':2},svg);
    MapRenderer.text(svg,[130,125],'Distance → · corrected elevation ↑',10);
  }
  function persistInputs(){const m=selectedMask();if(!editable(m))return;try{const next={observer:inputObserver(),targetHeightMeters:numeric('losMaskHeight'),settings:model(),rangeMeters:numeric('losRange'),cellMeters:numeric('losCell'),name:$('losMaskName').value.trim()};LineOfSight.endpoint(state.mapDocument,next.observer);if(next.targetHeightMeters<0||next.rangeMeters<=0||next.rangeMeters>LineOfSight.MAX_RANGE||next.cellMeters<=0||!next.name)throw Error('Enter valid mask settings.');mutate(()=>{Object.assign(m,next,{accepted:false});});}catch(e){$('losMaskStatus').textContent=e.message;}}
  async function calculate(){if(calculation||view()==='published')return;let m=selectedMask();if(m&&!editable(m))return;
    const sourceState=state,owner=active,id=m?.id,name=$('losMaskName').value.trim()||'Visibility mask';let sourceMap,obs,options,overridePolicy='keep';
    try{sourceMap=M.copy(state.mapDocument);obs=inputObserver();options={settings:model(),targetHeightMeters:numeric('losMaskHeight'),rangeMeters:numeric('losRange'),cellMeters:numeric('losCell')};const g=VisibilityMask.grid(sourceMap,options.cellMeters);if(state.visibilityMasks.filter(v=>v.id!==id).reduce((n,v)=>n+v.grid.columns*v.grid.rows,0)+g.columns*g.rows>2000000)throw Error('Scenario visibility masks exceed two million cells. Use coarser cells or remove a mask.');
      if(m&&JSON.stringify(g)!==JSON.stringify(m.grid)){if(!confirm('Grid resolution changed. Recalculate and clear manual overrides? Undo restores the old mask.'))return;overridePolicy='clear';}
      calculation=new AbortController();$('losProgress').hidden=false;$('losCancel').disabled=false;sync();
      const calculated=await VisibilityMask.calculate(sourceMap,obs,options,{signal:calculation.signal,onProgress:v=>$('losProgress').value=v});
      if(state!==sourceState||!M.getNode(state,owner)||LineOfSight.fingerprint(state.mapDocument)!==LineOfSight.fingerprint(sourceMap))throw Error('Scenario or terrain changed during calculation. Previous mask retained.');
      m=id?state.visibilityMasks.find(v=>v.id===id):null;if(id&&(!m||m.ownerId!==owner))throw Error('Mask changed during calculation.');
      mutate(()=>{if(m){const old=m.overrides;Object.assign(m,calculated,{name});if(overridePolicy==='keep')m.overrides=old;}else{if(state.visibilityMasks.length>=100)throw Error('Maximum 100 masks per scenario.');m={...calculated,id:M.id(),ownerId:owner,name};state.visibilityMasks.push(m);}maskId=m.id;});if(m)brushHistory.delete(m.id);
    }catch(e){$('status').textContent=e.message;}finally{calculation=null;$('losProgress').hidden=true;$('losCancel').disabled=true;sync();}
  }
  function pointerDown(e,p){if(!tool.startsWith('los'))return false;if(view()==='published')return true;const handle=e.target.closest('[data-los-endpoint]');if(handle&&!['los-reveal','los-hide','los-erase'].includes(tool)&&(!selectedMask()||editable(selectedMask()))){endpointDrag={which:handle.dataset.losEndpoint,before:M.copy(handle.dataset.losEndpoint==='observer'?observer:target)};$('map').setPointerCapture(e.pointerId);return true;}
    if(['los-reveal','los-hide','los-erase'].includes(tool)){const m=selectedMask();if(!editable(m)||calculation)return true;try{const radius=numeric('losBrushSize')/state.mapDocument.coordinateSystem.metersPerUnit;if(radius<=0)throw Error('Enter a positive brush radius.');stroke={mask:M.copy(m),before:M.copy(m.overrides),id:m.id,owner:active,radius,value:{'los-reveal':1,'los-hide':2,'los-erase':0}[tool],last:p,changed:false};paint(p);$('map').setPointerCapture(e.pointerId);}catch(e){$('losMaskStatus').textContent=e.message;}return true;}
    if(selectedMask()&&!editable(selectedMask()))return true;
    if(tool==='los-observer'||tool==='los'&&!observer){observer={x:p[0],y:p[1],heightMeters:Number($('losObserverHeight').value)};}else{target={x:p[0],y:p[1],heightMeters:Number($('losTargetHeight').value)};}
    showEndpoints();persistInputs();if(observer&&target)test();else render();return true;
  }
  function paint(p){const s=stroke,distance=Geometry.distance(s.last,p),steps=Math.max(1,Math.ceil(distance/Math.max(s.radius/2,s.mask.grid.step/4)));for(let i=1;i<=steps;i++){const q=[s.last[0]+(p[0]-s.last[0])*i/steps,s.last[1]+(p[1]-s.last[1])*i/steps];s.changed=VisibilityMask.brush(s.mask,q,s.radius,s.value)||s.changed;}s.last=p;render();}
  function pointerMove(e,p){if(stroke){paint(p);return true;}if(endpointDrag){const endpoint=endpointDrag.which==='observer'?observer:target;endpoint.x=Math.max(0,Math.min(state.mapDocument.coordinateSystem.width,p[0]));endpoint.y=Math.max(0,Math.min(state.mapDocument.coordinateSystem.height,p[1]));showEndpoints();result=null;render();return true;}return false;}
  function pointerUp(){if(endpointDrag){endpointDrag=null;persistInputs();if(observer&&target)test();}if(!stroke)return;const s=stroke;stroke=null;const m=selectedMask();if(s.changed&&editable(m)&&m.id===s.id&&active===s.owner){maskHistory(m).record(s.before);mutate(()=>{m.overrides=s.mask.overrides;m.accepted=false;});}render();}
  function cancelStroke(){stroke=null;if(endpointDrag){if(endpointDrag.which==='observer')observer=endpointDrag.before;else target=endpointDrag.before;showEndpoints();}endpointDrag=null;}
  $('losPlaceObserver').onclick=()=>choose('los-observer');$('losPlaceTarget').onclick=()=>choose('los-target');$('losTest').onclick=test;
  $('losPreset').onchange=()=>{$('losObserverHeight').value=$('losPreset').value;persistInputs();if(observer&&target)test();};
  for(const id of ['losObserverX','losObserverY','losObserverHeight','losMaskHeight','losCurvature','losRefraction','losRadius','losRange','losCell','losMaskName'])$(id).onchange=()=>{persistInputs();$('losRefractionLabel').hidden=$('losCurvature').value!=='refracted';estimate();if(observer&&target)test();};
  for(const id of ['losTargetX','losTargetY','losTargetHeight'])$(id).onchange=()=>{if(observer)test();};
  $('losMask').onchange=()=>{cancelStroke();maskId=$('losMask').value;readMask();sync();};$('losCalculate').onclick=calculate;$('losCancel').onclick=()=>calculation?.abort();
  $('losExportMask').onchange=()=>{const id=$('losExportMask').value;maskId=id;if(id)readMask();mutate(()=>current().maskId=id||null);};$('losTreatment').onchange=()=>{const treatment=$('losTreatment').value;mutate(()=>current().maskTreatment=treatment);};
  $('losReset').onclick=()=>{const m=selectedMask();if(editable(m)){maskHistory(m).record(m.overrides);mutate(()=>{m.overrides=[[0,m.grid.columns*m.grid.rows]];m.accepted=false;});}};
  for(const [id,method]of [['losBrushUndo','undo'],['losBrushRedo','redo']])$(id).onclick=()=>{const m=selectedMask();if(!editable(m))return;const next=maskHistory(m)[method](m.overrides);if(next)mutate(()=>{m.overrides=next;m.accepted=false;});};
  $('losAccept').onclick=()=>{const m=selectedMask();if(editable(m))mutate(()=>{m.accepted=true;m.acceptedAlgorithmVersion=LineOfSight.VERSION;m.acceptedMapFingerprint=LineOfSight.fingerprint(state.mapDocument);});};
  $('losCopy').onclick=()=>{const m=selectedMask(),owner=$('losCopyTarget').value;if(!m||view()==='published')return;mutate(()=>{if(state.visibilityMasks.length>=100)throw Error('Maximum 100 masks per scenario.');if(state.visibilityMasks.reduce((n,v)=>n+v.grid.columns*v.grid.rows,0)+m.grid.columns*m.grid.rows>2000000)throw Error('Scenario visibility masks exceed two million cells.');const clone={...M.copy(m),id:M.id(),ownerId:owner,name:m.name+' copy'};state.visibilityMasks.push(clone);active=owner;lastActive=owner;maskId=clone.id;readMask();});};
  $('losDelete').onclick=()=>{const m=selectedMask();if(editable(m))mutate(()=>{state.visibilityMasks=state.visibilityMasks.filter(v=>v.id!==m.id);for(const n of state.nodes)if(n.maskId===m.id)n.maskId=null;maskId='';});};
  sync();return {sync,render,pointerDown,pointerMove,pointerUp,cancelStroke};
})();
