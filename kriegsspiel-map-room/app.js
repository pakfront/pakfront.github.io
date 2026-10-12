'use strict';
const $=id=>document.getElementById(id), NS='http://www.w3.org/2000/svg', M=ViewModel;
let state=M.defaultState(),active=state.nodes.find(n=>n.type==='truth').id;
let selected=null,tool='select',points=[],measurement=null,history=[],box=[0,0,state.mapDocument.coordinateSystem.width,state.mapDocument.coordinateSystem.height],drag=null;
const collapsed=new Set();
let activeEntity=null,activePerson=null;
let treePayload=null, publishing=false,selectedVertex=null,pendingMapDocument=null;
let savedScenarioSignature=JSON.stringify(state);
const current=()=>M.getNode(state,active), view=()=>$('view').value;
const esc=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const pathName=id=>M.ancestorPath(state,id).map(n=>n.name).join(' / ');
const truthNode=()=>state.nodes.find(n=>n.type==='truth');
function node(tag,attrs,parent){const n=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);parent.append(n);return n;}
function text(parent,x,y,value){const n=node('text',{x,y,'text-anchor':'middle'},parent);n.textContent=value;return n;}
function updateThemeButton(){const dark=document.documentElement.dataset.theme==='dark';$('themeToggle').textContent=`Dark mode: ${dark?'on':'off'}`;$('themeToggle').setAttribute('aria-pressed',String(dark));}
$('themeToggle').onclick=()=>{const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;try{localStorage.setItem('kriegsspiel-theme',theme);}catch(e){}updateThemeButton();};
updateThemeButton();
function remember(){history.push({state:M.copy(state),active,activeEntity,activePerson,selected:M.copy(selected),box:box.slice(),selectedVertex:M.copy(selectedVertex)});if(history.length>60)history.shift();}
function mutate(action){const before={state:M.copy(state),active,activeEntity,activePerson,selected:M.copy(selected),box:box.slice(),selectedVertex:M.copy(selectedVertex)};try{const result=action();if(result===false)return false;history.push(before);if(history.length>60)history.shift();sync();return result===undefined?true:result;}catch(e){state=before.state;active=before.active;activeEntity=before.activeEntity;activePerson=before.activePerson;selected=before.selected;box=before.box;selectedVertex=before.selectedVertex;$('status').textContent=e.message;sync();return false;}}
function displayObjects(){if(view()==='published')return current().published?.objects||[];const objects=M.effectiveView(state,active).objects;if(view()!=='overlay')return objects;const ids=new Set(objects.map(o=>o.id));return [...objects,...M.effectiveView(state,truthNode().id).objects.filter(o=>!ids.has(o.id))];}
function record(){return selected?displayObjects().find(o=>o.id===selected.id):null;}
function writable(r=record()){return !!r&&view()!=='published'&&r.ownerId===active;}
function setActive(id,objectId=null){if(!M.getNode(state,id))return;active=id;if(current().type!=='commander'&&view()==='published')$('view').value='draft';if(current().type==='truth'&&view()==='overlay')$('view').value='draft';selected=objectId?{id:objectId}:null;selectedVertex=null;for(const n of M.ancestorPath(state,id))collapsed.delete(n.id);points=[];drag=null;choose(tool);sync();}
function destinations(){return state.nodes.map(n=>`<option value="${esc(n.id)}">${esc(pathName(n.id))}</option>`).join('');}
function sync(){
 if(!current())active=state.rootId;
 if(current().type!=='commander'&&view()==='published')$('view').value='draft';
 if(selected&&!displayObjects().some(o=>o.id===selected.id))selected=null;
 $('nodeName').value=current().name;$('nodeNotes').value=current().privateNotes;$('summary').value=current().summary;
 $('title').value=state.title;$('time').value=state.time;
 const oldCopy=$('copyTarget').value,oldMove=$('moveTarget').value;
 $('copyTarget').innerHTML=destinations();if(state.nodes.some(n=>n.id===oldCopy))$('copyTarget').value=oldCopy;else $('copyTarget').value=active;
 const parents=state.nodes.filter(n=>['root','group'].includes(n.type)&&!M.ancestorPath(state,n.id).some(a=>a.id===active));
 $('moveTarget').innerHTML=parents.map(n=>`<option value="${n.id}">${esc(pathName(n.id))}</option>`).join('');
 if(parents.some(n=>n.id===oldMove))$('moveTarget').value=oldMove;else if(parents.some(n=>n.id===current().parentId))$('moveTarget').value=current().parentId;
 updateMovePosition();
 const branch=['group','commander'].includes(current().type);
 $('moveNode').disabled=!branch||!parents.length;$('moveTarget').disabled=!branch;$('moveBefore').disabled=!branch;
 $('deleteNode').disabled=!branch;
 const published=view()==='published';$('summary').disabled=published;$('nodeName').disabled=published;$('nodeNotes').disabled=published;
 $('view').querySelector('[value="published"]').disabled=current().type!=='commander';
 $('view').querySelector('[value="overlay"]').disabled=current().type==='truth';
 const commander=current().type==='commander';
 $('publish').disabled=!commander||publishing;$('png').disabled=!commander||!current().published;$('pdf').disabled=!commander||!current().published;
 $('publicationStatus').textContent=!commander?'Select a commander to publish or export.':!current().published?'Not published.':`Last published ${new Date(current().published.at).toLocaleString()} · ${current().publicationFingerprint===M.fingerprint(state,active)?'Draft matches publication':'Draft has changed'}`;
 const blocks=M.effectiveView(state,active).summaryBlocks.filter(b=>b.ownerId!==active);
 $('inheritedSummary').innerHTML=published?`<strong>Published situation summary</strong><p class="summary-text">${esc(current().published?.summary||'No published situation summary.')}</p>`:blocks.map(b=>`<strong>${esc(pathName(b.ownerId))}</strong><p class="summary-text">${esc(b.text)}</p>`).join('');
 renderTree();render();edit();if(typeof LosUI!=='undefined')LosUI.sync();if(typeof syncMilitary==='function')syncMilitary();
}
function renderTree(){
 const rows=[];
 function branch(n,depth){
  const kids=M.children(state,n.id),objects=state.objects.filter(o=>o.ownerId===n.id),expandable=kids.length+objects.length>0,open=!collapsed.has(n.id);
  if(n.parentId&&['group','commander'].includes(n.type))rows.push(`<div class="tree-insert" data-before="${n.id}" data-parent="${n.parentId}" aria-hidden="true"></div>`);
  rows.push(`<button class="tree-node ${active===n.id?'active':''}" role="treeitem" aria-level="${depth+1}" aria-selected="${active===n.id}" ${expandable?`aria-expanded="${open}"`:''} data-node="${n.id}" style="--depth:${depth}" draggable="${['group','commander'].includes(n.type)}"><span data-toggle="${n.id}" class="tree-toggle">${expandable?(open?'▾':'▸'):'·'}</span><span class="tree-label">${esc(n.name)}</span><small class="node-type">${n.type==='root'?'all views':n.type==='commander'?'commander view':n.type}</small></button>`);
  if(!open)return;
  for(const o of objects)rows.push(`<button class="tree-object ${selected?.id===o.id&&active===n.id?'active':''}" role="treeitem" aria-level="${depth+2}" aria-selected="${selected?.id===o.id&&active===n.id}" data-object="${o.id}" data-owner="${n.id}" style="--depth:${depth+1}" draggable="true">◇ ${esc(o.label||'Visible area')}</button>`);
  for(const child of kids)branch(child,depth+1);
 }
 branch(M.getNode(state,state.rootId),0);$('tree').innerHTML=rows.join('');
 const items=[...$('tree').querySelectorAll('[role="treeitem"]')];const activeItem=items.find(b=>b.dataset.node===active)||M.ancestorPath(state,active).slice().reverse().map(n=>items.find(b=>b.dataset.node===n.id)).find(Boolean)||items[0];for(const b of items)b.tabIndex=b===activeItem?0:-1;
}
$('tree').onclick=e=>{const toggle=e.target.closest('[data-toggle]');if(toggle){const id=toggle.dataset.toggle;collapsed.has(id)?collapsed.delete(id):collapsed.add(id);renderTree();$('tree').querySelector(`[data-node="${id}"]`)?.focus();return;}const n=e.target.closest('[data-node]'),o=e.target.closest('[data-object]');if(n){setActive(n.dataset.node);$('tree').querySelector(`[data-node="${active}"]`)?.focus();}else if(o){const id=o.dataset.object;setActive(o.dataset.owner,id);$('tree').querySelector(`[data-object="${id}"]`)?.focus();}};
$('tree').onkeydown=e=>{
 const row=e.target.closest('[role="treeitem"]');if(!row)return;
 const rows=[...$('tree').querySelectorAll('[role="treeitem"]')],i=rows.indexOf(row);let target;
 if(e.key==='ArrowDown')target=rows[Math.min(i+1,rows.length-1)];
 if(e.key==='ArrowUp')target=rows[Math.max(i-1,0)];
 if(e.key==='Home')target=rows[0];if(e.key==='End')target=rows.at(-1);
 if(row.dataset.node&&['ArrowLeft','ArrowRight'].includes(e.key)){
  const id=row.dataset.node,n=M.getNode(state,id);
  if(e.key==='ArrowRight'&&row.hasAttribute('aria-expanded')){if(collapsed.has(id)){collapsed.delete(id);renderTree();target=$('tree').querySelector(`[data-node="${id}"]`);}else target=rows[i+1];}
  else if(e.key==='ArrowLeft'&&row.getAttribute('aria-expanded')==='true'){collapsed.add(id);renderTree();target=$('tree').querySelector(`[data-node="${id}"]`);}else if(e.key==='ArrowLeft')target=$('tree').querySelector(`[data-node="${n.parentId||id}"]`);
 }
 if(row.dataset.owner&&e.key==='ArrowLeft')target=$('tree').querySelector(`[data-node="${row.dataset.owner}"]`);
 if(target){e.preventDefault();for(const b of $('tree').querySelectorAll('[role="treeitem"]'))b.tabIndex=-1;target.tabIndex=0;target.focus();}
};
function dragPayload(e){try{const p=JSON.parse(e.dataTransfer.getData('application/x-map-room'));if(p&&['node','object'].includes(p.type)&&typeof p.id==='string')return p;}catch(err){}return treePayload;}
function clearDrop(){document.querySelectorAll('.drop-move,.drop-copy').forEach(n=>n.classList.remove('drop-move','drop-copy'));}
function dropDestination(target,payload){
 const insert=target.closest('[data-before]'),row=target.closest('[data-node]');
 if(payload.type==='node'){
  const n=M.getNode(state,payload.id),parentId=insert?.dataset.parent||row?.dataset.node,parent=M.getNode(state,parentId);
  if(!n||!['group','commander'].includes(n.type)||!parent||!['root','group'].includes(parent.type)||M.ancestorPath(state,parentId).some(a=>a.id===n.id))return null;
  return{element:insert||row,targetId:parentId,beforeId:insert?.dataset.before||null};
 }
 if(!row||!state.objects.some(o=>o.id===payload.id)||state.objects.find(o=>o.id===payload.id).ownerId===row.dataset.node)return null;
 return{element:row,targetId:row.dataset.node};
}
function copyTo(objectId,targetId){return mutate(()=>{const o=M.copyObject(state,objectId,targetId);if(!o)return false;active=targetId;$('view').value='draft';selected={id:o.id};for(const n of M.ancestorPath(state,targetId))collapsed.delete(n.id);$('status').textContent=`Copied object to ${pathName(targetId)}.`;return o;});}
function moveTo(nodeId,targetId,beforeId=null){return mutate(()=>{const changed=M.moveNode(state,nodeId,targetId,beforeId);if(!changed)return false;for(const n of M.ancestorPath(state,nodeId))collapsed.delete(n.id);$('status').textContent='Branch moved. Descendant drafts now use their new ancestors.';return true;});}
function startObjectDrag(e){const row=e.target.closest('[data-object]');if(!row||view()==='published'){e.preventDefault();return;}treePayload={type:'object',id:row.dataset.object};e.dataTransfer.setData('application/x-map-room',JSON.stringify(treePayload));e.dataTransfer.effectAllowed='copy';}
$('tree').ondragstart=e=>{const row=e.target.closest('[data-node]');if(!row){startObjectDrag(e);return;}const n=M.getNode(state,row.dataset.node);if(!['group','commander'].includes(n.type)){e.preventDefault();return;}treePayload={type:'node',id:n.id};e.dataTransfer.setData('application/x-map-room',JSON.stringify(treePayload));e.dataTransfer.effectAllowed='move';};
$('tree').ondragover=e=>{const p=treePayload;if(!p)return;clearDrop();const d=dropDestination(e.target,p);if(!d)return;e.preventDefault();e.dataTransfer.dropEffect=p.type==='node'?'move':'copy';d.element.classList.add(p.type==='node'?'drop-move':'drop-copy');$('status').textContent=`${p.type==='node'?'Move branch':'Copy object'} to ${pathName(d.targetId)}${d.beforeId?' before '+M.getNode(state,d.beforeId).name:''}.`;};
$('tree').ondrop=e=>{e.preventDefault();const p=dragPayload(e);clearDrop();if(!p)return;const d=dropDestination(e.target,p);treePayload=null;if(!d){$('status').textContent='That destination is not valid.';return;}p.type==='node'?moveTo(p.id,d.targetId,d.beforeId):copyTo(p.id,d.targetId);};
document.addEventListener('dragend',()=>{treePayload=null;clearDrop();});
$('roster').ondragstart=startObjectDrag;
$('roster').onclick=e=>{const row=e.target.closest('[data-object]');if(row){selected={id:row.dataset.object};renderTree();render();edit();}};
function updateMovePosition(){const old=$('moveBefore').value,siblings=M.children(state,$('moveTarget').value).filter(n=>n.id!==active);$('moveBefore').innerHTML='<option value="">At the end</option>'+siblings.map(n=>`<option value="${n.id}">Before ${esc(n.name)}</option>`).join('');if(siblings.some(n=>n.id===old))$('moveBefore').value=old;}
$('moveTarget').onchange=updateMovePosition;
$('moveNode').onclick=()=>moveTo(active,$('moveTarget').value,$('moveBefore').value||null);
$('copyObject').onclick=()=>{if(selected&&view()!=='published')copyTo(selected.id,$('copyTarget').value);};
for(const [button,type] of [['addGroup','group'],['addCommander','commander']])$(button).onclick=()=>{const name=prompt(`${type==='group'?'Group':'Commander view'} name`);if(!name?.trim())return;mutate(()=>{const parent=['root','group'].includes(current().type)?active:current().parentId;const n=M.addNode(state,parent,type,name);active=n.id;selected=null;$('view').value='draft';collapsed.delete(parent);});};
$('deleteNode').onclick=()=>mutate(()=>{active=M.deleteNode(state,active);selected=null;});
for(const [field,key]of [['nodeName','name'],['nodeNotes','privateNotes'],['summary','summary']])$(field).onchange=()=>{if(view()==='published')return;const value=$(field).value;mutate(()=>{if(key==='name'&&!value.trim())throw Error('Enter a view name.');current()[key]=key==='name'?value.trim():value;});};
for(const field of ['title','time'])$(field).onchange=()=>{const value=$(field).value;mutate(()=>state[field]=value);};
$('view').onchange=()=>{selected=null;points=[];const settings=MapDocument.settings(view()==='published'?(current().published||state):state);box=[0,0,settings.width,settings.height];sync();};$('opacity').oninput=render;$('links').onchange=render;
$('editAtOwner').onclick=()=>{const r=record();if(r?.ownerId)setActive(r.ownerId,r.id);};
const fields=['label','kind','side','facing','strength','activity','observed','radius','notes','presentation'];
function edit(){
 const r=record();if(typeof editMilitaryLink==='function')editMilitaryLink(r);$('editor').hidden=!r;$('empty').hidden=!!r;$('objectOwner').textContent=r?view()==='published'?'Frozen published object.':`${r.ownerId===active?'Owned here':'Inherited / comparison'} · ${pathName(r.ownerId)}`:'';
 $('editAtOwner').hidden=!r||view()==='published'||r.ownerId===active;
 $('copyControls').hidden=!r||view()==='published';$('copyObject').disabled=!r||$('copyTarget').value===r.ownerId;
 if(!r)return;$('counterFields').hidden=['region','annotation'].includes(r.type);editGeometry(r);
 for(const f of fields){$(f).value=r[f]??(f==='presentation'?'reported':'');$(f).disabled=!writable(r);}
 $('falseContact').checked=!!r.falseContact;for(const f of ['falseContact','delete','duplicate'])$(f).disabled=!writable(r);
}
$('copyTarget').onchange=edit;
for(const f of fields)$(f).onchange=()=>{if(!writable())return;const value=['facing','radius'].includes(f)?Number($(f).value):$(f).value;mutate(()=>{if(['facing','radius'].includes(f)&&(!Number.isFinite(value)||(f==='radius'&&value<0)))throw Error('Enter a valid number.');M.editObject(state,selected.id,active,{[f]:value});});};
$('falseContact').onchange=()=>{if(writable()){const checked=$('falseContact').checked;mutate(()=>M.editObject(state,selected.id,active,{falseContact:checked}));}};
function remove(){if(writable())mutate(()=>{M.deleteObject(state,selected.id,active);selected=null;});}
$('delete').onclick=remove;
$('duplicate').onclick=()=>{if(!writable())return;mutate(()=>{const r=record(),n={...M.copy(r),id:M.id(),label:r.label+' copy'};if(r.type==='region')n.points=n.points.map(([x,y])=>[x+35,y+35]);else if(r.type==='annotation')n.geometry=Geometry.translate(n.geometry,35,35);else{n.x+=60;n.y+=35;}state.objects.push(n);selected={id:n.id};});};
function symbol(parent,r,contact=false,scale=state.mapDocument.coordinateSystem.metersPerUnit,showSelection=true){const g=node('g',{'data-id':r.id,'data-type':contact?'contact':'unit',transform:`translate(${r.x} ${r.y})`,style:'cursor:pointer'},parent),color={blue:'#375e79',red:'#994936',unknown:'#756e59'}[r.side]||'#756e59';
 if(contact&&+r.radius>0)node('circle',{r:r.radius/scale,fill:color,'fill-opacity':.08,stroke:color,'stroke-dasharray':'5 5'},g);
 const outlined=contact&&r.presentation!=='confirmed'; const s=node('g',{transform:`rotate(${r.facing||0})`},g);
 if(r.kind==='marker'){node('path',{d:'M0 -13 L13 0 L0 13 L-13 0 Z',fill:outlined?'#fff7e3':color,stroke:color,'stroke-width':2},s);text(s,0,5,'?')}
 else {node('rect',{x:-24,y:-10,width:48,height:20,rx:1,fill:outlined?'#fff7e3':color,stroke:outlined?color:'#25362c','stroke-width':2,'stroke-dasharray':outlined?'4 2':'none'},s);const ink=outlined?color:'#fff7e3';if(r.kind==='infantry')node('path',{d:'M-22 -8 L22 8 M-22 8 L22 -8',stroke:ink,'stroke-width':1.4},s);if(r.kind==='cavalry')node('path',{d:'M-22 8 L22 -8',stroke:ink,'stroke-width':2},s);if(r.kind==='artillery'){for(const x of [-12,0,12])node('circle',{cx:x,cy:0,r:3,fill:ink},s)}if(r.kind==='hq'){const t=text(s,0,5,'HQ');t.setAttribute('fill',ink);t.setAttribute('stroke','none');t.setAttribute('font-size',12)}}
 text(g,0,29,r.label);if(contact&&r.observed)text(g,0,45,r.observed).setAttribute('font-size',11);if(showSelection&&selected?.id===r.id)node('rect',{x:-30,y:-16,width:60,height:32,fill:'none',stroke:'#c79225','stroke-width':3},g);return g;}
