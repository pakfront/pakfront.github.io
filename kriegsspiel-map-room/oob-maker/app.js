'use strict';
const $=id=>document.getElementById(id),D=OobDocument,F=ForceModel,history=DocumentHistory.create();
let doc=D.create(),selected=null,tab='organization',creating=null,saved=JSON.stringify(doc),collapsed=new Set(),dragId=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const working=()=>({version:6,military:{entities:doc.entities,commanders:doc.commanders}});
const record=()=>tab==='commanders'?doc.commanders.find(c=>c.id===selected):doc.entities.find(e=>e.id===selected);
const dirty=()=>JSON.stringify(doc)!==saved;
function status(s){$('status').textContent=s;}
function transact(action){const before=JSON.parse(JSON.stringify(doc)),oldSelected=selected,oldTab=tab;try{action();doc=D.normalize(doc);if(JSON.stringify(before)!==JSON.stringify(doc))history.record({doc:before,selected:oldSelected,tab:oldTab});render();return true;}catch(e){doc=before;selected=oldSelected;tab=oldTab;render();status(e.message);return false;}}
function select(id,person=false){selected=id;tab=person?'commanders':'organization';creating=null;if(!person)for(const e of F.path(working(),id))collapsed.delete(e.id);render();$('tree').querySelector(`[data-id="${id}"]`)?.scrollIntoView({block:'nearest'});}
function render(){
 $('title').value=doc.title;$('notes').value=doc.notes;$('saveStatus').textContent=dirty()?'Unsaved changes':'No unsaved changes';$('undo').disabled=!history.canUndo;$('redo').disabled=!history.canRedo;
 $('organizationTab').classList.toggle('active',tab==='organization');$('commandersTab').classList.toggle('active',tab==='commanders');renderTree();renderEditor();
}
function renderTree(){
 const scroll=$('organization').scrollTop,q=$('search').value.toLowerCase(),s=working(),people=new Map(doc.commanders.map(c=>[c.id,c])),byParent=new Map(),commandCounts=new Map();
 for(const e of doc.entities)if(e.commanderId)commandCounts.set(e.commanderId,(commandCounts.get(e.commanderId)||0)+1);
 for(const e of doc.entities){if(!byParent.has(e.parentId))byParent.set(e.parentId,[]);byParent.get(e.parentId).push(e);}for(const a of byParent.values())a.sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id));
 const visible=new Set();if(q)for(const e of doc.entities)if([e.name,e.echelon,e.type==='unit'?e.kind:'',people.get(e.commanderId)?.name].join(' ').toLowerCase().includes(q)){let n=e;while(n&&!visible.has(n.id)){visible.add(n.id);n=F.get(s,n.parentId);}}
 const rows=[];function row(e,depth){if(q&&!visible.has(e.id))return;const kids=byParent.get(e.id)||[],open=q||!collapsed.has(e.id);rows.push(`<button role="treeitem" tabindex="${selected===e.id?0:-1}" aria-selected="${selected===e.id}" aria-level="${depth+1}" ${kids.length?`aria-expanded="${!!open}"`:''} data-id="${e.id}" draggable="true" class="${selected===e.id?'active':''}" style="--depth:${depth}"><span data-toggle="${e.id}">${kids.length?(open?'▾':'▸'):'·'}</span><span>${esc(e.name)}<small>${esc(e.echelon||e.type==='unit'&&e.kind||e.type)}${e.commanderId?' · '+esc(people.get(e.commanderId)?.name)+(commandCounts.get(e.commanderId)>1?' · ⚠ multiple commands':''):''}</small></span></button>`);if(open)for(const child of kids)row(child,depth+1);}
 if(tab==='organization')for(const root of byParent.get(null)||[])row(root,0);else for(const c of doc.commanders)if([c.name,c.rank].join(' ').toLowerCase().includes(q))rows.push(`<button role="treeitem" tabindex="${selected===c.id?0:-1}" aria-selected="${selected===c.id}" data-id="${c.id}" class="${selected===c.id?'active':''}">${esc(c.name)}<small>${esc(c.rank)}${commandCounts.get(c.id)>1?' · ⚠ multiple commands':''}</small></button>`);
 $('tree').innerHTML=rows.join('')||'<p>No records found. Add a force or commander to begin.</p>';if(!$('tree').querySelector('[tabindex="0"]'))$('tree').querySelector('button')?.setAttribute('tabindex','0');$('organization').scrollTop=scroll;
}
const field=(label,key,value,type='text')=>`<label>${label}<input data-field="${key}" id="edit-${key}" type="${type}" ${type==='number'?'min="0" step="1"':''} value="${esc(value)}"></label>`;
function renderEditor(){
 const pane=$('editor'),scroll=pane.scrollTop,r=record(),s=working();
 if(creating){pane.innerHTML=`<h2>Create ${creating.type}</h2><form id="createForm">${field('Name','newName','')}<button class="primary">Create</button><button type="button" id="cancelCreate">Cancel</button></form>`;$('createForm').onsubmit=e=>{e.preventDefault();const name=$('edit-newName').value;const context=creating;const ok=transact(()=>{if(context.type==='commander'){const c=F.addCommander(s,name);if(context.assign){F.assignCommander(s,context.assign,c.id);selected=context.assign;tab='organization';}else{selected=c.id;tab='commanders';}}else {selected=F.addEntity(s,context.parent,context.type,name).id;tab='organization';}creating=null;});if(ok){render();$('edit-name')?.focus();}};$('cancelCreate').onclick=()=>{creating=null;render();};return;}
 if(!r){pane.innerHTML='<h2>Prepare an order of battle</h2><p>Add force roots, formations, units, and commanders. Select a record to edit its setup.</p>';return;}
 const person=tab==='commanders',assignments=id=>doc.entities.filter(e=>e.commanderId===id),commands=assignments(person?r.id:r.commanderId);
 let html=`<h2>${esc(r.name)}</h2>${field('Name','name',r.name)}`;
 if(person)html+=field('Rank (optional)','rank',r.rank);else{
 html+=`<label>Commander<select data-field="commanderId" id="edit-commanderId"><option value="">Unassigned</option>${doc.commanders.map(c=>`<option value="${c.id}" ${c.id===r.commanderId?'selected':''}>${esc([c.rank,c.name].filter(Boolean).join(' '))}</option>`).join('')}</select></label><button id="createAssign">Create commander and assign</button>`;
 }
 if(commands.length>1)html+=`<p class="warning">Multiple command assignments (${commands.length}).</p>`;
 if(person||commands.length>1)html+=commands.map(e=>`<button class="assignment" data-command="${e.id}">${esc(F.path(s,e.id).map(e=>e.name).join(' / '))}</button>`).join('');
 if(!person){html+=`<p>${esc(F.path(s,r.id).map(e=>e.name).join(' / '))}</p>`;
 if(r.type==='force')html+=`<label>Display side / color<select data-field="side">${['unknown','red','blue'].map(v=>`<option ${v===r.side?'selected':''}>${v}</option>`).join('')}</select></label>`;
 else html+=field('Echelon','echelon',r.echelon);
 if(r.type==='unit')html+=`<label>Unit kind<select data-field="kind">${['infantry','cavalry','artillery','hq'].map(v=>`<option ${v===r.kind?'selected':''}>${v}</option>`).join('')}</select></label><h3>Setup strength</h3><p>Blank counts are unspecified; zero is known. These values describe starting strength.</p><div class="stats">${field('Personnel','personnel',r.stats.personnel??'','number')}${field('Guns','guns',r.stats.guns??'','number')}</div>${field('Quality / training','quality',r.stats.quality)}${field('Equipment','equipment',r.stats.equipment)}`;
 else {const t=D.totals(doc,r.id);html+=`<p>${t.formations} formations · ${t.units} units</p><p>Setup totals: ${t.personnel} personnel${t.personnelUnknown?` (partial; ${t.personnelUnknown} unspecified)`:''} · ${t.guns} guns${t.gunsUnknown?` (partial; ${t.gunsUnknown} unspecified)`:''}</p>`;}
 const targets=doc.entities.filter(t=>t.type!=='unit'&&F.forceId(s,t.id)===F.forceId(s,r.id)&&!F.path(s,t.id).some(e=>e.id===r.id));
 html+=`<h3>Permanent organization</h3>${r.type!=='force'?`<label>Parent<select id="parent">${targets.map(t=>`<option value="${t.id}" ${t.id===r.parentId?'selected':''}>${esc(F.path(s,t.id).map(e=>e.name).join(' / '))}</option>`).join('')}</select></label>`:''}<label>Sibling position (1 = first)<input id="position" type="number" min="1" value="${F.children(s,r.parentId).findIndex(e=>e.id===r.id)+1}"></label><button id="move">Apply parent and position</button>`;
 }
 html+=`<label>Private notes<textarea data-field="notes">${esc(r.notes)}</textarea></label>`;
 if(!person&&r.type!=='force')html+='<label class="check"><input id="clearAssignments" type="checkbox">Clear copied commander assignments</label><button id="duplicate">Duplicate branch</button>';
 const blockers=person?commands:doc.entities.filter(e=>e.parentId===r.id);html+=`<p>${blockers.length?'Resolve before deleting: '+blockers.map(e=>esc(e.name)).join(', '):''}</p><button id="delete" ${blockers.length?'disabled':''}>Delete ${person?'commander':r.type}</button>`;pane.innerHTML=html;pane.scrollTop=scroll;
 pane.querySelectorAll('[data-field]').forEach(input=>input.onchange=()=>{const key=input.dataset.field,value=input.value;transact(()=>{const target=record();if(['personnel','guns','quality','equipment'].includes(key))target.stats[key]=['personnel','guns'].includes(key)?value.trim()===''?null:Number(value):value;else if(key==='commanderId')F.assignCommander(working(),r.id,value||null);else {if(key==='name'&&!value.trim())throw Error('Enter a name.');target[key]=key==='name'?value.trim():value;}});});
 pane.querySelectorAll('[data-command]').forEach(b=>b.onclick=()=>select(b.dataset.command));
 if($('createAssign'))$('createAssign').onclick=()=>{creating={type:'commander',assign:r.id};renderEditor();$('edit-newName').focus();};
 if($('move'))$('move').onclick=()=>{const parent=$('parent')?.value||null,pos=Number($('position').value)-1;transact(()=>F.move(working(),r.id,parent,pos));};
 if($('duplicate'))$('duplicate').onclick=()=>{const clear=$('clearAssignments').checked;transact(()=>selected=F.duplicate(working(),r.id,clear).id);};
 $('delete').onclick=()=>transact(()=>{const ws=working();if(person){F.deleteCommander(ws,r.id);doc.commanders=ws.military.commanders;selected=null;}else {selected=F.deleteEntity(ws,r.id);doc.entities=ws.military.entities;}});
}
$('tree').onclick=e=>{const toggle=e.target.closest('[data-toggle]');if(toggle){const id=toggle.dataset.toggle;collapsed.has(id)?collapsed.delete(id):collapsed.add(id);renderTree();return;}const row=e.target.closest('[data-id]');if(row)select(row.dataset.id,tab==='commanders');};
$('tree').onkeydown=e=>{const rows=[...$('tree').querySelectorAll('[data-id]')],row=e.target.closest('[data-id]'),i=rows.indexOf(row);if(i<0)return;let target;
 if(e.key==='ArrowDown')target=rows[Math.min(rows.length-1,i+1)];if(e.key==='ArrowUp')target=rows[Math.max(0,i-1)];if(e.key==='Home')target=rows[0];if(e.key==='End')target=rows.at(-1);
 if(e.key==='Enter'||e.key===' '){e.preventDefault();select(row.dataset.id,tab==='commanders');target=$('tree').querySelector(`[data-id="${row.dataset.id}"]`);}
 if(tab==='organization'&&['ArrowLeft','ArrowRight'].includes(e.key)){const r=F.get(working(),row.dataset.id);e.preventDefault();if(e.key==='ArrowRight'){collapsed.delete(r.id);renderTree();target=$('tree').querySelector(`[data-id="${r.id}"]`);if(row.getAttribute('aria-expanded')==='true')target=target.nextElementSibling||target;}else if(row.getAttribute('aria-expanded')==='true'){collapsed.add(r.id);renderTree();target=$('tree').querySelector(`[data-id="${r.id}"]`);}else target=$('tree').querySelector(`[data-id="${r.parentId}"]`);}
 if(target){e.preventDefault();for(const r of $('tree').querySelectorAll('button'))r.tabIndex=-1;target.tabIndex=0;target.focus();}};
