'use strict';
const F=ForceModel,militaryCollapsed=new Set();
const operational=()=>$('structure').value==='operational';
const entity=()=>F.get(state,activeEntity);
const militaryName=(id,ops=false)=>F.path(state,id,ops).map(e=>e.name).join(' / ');
function commanderOptions(){return '<option value="">Unassigned</option>'+state.military.commanders.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');}
function commandAssignments(commanderId){return commanderId?state.military.entities.filter(e=>e.commanderId===commanderId):[];}
function updateCommandWarning(element,assignments){const message=`Multiple command assignments (${assignments.length}): ${assignments.map(e=>e.name).join('; ')}.`;element.hidden=assignments.length<=1;element.title=message;element.setAttribute('aria-label',message);}
function militaryOptions(){return '<option value="">No military link</option>'+state.military.entities.map(e=>`<option value="${e.id}">${esc(militaryName(e.id))}</option>`).join('');}
function syncMilitary(){
 if(!entity())activeEntity=F.children(state,null)[0]?.id||null;
 if(!F.commander(state,activePerson))activePerson=state.military.commanders[0]?.id||null;
 const workspace=$('structure').value,military=['oob','operational'].includes(workspace),e=entity();
 $('viewControls').hidden=workspace!=='views';$('militaryControls').hidden=!military;$('commanderControls').hidden=workspace!=='commanders';
 $('militaryHeading').textContent=operational()?'Operational command':'Order of battle';
 $('militaryTree').setAttribute('aria-label',operational()?'Operational command':'Order of battle');
 $('militaryHelp').textContent=operational()?'Temporary attachments. Units follow their OOB parent unless explicitly attached elsewhere.':'Permanent formation and unit membership. Operational attachments can differ.';
 const mapLabel=`Map view: ${pathName(active)}${view()==='published'?' (published)':''}`;$('activeViewLabel').textContent=mapLabel;$('commanderViewLabel').textContent=mapLabel;
 $('militaryEditor').hidden=!e;$('addFormation').disabled=!e;$('addUnit').disabled=!e;
 renderMilitaryTree();
 if(e){
  $('entityName').value=e.name;$('entityEchelon').value=e.echelon;$('entityNotes').value=e.notes;$('entityKind').value=e.kind;$('forceSide').value=e.side;
  $('entityKindField').hidden=e.type!=='unit';$('forceSideField').hidden=e.type!=='force';
  $('entityType').textContent=e.type==='force'?'Force root':e.type==='formation'?'Formation':'Unit';
  $('entityCommander').innerHTML=commanderOptions();$('entityCommander').value=e.commanderId||'';
  updateCommandWarning($('commanderWarning'),commandAssignments(e.commanderId));
  $('organicPath').textContent=`OOB: ${militaryName(e.id)}`;
  $('operationalPath').textContent=`Operational: ${militaryName(e.id,true)}${e.operationalParentId?' · Explicit attachment':' · Follows OOB parent'}`;
  const old=$('militaryParent').value,targets=state.military.entities.filter(t=>['force','formation'].includes(t.type)&&F.forceId(state,t.id)===F.forceId(state,e.id)&&!F.path(state,t.id,operational()).some(a=>a.id===e.id));
  $('militaryParent').innerHTML=targets.map(t=>`<option value="${t.id}">${esc(militaryName(t.id,operational()))}</option>`).join('');
  if(targets.some(t=>t.id===old))$('militaryParent').value=old;else if(targets.some(t=>t.id===F.parentId(e,operational())))$('militaryParent').value=F.parentId(e,operational());
  const label=operational()?'Attach operationally to':'Move in OOB to';$('militaryParentLabel').firstChild.textContent=label;
  $('moveMilitary').textContent=operational()?'Attach operationally':'Move in OOB';
  $('militaryParent').disabled=e.type==='force';$('moveMilitary').disabled=e.type==='force'||!targets.length;
  $('resetOperational').hidden=!operational();$('resetOperational').disabled=e.type==='force'||e.operationalParentId===null;
  $('entityObjects').innerHTML=state.objects.filter(o=>o.entityId===e.id).map(o=>`<button data-representation="${o.id}">${esc(o.label)}<small>${esc(pathName(o.ownerId))}</small></button>`).join('')||'<p class="hint">No map objects linked.</p>';
  $('createTruthCounter').disabled=e.type==='force';
 }
 $('viewCommanderField').hidden=current().type!=='commander';$('viewCommander').innerHTML=commanderOptions();$('viewCommander').value=current().commanderId||'';$('viewCommander').disabled=view()==='published';
 $('person').innerHTML='<option value="">Select a commander</option>'+state.military.commanders.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');$('person').value=activePerson||'';
 const c=F.commander(state,activePerson);$('personEditor').hidden=!c;
 const commands=commandAssignments(c?.id);updateCommandWarning($('personWarning'),commands);
 if(c){
  $('personName').value=c.name;$('personNotes').value=c.notes;
  $('personCommands').innerHTML=commands.map(e=>`<button data-person-command="${e.id}">${esc(militaryName(e.id))}</button>`).join('')||'<p class="hint">No command assignments.</p>';
  const views=state.nodes.filter(n=>n.commanderId===c.id);
  $('personViews').innerHTML=views.map(n=>`<button data-person-view="${n.id}">${esc(pathName(n.id))}</button>`).join('')||'<p class="hint">No information views linked.</p>';
 }
 editMilitaryLink(record());
}
function renderMilitaryTree(){
 const rows=[];
 function branch(e,depth){
  const kids=F.children(state,e.id,operational()),open=!militaryCollapsed.has(e.id),c=F.commander(state,e.commanderId);
  rows.push(`<button role="treeitem" aria-level="${depth+1}" aria-selected="${e.id===activeEntity}" ${kids.length?`aria-expanded="${open}"`:''} class="military-node ${e.id===activeEntity?'active':''}" style="--depth:${depth}" data-entity="${e.id}" draggable="${e.type!=='force'}"><span class="tree-toggle" data-military-toggle="${e.id}">${kids.length?(open?'▾':'▸'):'·'}</span><span class="tree-label">${esc(e.name)}${c?`<small>${esc(c.name)}</small>`:''}</span><small class="node-type">${operational()&&e.operationalParentId?'attached':esc(e.echelon||e.type)}</small></button>`);
  if(open)for(const child of kids)branch(child,depth+1);
 }
 for(const root of F.children(state,null))branch(root,0);
 $('militaryTree').innerHTML=rows.join('')||'<p class="hint">Add a force to begin.</p>';
 const rowsDOM=[...$('militaryTree').querySelectorAll('[role="treeitem"]')];
 const focus=rowsDOM.find(r=>r.dataset.entity===activeEntity)||rowsDOM[0];for(const row of rowsDOM)row.tabIndex=row===focus?0:-1;
}
function selectEntity(id){activeEntity=id;for(const e of F.path(state,id,operational()))militaryCollapsed.delete(e.id);syncMilitary();$('militaryTree').querySelector(`[data-entity="${id}"]`)?.focus();}
$('structure').onchange=()=>{militaryCollapsed.clear();syncMilitary();};
$('militaryTree').onclick=event=>{const toggle=event.target.closest('[data-military-toggle]');if(toggle){const id=toggle.dataset.militaryToggle;militaryCollapsed.has(id)?militaryCollapsed.delete(id):militaryCollapsed.add(id);renderMilitaryTree();$('militaryTree').querySelector(`[data-entity="${id}"]`)?.focus();return;}const row=event.target.closest('[data-entity]');if(row)selectEntity(row.dataset.entity);};
$('militaryTree').onkeydown=event=>{
 const row=event.target.closest('[data-entity]');if(!row)return;const rows=[...$('militaryTree').querySelectorAll('[data-entity]')],i=rows.indexOf(row),e=F.get(state,row.dataset.entity);let target;
 if(event.key==='ArrowDown')target=rows[Math.min(i+1,rows.length-1)];if(event.key==='ArrowUp')target=rows[Math.max(i-1,0)];if(event.key==='Home')target=rows[0];if(event.key==='End')target=rows.at(-1);
 if(event.key==='ArrowRight'&&row.hasAttribute('aria-expanded')){if(militaryCollapsed.has(e.id)){militaryCollapsed.delete(e.id);renderMilitaryTree();target=$('militaryTree').querySelector(`[data-entity="${e.id}"]`);}else target=rows[i+1];}
 if(event.key==='ArrowLeft'){if(row.getAttribute('aria-expanded')==='true'){militaryCollapsed.add(e.id);renderMilitaryTree();target=$('militaryTree').querySelector(`[data-entity="${e.id}"]`);}else target=$('militaryTree').querySelector(`[data-entity="${F.parentId(e,operational())}"]`);}
 if(target){event.preventDefault();for(const b of $('militaryTree').querySelectorAll('[data-entity]'))b.tabIndex=-1;target.tabIndex=0;target.focus();}
};
for(const [button,type]of [['addForce','force'],['addFormation','formation'],['addUnit','unit']])$(button).onclick=()=>{const name=prompt(`${type==='force'?'Force':type==='formation'?'Formation':'Unit'} name`);if(!name?.trim())return;mutate(()=>{const e=entity(),parent=type==='force'?null:e?.type==='unit'?e.parentId:e?.id;activeEntity=F.addEntity(state,parent,type,name).id;militaryCollapsed.clear();});};
for(const [field,key]of [['entityName','name'],['entityEchelon','echelon'],['entityNotes','notes'],['entityKind','kind'],['forceSide','side']])$(field).onchange=()=>{const value=$(field).value;mutate(()=>{if(!entity())throw Error('Select a military record.');if(key==='name'&&!value.trim())throw Error('Enter a military name.');entity()[key]=key==='name'?value.trim():value;});};
$('entityCommander').onchange=()=>{const id=$('entityCommander').value||null;mutate(()=>F.assignCommander(state,activeEntity,id));};
$('viewCommander').onchange=()=>{if(view()==='published')return;const id=$('viewCommander').value||null;mutate(()=>F.linkView(state,active,id));};
function moveMilitary(entityId,targetId,ops=operational()){return mutate(()=>{const result=F.setParent(state,entityId,targetId,ops);if(!result)return false;militaryCollapsed.clear();$('status').textContent=ops?'Operational attachment changed. Information views are unchanged.':'Order of battle updated. Information views are unchanged.';return true;});}
$('moveMilitary').onclick=()=>moveMilitary(activeEntity,$('militaryParent').value);
$('resetOperational').onclick=()=>moveMilitary(activeEntity,null,true);
$('deleteEntity').onclick=()=>mutate(()=>{activeEntity=F.deleteEntity(state,activeEntity);});
$('person').onchange=()=>{activePerson=$('person').value||null;syncMilitary();};
$('addPerson').onclick=()=>{const name=prompt('Commander name');if(!name?.trim())return;mutate(()=>activePerson=F.addCommander(state,name).id);};
for(const [field,key]of [['personName','name'],['personNotes','notes']])$(field).onchange=()=>{const value=$(field).value;mutate(()=>{const c=F.commander(state,activePerson);if(!c)throw Error('Select a commander.');if(key==='name'&&!value.trim())throw Error('Enter a commander name.');c[key]=key==='name'?value.trim():value;});};
$('personCommands').onclick=event=>{const button=event.target.closest('[data-person-command]');if(button){$('structure').value='oob';selectEntity(button.dataset.personCommand);}};
$('personViews').onclick=event=>{const button=event.target.closest('[data-person-view]');if(button){$('structure').value='views';$('view').value='draft';setActive(button.dataset.personView);$('tree').querySelector(`[data-node="${active}"]`)?.focus();}};
$('deletePerson').onclick=()=>mutate(()=>{F.deleteCommander(state,activePerson);activePerson=null;});
function editMilitaryLink(r){
 const show=!!r&&view()!=='published'&&r.type!=='region';$('entityLinkField').hidden=!show;$('linkedEntity').hidden=!show;
 if(!show)return;$('entityLink').innerHTML=militaryOptions();$('entityLink').value=r.entityId||'';$('entityLink').disabled=!writable(r);
 const linked=F.get(state,r.entityId);$('linkedEntity').textContent=linked?`OOB: ${militaryName(linked.id)}. This link does not update reported labels or positions.`:'This object has no military identity.';
}
$('entityLink').onchange=()=>{if(!writable())return;const id=$('entityLink').value||null;mutate(()=>F.linkObject(state,selected.id,id));};
$('entityObjects').onclick=event=>{const button=event.target.closest('[data-representation]');if(!button)return;const o=state.objects.find(o=>o.id===button.dataset.representation);if(o){$('structure').value='views';$('view').value='draft';setActive(o.ownerId,o.id);}};
$('createTruthCounter').onclick=()=>mutate(()=>{const e=entity();if(!e||e.type==='force')throw Error('Choose a formation or unit.');const truth=truthNode(),side=F.path(state,e.id)[0].side,r={id:M.id(),ownerId:truth.id,entityId:e.id,type:'counter',kind:e.type==='formation'?'hq':e.kind,label:e.name,side,x:state.width/2,y:state.height/2,facing:0,strength:'',activity:'',observed:state.time,radius:0,presentation:'confirmed',notes:'',falseContact:false};state.objects.push(r);active=truth.id;selected={id:r.id};$('view').value='draft';$('status').textContent=`Truth counter created for ${e.name}.`;});
let militaryPayload=null;
$('militaryTree').ondragstart=event=>{const row=event.target.closest('[data-entity]'),e=F.get(state,row?.dataset.entity);if(!e||e.type==='force'){event.preventDefault();return;}militaryPayload={id:e.id,operational:operational()};event.dataTransfer.setData('application/x-military',JSON.stringify(militaryPayload));event.dataTransfer.effectAllowed='move';};
function militaryDropTarget(event){const row=event.target.closest('[data-entity]'),target=F.get(state,row?.dataset.entity),source=F.get(state,militaryPayload?.id);if(!source||!target||!['force','formation'].includes(target.type)||F.forceId(state,source.id)!==F.forceId(state,target.id)||F.path(state,target.id,operational()).some(e=>e.id===source.id))return null;return row;}
$('militaryTree').ondragover=event=>{clearDrop();const row=militaryDropTarget(event);if(!row)return;event.preventDefault();event.dataTransfer.dropEffect='move';row.classList.add('drop-move');$('status').textContent=`${operational()?'Attach operationally':'Move in OOB'} to ${F.get(state,row.dataset.entity).name}.`;};
$('militaryTree').ondrop=event=>{event.preventDefault();const row=militaryDropTarget(event),payload=militaryPayload;militaryPayload=null;clearDrop();if(!row||!payload)return;moveMilitary(payload.id,row.dataset.entity,payload.operational);};
document.addEventListener('dragend',()=>{militaryPayload=null;clearDrop();});
syncMilitary();