function drawRegion(parent,r){return node('polygon',{points:r.points.map(p=>p.join(',')).join(' '),fill:'#567d62','fill-opacity':.13,stroke:selected?.id===r.id?'#c79225':'#426b4b','stroke-width':3,'stroke-dasharray':'10 5','data-id':r.id},parent);}
function render(){
 const published=view()==='published',snapshot=published?current().published:null,source=snapshot||state,settings=MapDocument.settings(source);
 MapRenderer.render($('terrain'),source.mapDocument,{interactive:true});$('map').setAttribute('viewBox',box.join(' '));if(typeof LosUI!=='undefined')LosUI.render(snapshot);
 for(const id of ['truth','contacts','regions','connections','measure'])$(id).replaceChildren();
 const effective=published?(snapshot?.objects||[]):M.effectiveView(state,active).objects;
 const ids=new Set(effective.map(o=>o.id));
 const comparison=view()==='overlay'?M.effectiveView(state,truthNode().id).objects.filter(o=>!ids.has(o.id)):[];
 $('contacts').setAttribute('opacity',view()==='overlay'?$('opacity').value:1);
 function draw(r,comparison=false){const owner=!published?M.getNode(state,r.ownerId):null;if(r.type==='region'){drawRegion(comparison?$('truth'):$('regions'),r);return;}if(r.type==='annotation'){drawAnnotation(comparison?$('truth'):$('regions'),r);return;}const truth=owner?.type==='truth';symbol(comparison?$('truth'):$('contacts'),r,!truth,settings.metersPerPixel);}
 for(const r of comparison)draw(r,true);for(const r of effective)draw(r);
 if(view()==='overlay'&&$('links').checked)for(const r of effective){const u=state.objects.find(o=>o.id===r.truthId&&o.ownerId===truthNode().id);if(u&&!['region','annotation'].includes(r.type))node('line',{x1:u.x,y1:u.y,x2:r.x,y2:r.y,stroke:'#6e664f','stroke-width':2,'stroke-dasharray':'3 5'},$('connections'));}
 renderMeasurements(settings);renderGeometryHandles();renderTerrainInspector(source.mapDocument);
 $('scale').textContent=`${settings.calibrated?'Calibrated':'Provisional scale'} · ${settings.metersPerPixel.toFixed(2)} m / image pixel`;
 const own=effective.filter(o=>published||o.ownerId===active),inherited=effective.filter(o=>!published&&o.ownerId!==active);
 function rows(list){return list.map(o=>`<button data-object="${o.id}" draggable="${!published}" class="${selected?.id===o.id?'active':''}">${esc(o.label)}${!published&&o.ownerId!==active?`<small>${esc(pathName(o.ownerId))}</small>`:''}</button>`).join('');}
 $('roster').innerHTML=`<h3>${published?'Published objects':'Owned here'}</h3>${rows(own)||'<p class="hint">No objects.</p>'}${inherited.length?'<h3>Inherited</h3>'+rows(inherited):''}`;
 $('status').dataset.destination=current().name;
}
function routeTime(meters,kph){const seconds=Math.round(meters*3.6/kph),hours=Math.floor(seconds/3600),minutes=Math.floor(seconds%3600/60),remainder=seconds%60;return hours?`${hours}h ${minutes}m ${remainder}s`:`${minutes}m ${remainder}s`;}
function renderMeasurements(settings){
 $('calibrationMeasured').textContent=tool==='calibrate'&&points.length===2?`Current measured value: ${(Math.hypot(points[1][0]-points[0][0],points[1][1]-points[0][1])*state.mapDocument.coordinateSystem.metersPerUnit).toFixed(2)} m (${state.mapDocument.coordinateSystem.calibrated?'current scale':'provisional scale'})`:'Current measured value: select two points';
 const p=points.length?points:measurement?.points||[],kind=points.length?tool:measurement?.kind,speed=Number($('routeSpeed').value),valid=Number.isFinite(speed)&&speed>0;
 $('routeOptions').hidden=tool!=='ruler'&&kind!=='ruler';$('routeSpeedMessage').textContent=valid?'Constant-speed estimate; no terrain or rest allowance.':'Enter a speed greater than zero to estimate time.';
 if(!p.length||view()==='published')return;
 node('polyline',{points:p.map(x=>x.join(',')).join(' '),fill:'none',stroke:'#b27613','stroke-width':3},$('measure'));
 let d=0;for(let i=0;i<p.length;i++){const x=p[i];node('circle',{cx:x[0],cy:x[1],r:4,fill:'#b27613'},$('measure'));if(i>0)d+=Math.hypot(x[0]-p[i-1][0],x[1]-p[i-1][1]);if(kind==='ruler'){const meters=d*settings.metersPerPixel;const label=text($('measure'),x[0],x[1]-14,`${meters.toFixed(0)} m · ${valid?routeTime(meters,speed):'time unavailable'}`);label.setAttribute('font-size',12);}else if(i===p.length-1&&p.length>1)text($('measure'),x[0],x[1]-12,`${(d*settings.metersPerPixel).toFixed(0)} m`);}
 if(kind==='circle'&&p.length===2)node('circle',{cx:p[0][0],cy:p[0][1],r:d,fill:'none',stroke:'#b27613','stroke-width':2},$('measure'));
}
$('routeSpeed').oninput=render;
function choose(t){if(typeof LosUI!=='undefined')LosUI.cancelStroke();endMapDrag(true);tool=t;points=[];selectedVertex=null;$('annotationOptions').hidden=t!=='annotation';$('calibration').hidden=t!=='calibrate';$('applyCalibration').disabled=true;document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===t));$('status').textContent={select:'Select objects. Edit inherited objects at their owner.',pan:'Drag to pan the map.',counter:`Click to place a counter in ${pathName(active)}.`,marker:`Click to place a marker in ${pathName(active)}.`,polygon:`Draw a visible area owned by ${pathName(active)}, then Finish drawing.`,annotation:`Draw an annotation owned by ${pathName(active)}.`,insert:'Select an owned area or annotation, then click a segment to insert a vertex.',ruler:'Click route points, then Finish drawing.',circle:'Click center, then radius point.',calibrate:'Click two map points and enter their real-world distance.'}[t]||(t.startsWith('los')?'Place an observer and target, or use the LOS panel.':'Select a tool.');render();}
document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>choose(b.dataset.tool));
function pos(e){return MapViewport.position($('map'),e);}
$('map').onpointerdown=e=>{
 if(e.button!==0)return;$('map').focus({preventScroll:true});const p=pos(e),target=e.target.closest('[data-id]');
 if(typeof LosUI!=='undefined'&&LosUI.pointerDown(e,p))return;
 if(tool==='pan'){drag={type:'pan',start:p};$('map').setPointerCapture(e.pointerId);return;}
 if(tool==='select'){
  const handle=e.target.closest('[data-vertex]');selected=target?{id:target.dataset.id}:null;selectedVertex=handle?{ring:Number(handle.dataset.ring),index:Number(handle.dataset.vertex)}:null;
  const terrain=e.target.closest('[data-feature]');if(terrain){$('terrainFeature').value=terrain.dataset.feature;terrainDetails();}
  const r=record();if(writable(r)){if(objectGeometry(r)){drag={type:'geometry',r,start:p,geometry:M.copy(objectGeometry(r)),vertex:selectedVertex,before:M.copy(state),changed:false};}else drag={type:'record',r,offset:[r.x-p[0],r.y-p[1]],before:M.copy(state),changed:false};$('map').setPointerCapture(e.pointerId);}renderTree();render();edit();return;
 }
 if(view()==='published'){$('status').textContent='Choose Draft to edit or measure.';return;}
 if(tool==='insert'){const r=record();if(!writable(r)||!objectGeometry(r)){$('status').textContent='Select an owned area or annotation first.';return;}mutate(()=>setObjectGeometry(r,GeometryEditor.insertVertex(objectGeometry(r),p)));return;}
 if(['counter','marker'].includes(tool)){
  mutate(()=>{const r={id:M.id(),ownerId:active,type:tool,label:tool==='marker'?'Map marker':current().type==='truth'?'New regiment':'Reported infantry',kind:tool==='marker'?'marker':'infantry',side:current().type==='truth'?'blue':'unknown',x:p[0],y:p[1],facing:0,strength:'',activity:'',observed:state.time,radius:0,presentation:current().type==='truth'?'confirmed':'reported',notes:'',falseContact:false};state.objects.push(r);selected={id:r.id};});choose('select');edit();return;
 }
 if(tool==='calibrate'&&points.length===2)points=[];points.push(p);
 if(tool==='calibrate'){$('applyCalibration').disabled=points.length!==2;$('calibrationMessage').textContent=points.length===2?'Enter the known distance and click Apply calibration.':'Click the second point.';}
 if(tool==='annotation'&&MapDocument.presets.annotation[$('annotationPreset').value][1]==='Point')finish();
 if(tool==='circle'&&points.length===2)finish();render();
};
$('map').onpointermove=e=>{if(typeof LosUI!=='undefined'&&LosUI.pointerMove(e,pos(e)))return;if(!drag)return;const p=pos(e);if(drag.type==='record'){const x=p[0]+drag.offset[0],y=p[1]+drag.offset[1];if(x!==drag.r.x||y!==drag.r.y){if(!drag.changed)remember();drag.changed=true;drag.r.x=x;drag.r.y=y;}render();}else if(drag.type==='geometry'){const g=drag.vertex?GeometryEditor.moveVertex(drag.geometry,drag.vertex.ring,drag.vertex.index,p):Geometry.translate(drag.geometry,p[0]-drag.start[0],p[1]-drag.start[1]);if(JSON.stringify(g)!==JSON.stringify(objectGeometry(drag.r))){if(!drag.changed)remember();drag.changed=true;setObjectGeometry(drag.r,g,false);}render();}else{box[0]+=drag.start[0]-p[0];box[1]+=drag.start[1]-p[1];render();}};
function endMapDrag(cancel=false){if(!drag)return;const completed=drag;drag=null;if(completed.changed){try{if(cancel)throw Error('Edit cancelled.');if(completed.type==='geometry')Geometry.validate(objectGeometry(completed.r));}catch(e){state=completed.before;history.pop();$('status').textContent=e.message;}sync();}}
$('map').onpointerup=()=>{if(typeof LosUI!=='undefined')LosUI.pointerUp();endMapDrag();};$('map').onpointercancel=()=>{if(typeof LosUI!=='undefined')LosUI.cancelStroke();endMapDrag(true);};
$('map').onwheel=e=>{e.preventDefault();const settings=MapDocument.settings(view()==='published'?(current().published||state):state);box=MapViewport.zoom(box,pos(e),e.deltaY,settings.width);render();};
function finish(){if(view()==='published')return;if(tool==='polygon'&&points.length>=3){if(mutate(()=>{Geometry.validate(Geometry.fromPoints('Polygon',points));const r={id:M.id(),ownerId:active,type:'region',label:'Visible area',points:M.copy(points),notes:'',falseContact:false};state.objects.push(r);selected={id:r.id};})){points=[];}render();edit();}else if(tool==='annotation'){const subtype=$('annotationPreset').value,type=MapDocument.presets.annotation[subtype][1];if(points.length<(type==='Point'?1:type==='LineString'?2:3))return;if(mutate(()=>{const f=MapDocument.feature('annotation',subtype,points,'annotation');Geometry.validate(f.geometry);const r={id:M.id(),ownerId:active,type:'annotation',subtype,label:f.name,geometry:f.geometry,style:f.style,notes:'',falseContact:false};state.objects.push(r);selected={id:r.id};})){points=[];choose('select');edit();}}else if(['ruler','circle'].includes(tool)&&points.length>=2){measurement={kind:tool,points:M.copy(points)};points=[];render();}}
$('finish').onclick=finish;$('map').ondblclick=e=>{e.preventDefault();if(points.length>1&&Math.hypot(points.at(-1)[0]-points.at(-2)[0],points.at(-1)[1]-points.at(-2)[1])<1)points.pop();finish();};
$('fit').onclick=()=>{box=MapViewport.fit((view()==='published'?(current().published||state):state).mapDocument);render();};
$('clearMeasure').onclick=()=>{measurement=null;points=[];render();};
$('applyCalibration').onclick=()=>{if(view()==='published'||points.length!==2)return;const pixels=Math.hypot(points[1][0]-points[0][0],points[1][1]-points[0][1]),value=Number($('calibrationDistance').value);if(!Number.isFinite(value)||value<=0||pixels<=0){$('calibrationMessage').textContent='Enter a positive distance and select two distinct points.';return;}mutate(()=>{state.mapDocument.coordinateSystem.metersPerUnit=value/pixels;state.mapDocument.coordinateSystem.calibrated=true;});measurement={kind:'ruler',points:M.copy(points)};choose('select');$('status').textContent=`Calibration applied: ${value} meters between selected points.`;};
$('calibrationDistance').onkeydown=e=>{if(e.key==='Enter')$('applyCalibration').click();};
$('undo').onclick=()=>{if(!history.length)return;const prev=history.pop();state=prev.state;active=prev.active;activeEntity=prev.activeEntity;activePerson=prev.activePerson;selected=prev.selected;box=prev.box||box;selectedVertex=prev.selectedVertex||null;drag=null;points=[];sync();};
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
async function savedScenario(source=state){const s=M.copy(source);s.mapDocument=await MapFiles.embed(s.mapDocument);for(const n of s.nodes)if(n.published&&n.publicationFingerprint){const content=JSON.parse(n.publicationFingerprint);if(content.mapDocument.background?.data==='fake-pea-ridge-map.jpg')content.mapDocument.background.data=n.published.mapDocument.background.data;n.publicationFingerprint=JSON.stringify(content);}return s;}
$('save').onclick=async()=>{try{const captured=M.copy(state),s=await savedScenario(captured);M.validateScenario(s);download(new Blob([JSON.stringify(s,null,2)],{type:'application/json'}),'kriegsspiel-scenario.json');savedScenarioSignature=JSON.stringify(captured);}catch(e){alert(e.message);}};
$('load').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const s=M.validateScenario(JSON.parse(await file.text()));mutate(()=>{state=s;active=s.rootId;selected=null;selectedVertex=null;box=MapViewport.fit(s.mapDocument);points=[];measurement=null;collapsed.clear();$('view').value='draft';});savedScenarioSignature=JSON.stringify(state);$('status').textContent='Scenario loaded.';}catch(err){alert('Could not load scenario: '+err.message);}e.target.value='';};
$('mapFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const b=await MapFiles.image(file);mutate(()=>{state.mapDocument.background=b;if(!state.mapDocument.features.length){state.mapDocument.coordinateSystem.width=b.width;state.mapDocument.coordinateSystem.height=b.height;}state.mapDocument.coordinateSystem.calibrated=false;state.mapDocument.revision++;if(view()!=='published')box=MapViewport.fit(state.mapDocument);});$('status').textContent='Background loaded. Recalibrate scale; existing coordinates are retained.';}catch(err){alert('Map could not be loaded: '+err.message);}e.target.value='';};
$('battlefieldFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{pendingMapDocument=await MapFiles.open(file);const compatible=MapDocument.compatible(state.mapDocument,pendingMapDocument),c=pendingMapDocument.coordinateSystem;const needsClear=!compatible&&(state.objects.length>0||state.visibilityMasks.length>0);$('mapImportSummary').textContent=`${pendingMapDocument.title} · ${c.width} × ${c.height} map units · ${c.metersPerUnit} m/unit · ${pendingMapDocument.features.length} features · revision ${pendingMapDocument.revision}. ${needsClear?'This map uses a different identity or coordinate frame. Existing scenario placements and visibility masks must be cleared.':'Existing scenario coordinates will be retained.'}`;$('clearPlacementChoice').hidden=!needsClear;$('clearPlacements').checked=false;$('applyMapImport').disabled=needsClear;$('mapImportDialog').showModal();}catch(err){alert('Could not import battlefield: '+err.message);}finally{e.target.value='';}};
$('clearPlacements').onchange=()=>{$('applyMapImport').disabled=!$('clearPlacementChoice').hidden&&!$('clearPlacements').checked;};
$('cancelMapImport').onclick=()=>{$('mapImportDialog').close();pendingMapDocument=null;};$('mapImportDialog').oncancel=()=>pendingMapDocument=null;
$('applyMapImport').onclick=()=>{if(!pendingMapDocument)return;const d=pendingMapDocument,needsClear=!MapDocument.compatible(state.mapDocument,d)&&(state.objects.length>0||state.visibilityMasks.length>0);if(needsClear&&!$('clearPlacements').checked)return;if(mutate(()=>{if(needsClear){state.objects=[];state.visibilityMasks=[];for(const n of state.nodes)n.maskId=null;}state.mapDocument=M.copy(d);selected=null;selectedVertex=null;points=[];measurement=null;if(view()!=='published')box=MapViewport.fit(d);})){pendingMapDocument=null;$('mapImportDialog').close();$('status').textContent='Battlefield imported. Existing publications remain frozen.';}};
async function publish(){if(current().type!=='commander'||publishing)return;const nodeId=active,captured=M.copy(state);publishing=true;sync();try{const data=await MapFiles.embed(captured.mapDocument);M.publishCommander(captured,nodeId,data);if(!M.getNode(state,nodeId))throw Error('Commander was removed before publication finished.');mutate(()=>{const n=M.getNode(state,nodeId),snapshot=M.getNode(captured,nodeId);n.published=snapshot.published;n.publicationFingerprint=snapshot.publicationFingerprint;});$('status').textContent=`Published ${M.getNode(state,nodeId).name} at ${captured.time}.`;}catch(e){alert(e.message);}finally{publishing=false;sync();}}
$('publish').onclick=publish;
async function exportImage(snapshot=current().published){
 if(!snapshot)throw Error('Publish this commander before exporting.');const p={...snapshot,...MapDocument.settings(snapshot)},svg=document.createElementNS(NS,'svg');svg.setAttribute('xmlns',NS);svg.setAttribute('width',p.width);svg.setAttribute('height',p.height+90);svg.setAttribute('viewBox',`0 0 ${p.width} ${p.height+90}`);
 node('rect',{width:p.width,height:p.height+90,fill:'#faf4e4'},svg);MapRenderer.render(node('g',{},svg),p.mapDocument);VisibilityMask.render(node('g',{},svg),p.visibilityMask||null);
 for(const r of p.objects){if(r.type==='annotation'){drawAnnotation(svg,r,false);continue;}if(r.type==='region'){node('polygon',{points:r.points.map(p=>p.join(',')).join(' '),fill:'#567d62','fill-opacity':.12,stroke:'#426b4b','stroke-width':2,'stroke-dasharray':'8 5'},svg);continue;}const g=symbol(svg,r,true,p.metersPerPixel,false);g.removeAttribute('data-id');g.removeAttribute('data-type');g.querySelectorAll('text').forEach(n=>{n.setAttribute('font-family','Georgia');n.setAttribute('font-size',n.getAttribute('font-size')||15);n.setAttribute('paint-order','stroke');n.setAttribute('stroke','#fff6dc');n.setAttribute('stroke-width',3);});}
 text(svg,p.width/2,p.height+30,`${p.title} · ${p.name} · ${p.time}`);const length=Math.min(150,p.width/5),y=p.height+55;node('path',{d:`M30 ${y-5} V${y+5} M30 ${y} H${30+length} M${30+length} ${y-5} V${y+5}`,stroke:'#283c30','stroke-width':2},svg);text(svg,30+length/2,y+22,`${Math.round(length*p.metersPerPixel)} m${p.calibrated?'':' (provisional)'}`);
 const img=new Image();img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(svg));await img.decode();const canvas=document.createElement('canvas');canvas.width=p.width;canvas.height=p.height+90;canvas.getContext('2d').drawImage(img,0,0);return canvas;
}
$('png').onclick=async()=>{try{const p=current().published,canvas=await exportImage(p);const b=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!b)throw Error('PNG encoding failed.');download(b,`${p.name.replace(/[^a-z0-9]/gi,'-')}-map.png`);}catch(e){alert(e.message);}};
$('pdf').onclick=async()=>{const p=current().published,w=window.open('','_blank');if(!w){alert('Allow a popup to open the printable situation summary.');return;}w.document.write('<p>Preparing published situation summary…</p>');try{const canvas=await exportImage(p);w.document.open();w.document.write(`<!doctype html><html><head><title>${esc(p.name)} situation summary</title><style>@page{size:A4 landscape;margin:12mm}body{font:12px Georgia;color:#263b2d}img{width:100%;max-height:165mm;object-fit:contain}table{width:100%;border-collapse:collapse}td,th{padding:7px;text-align:left;border-bottom:1px solid #ccc}h1{font-size:22px}.notes{white-space:pre-wrap}@media print{button{display:none}.summary{break-before:page}}</style></head><body><button onclick="window.print()">Print / Save as PDF</button><h1>${esc(p.title)} · ${esc(p.name)} · ${esc(p.time)}</h1><img src="${canvas.toDataURL('image/png')}"><section class="summary"><h1>Reported objects</h1><table><thead><tr><th>Object</th><th>Strength estimate</th><th>Activity</th><th>Observed</th></tr></thead><tbody>${p.objects.map(r=>`<tr><td>${esc(r.label)}</td><td>${esc(r.strength)}</td><td>${esc(r.activity)}</td><td>${esc(r.observed)}</td></tr>`).join('')}</tbody></table><h2>Situation summary</h2><div class="notes">${esc(p.summary)}</div></section></body></html>`);w.document.close();}catch(e){w.close();alert(e.message);}};
document.onkeydown=e=>{if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName))return;if(e.key==='Escape'){endMapDrag(true);points=[];treePayload=null;clearDrop();choose('select');}if(e.key==='Delete'&&document.activeElement.closest('#map,#roster,#editor'))remove();};

