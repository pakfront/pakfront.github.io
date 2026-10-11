'use strict';
// Classic script: the map room also runs directly from disk.
const ViewModel = (() => {
  const copy = value => JSON.parse(JSON.stringify(value));
  const id = () => crypto.randomUUID();
  const publicFields = ['id','type','label','kind','side','x','y','facing','strength','activity','observed','radius','presentation','points'];
  const getNode = (state, nodeId) => state.nodes.find(n => n.id === nodeId);
  const children = (state, nodeId) => state.nodes.filter(n => n.parentId === nodeId).sort((a,b) => a.order-b.order || a.id.localeCompare(b.id));
  function ancestorPath(state, nodeId) {
    const path = [], seen = new Set();
    for (let n = getNode(state, nodeId); n; n = getNode(state, n.parentId)) {
      if (seen.has(n.id)) throw Error('A view cannot contain itself.');
      seen.add(n.id); path.unshift(n);
    }
    if (!path.length || path[0].id !== state.rootId) throw Error('View is not connected to Game.');
    return path;
  }
  function effectiveView(state, nodeId) {
    const path = ancestorPath(state, nodeId), owners = new Set(path.map(n => n.id));
    return {
      objects: state.objects.filter(o => owners.has(o.ownerId)),
      summaryBlocks: path.filter(n => n.summary.trim()).map(n => ({ownerId:n.id,name:n.name,text:n.summary})),
      path
    };
  }
  function moveNode(state, nodeId, parentId, beforeId = null) {
    const n = getNode(state,nodeId), parent = getNode(state,parentId);
    if (!n || !['group','commander'].includes(n.type)) throw Error('Game and Truth stay in place.');
    if (!parent || !['root','group'].includes(parent.type)) throw Error('Move branches into Game or a group.');
    if (ancestorPath(state,parentId).some(a => a.id === nodeId)) throw Error('A group cannot move into itself or its descendants.');
    if (beforeId === nodeId) return false;
    const siblings = children(state,parentId).filter(x => x.id !== nodeId);
    if (beforeId && !siblings.some(x => x.id === beforeId)) throw Error('Invalid insertion position.');
    const index = beforeId ? siblings.findIndex(x => x.id === beforeId) : siblings.length;
    const old = children(state,n.parentId).map(x => x.id);
    siblings.splice(index,0,n);
    if (n.parentId === parentId && old.join() === siblings.map(x => x.id).join()) return false;
    const oldParent = n.parentId;
    n.parentId = parentId;
    children(state,oldParent).filter(x => x.id !== nodeId).forEach((x,i) => x.order=i);
    siblings.forEach((x,i) => x.order=i);
    return true;
  }
  function publicObject(object) {
    const result = {};
    for (const field of publicFields) if (Object.hasOwn(object,field)) result[field] = copy(object[field]);
    return result;
  }
  function copyObject(state, objectId, targetId) {
    const source = state.objects.find(o => o.id === objectId), target = getNode(state,targetId);
    if (!source || !target) throw Error('Choose an object and a destination.');
    if (source.ownerId === targetId) return null;
    const result = {...publicObject(source),id:id(),ownerId:targetId,notes:'',falseContact:false};
    const owner = getNode(state,source.ownerId);
    if (source.type === 'counter' && owner.type === 'truth') result.truthId = source.id;
    else if (source.truthId) result.truthId = source.truthId;
    if (source.entityId) result.entityId = source.entityId;
    if (target.type === 'truth') { delete result.truthId; result.presentation='confirmed'; }
    state.objects.push(result);
    return result;
  }
  function editObject(state, objectId, activeId, changes) {
    const object = state.objects.find(o => o.id === objectId);
    if (!object || object.ownerId !== activeId) throw Error('Select the owning view to edit this object.');
    for (const [key,value] of Object.entries(changes)) {
      if (['id','ownerId','type','truthId','entityId'].includes(key)) throw Error('Object identity cannot be edited.');
      object[key] = copy(value);
    }
    if (changes.kind) object.type = changes.kind === 'marker' ? 'marker' : 'counter';
    return object;
  }
  function deleteObject(state, objectId, activeId) {
    const object = state.objects.find(o => o.id === objectId);
    if (!object || object.ownerId !== activeId) throw Error('Select the owning view to delete this object.');
    state.objects = state.objects.filter(o => o.id !== objectId);
    // A missing truth link never suppresses a contact; retain its last known information.
  }
  function addNode(state, parentId, type, name) {
    const parent = getNode(state,parentId);
    if (!parent || !['root','group'].includes(parent.type) || !['group','commander'].includes(type)) throw Error('Add groups and commanders beneath Game or a group.');
    if (!name.trim()) throw Error('Enter a view name.');
    const n = {id:id(),parentId,type,name:name.trim(),order:children(state,parentId).length,privateNotes:'',summary:''};
    if (type === 'commander') { n.published=null; n.publicationFingerprint=null; n.commanderId=null; }
    state.nodes.push(n); return n;
  }
  function deleteNode(state,nodeId) {
    const n = getNode(state,nodeId);
    if (!n || !['group','commander'].includes(n.type)) throw Error('Game and Truth stay in place.');
    if (children(state,nodeId).length || state.objects.some(o => o.ownerId === nodeId)) throw Error('Remove children and owned objects before deleting this view.');
    state.nodes=state.nodes.filter(x => x.id !== nodeId);
    children(state,n.parentId).forEach((x,i) => x.order=i);
    return n.parentId;
  }
  function publicContent(state,nodeId) {
    const n = getNode(state,nodeId), v = effectiveView(state,nodeId);
    return {
      objects:v.objects.map(publicObject),summary:v.summaryBlocks.map(b => b.text).join('\n\n'),
      name:n.name,title:state.title,time:state.time,map:state.map,
      width:state.width,height:state.height,metersPerPixel:state.metersPerPixel,calibrated:state.calibrated
    };
  }
  const fingerprint = (state,nodeId) => JSON.stringify(publicContent(state,nodeId));
  function publishCommander(state,nodeId,embeddedMap) {
    const n=getNode(state,nodeId);
    if (!n || n.type !== 'commander') throw Error('Select a commander to publish.');
    n.publicationFingerprint=fingerprint(state,nodeId);
    n.published={...publicContent(state,nodeId),map:embeddedMap,at:new Date().toISOString()};
    return n.published;
  }
  function defaultState() {
    const root={id:id(),parentId:null,type:'root',name:'Game',order:0,privateNotes:'',summary:''};
    const truth={id:id(),parentId:root.id,type:'truth',name:'Truth',order:0,privateNotes:'',summary:''};
    const state={version:3,title:'Pea Ridge · practice encounter',time:'10:00',map:'fake-pea-ridge-map.jpg',width:1408,height:768,metersPerPixel:10,calibrated:false,rootId:root.id,nodes:[root,truth],objects:[]};
    const red=addNode(state,root.id,'group','Red'),blue=addNode(state,root.id,'group','Blue');
    addNode(state,red.id,'commander','Red division');addNode(state,blue.id,'commander','Blue division');
    for (const r of [{label:'1st Infantry',kind:'infantry',side:'blue',x:490,y:520,strength:'450',activity:'Holding',facing:0},{label:'Ridge battery',kind:'artillery',side:'red',x:890,y:350,strength:'4 guns',activity:'Deployed',facing:25}]) {
      state.objects.push({...r,id:id(),ownerId:truth.id,type:'counter',observed:'',radius:0,presentation:'confirmed',notes:'',falseContact:false});
    }
    ForceModel.initialize(state);
    return state;
  }
  function validateScenario(state) {
    const fail = message => {throw Error(message);};
    const finite = value => typeof value === 'number' && Number.isFinite(value);
    const raster = map => typeof map === 'string' && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(map);
    const dimensions = v => finite(v.width)&&v.width>0&&finite(v.height)&&v.height>0&&finite(v.metersPerPixel)&&v.metersPerPixel>0&&typeof v.calibrated==='boolean';
    if (!state || state.version !== 3) fail('Unsupported scenario version. This app requires version 3.');
    if (!Array.isArray(state.nodes)||!Array.isArray(state.objects)||!dimensions(state)||typeof state.title!=='string'||typeof state.time!=='string'||!(raster(state.map)||state.map==='fake-pea-ridge-map.jpg')) fail('Invalid scenario.');
    const validId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]+$/.test(value);
    const ids=new Set();
    for (const n of state.nodes) {
      if (!n || !validId(n.id)||ids.has(n.id)||!['root','truth','group','commander'].includes(n.type)||typeof n.name!=='string'||!n.name.trim()||!Number.isInteger(n.order)||n.order<0||typeof n.summary!=='string'||typeof n.privateNotes!=='string') fail('Invalid view records.');
      ids.add(n.id);
    }
    const roots=state.nodes.filter(n=>n.type==='root'),truths=state.nodes.filter(n=>n.type==='truth');
    if (roots.length!==1||truths.length!==1||roots[0].id!==state.rootId||roots[0].parentId!==null||truths[0].parentId!==state.rootId) fail('Game and Truth must each exist once, with Truth beneath Game.');
    for (const n of state.nodes) {
      if (n.type!=='root') {
        const parent=getNode(state,n.parentId);
        if (!parent||!['root','group'].includes(parent.type)) fail('Invalid view parent.');
      }
      ancestorPath(state,n.id);
    }
    function validateObject(o, published=false) {
      if (!o || !validId(o.id)||!['counter','marker','region'].includes(o.type)||typeof o.label!=='string') fail('Invalid object.');
      if (published && Object.keys(o).some(k=>!publicFields.includes(k))) fail('Published objects contain private or unsupported fields.');
      if (o.type==='region') {
        if (!Array.isArray(o.points)||o.points.length<3||o.points.some(p=>!Array.isArray(p)||p.length!==2||!p.every(finite))) fail('Invalid region geometry.');
      } else {
        if (!finite(o.x)||!finite(o.y)||!finite(o.facing)||!finite(o.radius)||o.radius<0||!['infantry','cavalry','artillery','hq','marker'].includes(o.kind)||!['blue','red','unknown'].includes(o.side)||!['confirmed','reported'].includes(o.presentation)) fail('Invalid counter geometry or presentation.');
        if ((o.type==='marker')!==(o.kind==='marker')) fail('Object type and symbol disagree.');
        for (const k of ['strength','activity','observed']) if (typeof o[k]!=='string') fail('Invalid object text.');
      }
      if (!published && (typeof o.notes!=='string'||typeof o.falseContact!=='boolean'||(o.truthId!==undefined&&typeof o.truthId!=='string'))) fail('Invalid private object metadata.');
    }
    for (const o of state.objects) {
      validateObject(o);
      if (ids.has(o.id)||!getNode(state,o.ownerId)) fail('Duplicate object ID or missing owner.');
      ids.add(o.id);
    }
    ForceModel.validate(state,ids);
    const snapshotFields=['objects','summary','name','title','time','map','width','height','metersPerPixel','calibrated','at'];
    for (const n of state.nodes) {
      if (n.type!=='commander' && (n.published || n.publicationFingerprint)) fail('Only commanders can publish.');
      if (n.type==='commander' && n.publicationFingerprint!==null && typeof n.publicationFingerprint!=='string') fail('Invalid publication fingerprint.');
      if (n.type==='commander' && !n.published && n.publicationFingerprint!==null) fail('Unpublished views cannot have a publication fingerprint.');
      if (!n.published) continue;
      const p=n.published;
      if (Object.keys(p).some(k=>!snapshotFields.includes(k))||!dimensions(p)||!raster(p.map)||!Array.isArray(p.objects)||['summary','name','title','time','at'].some(k=>typeof p[k]!=='string')||!Number.isFinite(Date.parse(p.at))) fail('Invalid published snapshot.');
      if (typeof n.publicationFingerprint!=='string') fail('Published views require a publication fingerprint.');
      let original;try{original=JSON.parse(n.publicationFingerprint);}catch(e){fail('Invalid publication fingerprint.');}
      const contentFields=snapshotFields.filter(k=>k!=='at');
      if (!original||Object.keys(original).length!==contentFields.length||Object.keys(original).some(k=>!contentFields.includes(k))||!(raster(original.map)||original.map==='fake-pea-ridge-map.jpg')) fail('Invalid publication fingerprint.');
      for (const field of contentFields) if (field!=='map'&&JSON.stringify(original[field])!==JSON.stringify(p[field])) fail('Publication fingerprint does not match its snapshot.');
      const publishedIds=new Set();
      for (const o of p.objects) {validateObject(o,true);if(publishedIds.has(o.id))fail('Duplicate published object.');publishedIds.add(o.id);}
    }
    return state;
  }
  return {id,copy,getNode,children,ancestorPath,effectiveView,moveNode,copyObject,editObject,deleteObject,addNode,deleteNode,publicObject,publicContent,fingerprint,publishCommander,defaultState,validateScenario};
})();
