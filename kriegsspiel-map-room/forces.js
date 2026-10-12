'use strict';
// Military identity and organization are independent of information ownership.
const ForceModel = (() => {
  const id = () => crypto.randomUUID();
  const get = (state, entityId) => state.military.entities.find(e => e.id === entityId);
  const commander = (state, commanderId) => state.military.commanders.find(c => c.id === commanderId);
  const parentId = (entity, operational=false) => operational ? entity.operationalParentId ?? entity.parentId : entity.parentId;
  const children = (state, entityId, operational=false) => state.military.entities.filter(e => parentId(e,operational) === entityId).sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id));
  function path(state,entityId,operational=false) {
    const result=[],seen=new Set();
    for(let e=get(state,entityId);e;e=get(state,parentId(e,operational))){
      if(seen.has(e.id))throw Error('Military organization cannot contain a cycle.');
      seen.add(e.id);result.unshift(e);
    }
    if(!result.length||result[0].type!=='force')throw Error('Every formation and unit must belong to a force.');
    return result;
  }
  const forceId=(state,entityId)=>path(state,entityId)[0].id;
  function assertParent(state,entity,targetId) {
    const target=get(state,targetId);
    if(!target||!['force','formation'].includes(target.type))throw Error('Choose a force or formation as the parent.');
    if(entity&&forceId(state,entity.id)!==forceId(state,targetId))throw Error('Keep military assignments within the same force.');
    return target;
  }
  function addCommander(state,name) {
    if(typeof name!=='string'||!name.trim())throw Error('Enter a commander name.');
    const c={id:id(),name:name.trim(),notes:''};state.military.commanders.push(c);return c;
  }
  function addEntity(state,parent,type,name) {
    if(!['force','formation','unit'].includes(type)||typeof name!=='string'||!name.trim())throw Error('Enter a formation or unit name.');
    if(type!=='force')assertParent(state,null,parent);
    const e={id:id(),type,name:name.trim(),parentId:type==='force'?null:parent,operationalParentId:null,order:children(state,type==='force'?null:parent).length,echelon:'',kind:'infantry',side:'unknown',notes:'',commanderId:null};
    state.military.entities.push(e);return e;
  }
  function validateTrees(state) {
    for(const e of state.military.entities){
      if(e.type==='force'){
        if(e.parentId!==null||e.operationalParentId!==null)throw Error('Force roots stay at the top of both military trees.');
      }else{
        assertParent(state,e,e.parentId);
        if(e.operationalParentId!==null)assertParent(state,e,e.operationalParentId);
      }
      path(state,e.id);path(state,e.id,true);
    }
  }
  function setParent(state,entityId,targetId,operational=false) {
    const e=get(state,entityId);if(!e||e.type==='force')throw Error('Force roots stay in place.');
    if(operational&&targetId===null){if(e.operationalParentId===null)return false;}
    else assertParent(state,e,targetId);
    const field=operational?'operationalParentId':'parentId',old=e[field],oldOrder=e.order;
    if(old===targetId)return false;
    e[field]=targetId;
    if(!operational)e.order=children(state,targetId).filter(x=>x.id!==e.id).length;
    try{validateTrees(state);}catch(error){e[field]=old;e.order=oldOrder;throw error;}
    return true;
  }
  function assignCommander(state,entityId,commanderId) {
    const e=get(state,entityId);if(!e)throw Error('Choose a formation or unit.');
    if(commanderId!==null&&!commander(state,commanderId))throw Error('Commander no longer exists.');
    if(e.commanderId===commanderId)return false;e.commanderId=commanderId;return true;
  }
  function linkObject(state,objectId,entityId) {
    const o=state.objects.find(o=>o.id===objectId);if(!o)throw Error('Choose a map object.');
    if(['region','annotation'].includes(o.type))throw Error('Areas and annotations do not represent military units.');
    if(entityId!==null&&!get(state,entityId))throw Error('Choose an existing military record.');
    if((o.entityId??null)===entityId)return false;
    if(entityId===null)delete o.entityId;else o.entityId=entityId;
    return true;
  }
  function linkView(state,nodeId,commanderId) {
    const n=state.nodes.find(n=>n.id===nodeId);if(!n||n.type!=='commander')throw Error('Only commander views can be linked to a commander.');
    if(commanderId!==null&&!commander(state,commanderId))throw Error('Choose an existing commander.');
    if((n.commanderId??null)===commanderId)return false;n.commanderId=commanderId;return true;
  }
  function deleteEntity(state,entityId) {
    const e=get(state,entityId);if(!e)throw Error('Military record no longer exists.');
    if(children(state,entityId).length||children(state,entityId,true).length||state.objects.some(o=>o.entityId===entityId))throw Error('Remove subordinates, operational attachments, and map links before deleting this military record.');
    state.military.entities=state.military.entities.filter(x=>x.id!==entityId);
    return e.parentId;
  }
  function deleteCommander(state,commanderId) {
    if(!commander(state,commanderId))throw Error('Commander no longer exists.');
    if(state.military.entities.some(e=>e.commanderId===commanderId)||state.nodes.some(n=>n.commanderId===commanderId))throw Error('Remove command assignments and view links before deleting this commander.');
    state.military.commanders=state.military.commanders.filter(c=>c.id!==commanderId);
  }
  function initialize(state) {
    state.military={entities:[],commanders:[]};
    const red=addEntity(state,null,'force','Red force'),blue=addEntity(state,null,'force','Blue force');red.side='red';blue.side='blue';
    for(const [force,label] of [[red,'Red'],[blue,'Blue']]){
      const c=addCommander(state,`${label} division commander`),division=addEntity(state,force.id,'formation',`${label} division`);division.echelon='Division';division.commanderId=c.id;
      const view=state.nodes.find(n=>n.type==='commander'&&n.name===`${label} division`);if(view)view.commanderId=c.id;
      const truth=state.nodes.find(n=>n.type==='truth');
      for(const o of state.objects.filter(o=>o.ownerId===truth.id&&o.type==='counter'&&o.side===force.side)){
        const unit=addEntity(state,division.id,'unit',o.label);unit.kind=o.kind;unit.echelon=o.kind==='artillery'?'Battery':'Regiment';o.entityId=unit.id;
      }
    }
  }
  function validate(state,usedIds) {
    const validId=v=>typeof v==='string'&&/^[A-Za-z0-9_-]+$/.test(v);
    if(!state.military||!Array.isArray(state.military.entities)||!Array.isArray(state.military.commanders))throw Error('Invalid military records.');
    for(const c of state.military.commanders){
      if(!c||!validId(c.id)||usedIds.has(c.id)||typeof c.name!=='string'||!c.name.trim()||typeof c.notes!=='string')throw Error('Invalid commander identity.');usedIds.add(c.id);
    }
    for(const e of state.military.entities){
      if(!e||!validId(e.id)||usedIds.has(e.id)||!['force','formation','unit'].includes(e.type)||typeof e.name!=='string'||!e.name.trim()||typeof e.notes!=='string'||typeof e.echelon!=='string'||!['infantry','cavalry','artillery','hq'].includes(e.kind)||!['red','blue','unknown'].includes(e.side)||!Number.isInteger(e.order)||e.order<0||!(e.operationalParentId===null||validId(e.operationalParentId))||!(e.commanderId===null||commander(state,e.commanderId)))throw Error('Invalid military formation or unit.');usedIds.add(e.id);
    }
    validateTrees(state);
    for(const n of state.nodes)if(n.commanderId!=null&&(n.type!=='commander'||!commander(state,n.commanderId)))throw Error('Invalid commander view link.');
    for(const o of state.objects)if(o.entityId!==undefined&&(!get(state,o.entityId)||['region','annotation'].includes(o.type)))throw Error('Invalid map-to-military link.');
  }
  return {get,commander,parentId,children,path,forceId,addCommander,addEntity,setParent,assignCommander,linkObject,linkView,deleteEntity,deleteCommander,initialize,validate};
})();