$('tree').ondragstart=e=>{if(tab!=='organization')return e.preventDefault();dragId=e.target.closest('[data-id]')?.dataset.id;e.dataTransfer.setData('text/plain',dragId);};
$('tree').ondragover=e=>{if(dragId){e.preventDefault();}};
$('tree').ondrop=e=>{e.preventDefault();const row=e.target.closest('[data-id]'),id=dragId;dragId=null;if(!row||!id)return;const target=F.get(working(),row.dataset.id),box=row.getBoundingClientRect(),fraction=(e.clientY-box.top)/box.height;transact(()=>{if(id===target.id)return;const inside=target.type!=='unit'&&fraction>.25&&fraction<.75;const parent=inside?target.id:target.parentId,siblings=F.children(working(),parent).filter(r=>r.id!==id),pos=inside?siblings.length:siblings.findIndex(r=>r.id===target.id)+(fraction>=.75?1:0);F.move(working(),id,parent,pos);});};
document.addEventListener('dragend',()=>dragId=null);
for(const b of document.querySelectorAll('[data-add]'))b.onclick=()=>{const type=b.dataset.add,r=record(),parent=type==='force'||type==='commander'?null:tab==='organization'&&r?(r.type==='unit'?r.parentId:r.id):null;if(!parent&&!['force','commander'].includes(type)){status('Select a force or formation first.');return;}creating={type,parent};renderEditor();$('edit-newName').focus();};
$('search').oninput=renderTree;for(const [id,t]of [['organizationTab','organization'],['commandersTab','commanders']])$(id).onclick=()=>{tab=t;selected=null;creating=null;render();};
for(const key of ['title','notes'])$(key).onchange=()=>{const v=$(key).value;transact(()=>doc[key]=v);};
for(const action of ['undo','redo'])$(action).onclick=()=>{const restored=history[action]({doc,selected,tab});if(restored){doc=restored.doc;selected=restored.selected;tab=restored.tab;creating=null;render();}};
const discard=()=>!dirty()||confirm('Discard unsaved OOB changes?');
function replace(d){doc=d;selected=null;creating=null;collapsed.clear();history.clear();saved=JSON.stringify(d);render();}
$('new').onclick=()=>{if(discard())replace(D.create());};
$('open').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const d=D.normalize(JSON.parse(await file.text()));if(discard())replace(d);}catch(error){status('Could not open OOB: '+error.message);}finally{e.target.value='';}};
$('save').onclick=()=>{try{const d=D.normalize(doc),url=URL.createObjectURL(new Blob([JSON.stringify(d,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=(d.title.replace(/[^a-z0-9]/gi,'-')||'forces')+'.kriegsspiel-oob.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);saved=JSON.stringify(doc);render();status('OOB saved, including private notes. Import this file in Map Room.');}catch(e){status(e.message);}};
$('theme').onclick=()=>{const t=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=t;try{localStorage.setItem('kriegsspiel-theme',t);}catch(e){}};
function resize(value){const v=Math.max(20,Math.min(65,value));$('workspace').style.setProperty('--tree-width',v+'%');$('divider').setAttribute('aria-valuenow',Math.round(v));try{localStorage.setItem('kriegsspiel-oob-divider',v);}catch(e){}}
try{resize(Number(localStorage.getItem('kriegsspiel-oob-divider'))||35);}catch(e){}
$('divider').onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();resize(e.key==='Home'?20:e.key==='End'?65:Number($('divider').getAttribute('aria-valuenow'))+(e.key==='ArrowRight'?2:-2));}};
$('divider').onpointerdown=e=>{$('divider').setPointerCapture(e.pointerId);};$('divider').onpointermove=e=>{if($('divider').hasPointerCapture(e.pointerId)){const b=$('workspace').getBoundingClientRect();resize((e.clientX-b.left)/b.width*100);}};
window.addEventListener('beforeunload',e=>{if(dirty()){e.preventDefault();e.returnValue='';}});
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();$(e.shiftKey?'redo':'undo').click();}});render();