function objectGeometry(r){return r?.type==='annotation'?r.geometry:r?.type==='region'?Geometry.fromPoints('Polygon',r.points):null;}
function setObjectGeometry(r,g,validate=true){if(validate)Geometry.validate(g);if(r.type==='region')r.points=g.coordinates[0].slice(0,-1);else r.geometry=g;}
function drawAnnotation(parent,r,interactive=true){const g=MapRenderer.feature(parent,{id:r.id,category:'annotation',subtype:r.subtype,name:r.label,geometry:r.geometry,properties:{},style:r.style});if(interactive)g.setAttribute('data-id',r.id);return g;}
function renderGeometryHandles(){const parent=$('objectEditing');parent.replaceChildren();const r=record(),geometry=objectGeometry(r);if(!geometry||view()==='published')return;const size=MapViewport.tolerance($('map'),5);for(const h of GeometryEditor.handles(geometry))node('circle',{cx:h.point[0],cy:h.point[1],r:size,fill:selectedVertex?.ring===h.ring&&selectedVertex?.index===h.index?'#ffc04d':'#fff6dc',stroke:writable(r)?'#b47716':'#777','stroke-width':2,'vector-effect':'non-scaling-stroke','data-id':r.id,'data-ring':h.ring,'data-vertex':h.index},parent);}
function editGeometry(r){const geometry=objectGeometry(r);$('geometryFields').hidden=!geometry;$('annotationFields').hidden=r.type!=='annotation';if(r.type==='annotation')for(const [field,key]of [['annotationStroke','stroke'],['annotationFill','fill'],['annotationStrokeWidth','strokeWidth'],['annotationOpacity','opacity'],['annotationFontSize','fontSize'],['annotationDashed','dashed']]){if(key==='dashed')$(field).checked=r.style[key];else $(field).value=r.style[key];$(field).disabled=!writable(r);}const h=geometry&&selectedVertex&&GeometryEditor.handles(geometry).find(v=>v.ring===selectedVertex.ring&&v.index===selectedVertex.index);$('objectVertexFields').hidden=!h;if(h){$('objectVertexX').value=h.point[0];$('objectVertexY').value=h.point[1];for(const f of ['objectVertexX','objectVertexY','removeObjectVertex'])$(f).disabled=!writable(r);}}
for(const [field,key]of [['annotationStroke','stroke'],['annotationFill','fill'],['annotationStrokeWidth','strokeWidth'],['annotationOpacity','opacity'],['annotationFontSize','fontSize'],['annotationDashed','dashed']])$(field).onchange=()=>{const r=record();if(!writable(r)||r.type!=='annotation')return;const value=key==='dashed'?$(field).checked:['stroke','fill'].includes(key)?$(field).value:Number($(field).value);mutate(()=>{r.style[key]=value;MapDocument.validateStyle(r.style);});};
for(const field of ['objectVertexX','objectVertexY'])$(field).onchange=()=>{const r=record();if(!writable(r)||!selectedVertex)return;const p=[Number($('objectVertexX').value),Number($('objectVertexY').value)];mutate(()=>setObjectGeometry(r,GeometryEditor.moveVertex(objectGeometry(r),selectedVertex.ring,selectedVertex.index,p)));};
$('removeObjectVertex').onclick=()=>{const r=record();if(!writable(r)||!selectedVertex)return;mutate(()=>{setObjectGeometry(r,GeometryEditor.removeVertex(objectGeometry(r),selectedVertex.ring,selectedVertex.index));selectedVertex=null;});};
$('annotationPreset').onchange=()=>{points=[];render();};
function renderTerrainInspector(d){const field=$('terrainFeature'),value=field.value;field.replaceChildren(new Option('Select a terrain feature',''));for(const f of d.features)field.add(new Option(`${f.name||f.subtype} · ${f.category}`,f.id));if(d.features.some(f=>f.id===value))field.value=value;terrainDetails(d);}
function terrainDetails(d=(view()==='published'?(current().published||state):state).mapDocument){const f=d.features.find(f=>f.id===$('terrainFeature').value);if(!f){$('terrainDetails').textContent='Physical features are read-only here. Edit the reusable map in Map Maker.';return;}const p=f.properties,parts=[`${f.name||f.subtype} · ${f.category}`];if(f.category==='elevation')parts.push(`Elevation: ${d.coordinateSystem.baselineElevationMeters+p.relativeHeightMeters} m (${p.relativeHeightMeters>=0?'+':''}${p.relativeHeightMeters} m relative)`);for(const key of ['movement','crossing','cover','sight'])if(p[key])parts.push(`${key[0].toUpperCase()+key.slice(1)}: ${p[key]}`);for(const [key,label]of [['widthMeters','Width'],['heightMeters','Height']])if(p[key]>0)parts.push(`${label}: ${p[key]} m`);if(p.relatedFeatureIds?.length)parts.push('Related: '+p.relatedFeatureIds.map(id=>d.features.find(v=>v.id===id)?.name||'Unnamed feature').join(', '));$('terrainDetails').textContent=parts.join(' · ');}
$('terrainFeature').onchange=()=>terrainDetails();
document.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName))return;const r=record();if(e.key.startsWith('Arrow')&&document.activeElement.closest('#map')&&writable(r)&&objectGeometry(r)){e.preventDefault();const amount=e.shiftKey?10:1,dx=e.key==='ArrowLeft'?-amount:e.key==='ArrowRight'?amount:0,dy=e.key==='ArrowUp'?-amount:e.key==='ArrowDown'?amount:0;mutate(()=>setObjectGeometry(r,Geometry.translate(objectGeometry(r),dx,dy)));}});
window.addEventListener('beforeunload',e=>{if(JSON.stringify(state)!==savedScenarioSignature){e.preventDefault();e.returnValue='';}});
sync();
