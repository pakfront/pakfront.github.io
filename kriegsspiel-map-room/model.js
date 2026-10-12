'use strict';
// Classic script: the map room also runs directly from disk.
const ViewModel = (() => {
  const copy = value => JSON.parse(JSON.stringify(value));
  const id = () => crypto.randomUUID();
  const publicFields = ['id','type','label','kind','side','x','y','facing','strength','activity','observed','radius','presentation','points','geometry','style','subtype'];
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
      masks: (state.visibilityMasks||[]).filter(m=>owners.has(m.ownerId)),
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
    if (children(state,nodeId).length || state.objects.some(o => o.ownerId === nodeId)||(state.visibilityMasks||[]).some(m=>m.ownerId===nodeId)) throw Error('Remove children and owned objects before deleting this view.');
    state.nodes=state.nodes.filter(x => x.id !== nodeId);
    children(state,n.parentId).forEach((x,i) => x.order=i);
    return n.parentId;
  }
  function selectedMask(state,nodeId,strict=false) {
    const n=getNode(state,nodeId);if(!n?.maskId)return null;
    const mask=effectiveView(state,nodeId).masks.find(m=>m.id===n.maskId);
    if(!mask&&!strict)return null;
    if(!mask)throw Error('The selected visibility mask is no longer inherited by this view. Select another mask or None.');
    if(!VisibilityMask.aligned(mask,state.mapDocument)&&!strict)return null;
    if(!VisibilityMask.aligned(mask,state.mapDocument))throw Error('Visibility mask uses a different map extent. Recalculate it before publication.');
    return mask;
  }
  function publicContent(state,nodeId) {
    const n = getNode(state,nodeId), v = effectiveView(state,nodeId);
    return {
      objects:v.objects.map(publicObject),summary:v.summaryBlocks.map(b => b.text).join('\n\n'),
      name:n.name,title:state.title,time:state.time,mapDocument:MapDocument.publicProjection(state.mapDocument),
      ...(selectedMask(state,nodeId)?{visibilityMask:VisibilityMask.project(selectedMask(state,nodeId),n.maskTreatment||'overlay')}:{})
    };
  }
  const fingerprint = (state,nodeId) => JSON.stringify(publicContent(state,nodeId));
  function publishCommander(state,nodeId,embeddedMap) {
    const n=getNode(state,nodeId);
    if (!n || n.type !== 'commander') throw Error('Select a commander to publish.');
    const mask=selectedMask(state,nodeId,true);if(mask&&(VisibilityMask.stale(mask,state.mapDocument)||mask.warnings.length)&&!VisibilityMask.approved(mask,state.mapDocument))throw Error('Review and accept the incomplete or stale mask, or recalculate before publishing.');
    n.publicationFingerprint=fingerprint(state,nodeId);
    n.published={...publicContent(state,nodeId),mapDocument:MapDocument.publicProjection(embeddedMap),at:new Date().toISOString()};
    return n.published;
  }
  function defaultState() {
    const root={id:id(),parentId:null,type:'root',name:'Game',order:0,privateNotes:'',summary:''};
    const truth={id:id(),parentId:root.id,type:'truth',name:'Truth',order:0,privateNotes:'',summary:''};
    const state={version:5,visibilityMasks:[],title:'Pea Ridge · practice encounter',time:'10:00',mapDocument:MapDocument.legacy({map:'fake-pea-ridge-map.jpg',width:1408,height:768,metersPerPixel:10,calibrated:false},'Pea Ridge'),rootId:root.id,nodes:[root,truth],objects:[]};
    const red=addNode(state,root.id,'group','Red'),blue=addNode(state,root.id,'group','Blue');
    addNode(state,red.id,'commander','Red division');addNode(state,blue.id,'commander','Blue division');
    for (const r of [{label:'1st Infantry',kind:'infantry',side:'blue',x:490,y:520,strength:'450',activity:'Holding',facing:0},{label:'Ridge battery',kind:'artillery',side:'red',x:890,y:350,strength:'4 guns',activity:'Deployed',facing:25}]) {
      state.objects.push({...r,id:id(),ownerId:truth.id,type:'counter',observed:'',radius:0,presentation:'confirmed',notes:'',falseContact:false});
    }
    ForceModel.initialize(state);
    return state;
  }
  function validateRecords(state,legacy=false) {
    const fail = message => {throw Error(message);};
    const finite = value => typeof value === 'number' && Number.isFinite(value);
    const raster = map => typeof map === 'string' && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(map);
    const dimensions = v => finite(v.width)&&v.width>0&&finite(v.height)&&v.height>0&&finite(v.metersPerPixel)&&v.metersPerPixel>0&&typeof v.calibrated==='boolean';
    if (!Array.isArray(state.nodes)||!Array.isArray(state.objects)||typeof state.title!=='string'||typeof state.time!=='string') fail('Invalid scenario.');
    if(legacy){if(!dimensions(state)||!(raster(state.map)||state.map==='fake-pea-ridge-map.jpg'))fail('Invalid legacy map.');}
    else MapDocument.validate(state.mapDocument);
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
      if (!o || !validId(o.id)||!(legacy?['counter','marker','region']:['counter','marker','region','annotation']).includes(o.type)||typeof o.label!=='string') fail('Invalid object.');
      if (published && Object.keys(o).some(k=>!publicFields.includes(k))) fail('Published objects contain private or unsupported fields.');
      if (o.type==='region') {
        if (!Array.isArray(o.points)||o.points.length<3||o.points.some(p=>!Array.isArray(p)||p.length!==2||!p.every(finite))) fail('Invalid region geometry.');
      } else if(o.type==='annotation') {
        const preset=MapDocument.presets.annotation[o.subtype];
        if(!preset||o.geometry?.type!==preset[1])fail('Invalid annotation subtype.');
        Geometry.validate(o.geometry);MapDocument.validateStyle(o.style);
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
    if(state.version===5){
      if(!Array.isArray(state.visibilityMasks)||state.visibilityMasks.length>100)fail('Invalid visibility mask collection (maximum 100).');
      let cells=0;for(const mask of state.visibilityMasks){VisibilityMask.validate(mask);cells+=mask.grid.columns*mask.grid.rows;if(cells>2000000)fail('Scenario visibility masks exceed two million cells.');if(ids.has(mask.id)||!getNode(state,mask.ownerId))fail('Duplicate mask ID or missing owner.');ids.add(mask.id);}
      for(const n of state.nodes){if(n.maskId!==undefined&&n.maskId!==null&&(!validId(n.maskId)||!state.visibilityMasks.some(m=>m.id===n.maskId)))fail('Invalid selected visibility mask.');if(n.maskTreatment!==undefined&&!['overlay','conceal','fade'].includes(n.maskTreatment))fail('Invalid mask treatment.');}
    }
    const snapshotFields=legacy?['objects','summary','name','title','time','map','width','height','metersPerPixel','calibrated','at']:['objects','summary','name','title','time','mapDocument','at'];
    for (const n of state.nodes) {
      if (n.type!=='commander' && (n.published || n.publicationFingerprint)) fail('Only commanders can publish.');
      if (n.type==='commander' && n.publicationFingerprint!==null && typeof n.publicationFingerprint!=='string') fail('Invalid publication fingerprint.');
      if (n.type==='commander' && !n.published && n.publicationFingerprint!==null) fail('Unpublished views cannot have a publication fingerprint.');
      if (!n.published) continue;
      const p=n.published;
      const fields=p.visibilityMask!==undefined?[...snapshotFields,'visibilityMask']:snapshotFields;
      if(p.visibilityMask!==undefined){if(state.version!==5)fail('Visibility requires scenario version 5.');VisibilityMask.validate(p.visibilityMask,{publicOnly:true});if(p.visibilityMask.grid.width!==p.mapDocument.coordinateSystem.width||p.visibilityMask.grid.height!==p.mapDocument.coordinateSystem.height)fail('Published mask extent does not match map.');}
      if (Object.keys(p).some(k=>!fields.includes(k))||!Array.isArray(p.objects)||['summary','name','title','time','at'].some(k=>typeof p[k]!=='string')||!Number.isFinite(Date.parse(p.at))) fail('Invalid published snapshot.');
      if(legacy){if(!dimensions(p)||!raster(p.map))fail('Invalid published map.');}
      else MapDocument.validate(p.mapDocument,{publicOnly:true,portable:true});
      if (typeof n.publicationFingerprint!=='string') fail('Published views require a publication fingerprint.');
      let original;try{original=JSON.parse(n.publicationFingerprint);}catch(e){fail('Invalid publication fingerprint.');}
      const contentFields=fields.filter(k=>k!=='at');
      if (!original||Object.keys(original).length!==contentFields.length||Object.keys(original).some(k=>!contentFields.includes(k))) fail('Invalid publication fingerprint.');
      if(legacy){if(!(raster(original.map)||original.map==='fake-pea-ridge-map.jpg'))fail('Invalid publication fingerprint map.');}
      else MapDocument.validate(original.mapDocument,{publicOnly:true});
      for (const field of contentFields) {
        if(legacy&&field==='map')continue;
        if(!legacy&&field==='mapDocument') {
          const a=copy(original.mapDocument),b=copy(p.mapDocument);
          if(a.background?.data==='fake-pea-ridge-map.jpg'&&b.background)a.background.data=b.background.data;
          if(JSON.stringify(a)!==JSON.stringify(b))fail('Publication fingerprint does not match its map snapshot.');
        } else if(JSON.stringify(original[field])!==JSON.stringify(p[field])) fail('Publication fingerprint does not match its snapshot.');
      }
      const publishedIds=new Set();
      for (const o of p.objects) {validateObject(o,true);if(publishedIds.has(o.id))fail('Duplicate published object.');publishedIds.add(o.id);}
    }
    return state;
  }
  function validateScenario(state) {
    if(!state||![3,4,5].includes(state.version))throw Error('Unsupported scenario version. This app requires version 5 (version 3 and 4 saves can be migrated).');
    if(state.version===5)return validateRecords(state);
    if(state.version===4){validateRecords(state);const migrated=copy(state);migrated.version=5;migrated.visibilityMasks=[];migrated.mapDocument=MapDocument.normalize(migrated.mapDocument);return validateRecords(migrated);}
    validateRecords(state,true);
    const migrated=copy(state),wrap=value=>{
      const mapDocument=MapDocument.publicProjection(MapDocument.legacy(value,'Battlefield'));
      const result={objects:value.objects,summary:value.summary,name:value.name,title:value.title,time:value.time,mapDocument};
      if(value.at)result.at=value.at;return result;
    };
    migrated.version=4;migrated.mapDocument=MapDocument.legacy(state,'Battlefield');
    for(const key of ['map','width','height','metersPerPixel','calibrated'])delete migrated[key];
    for(const n of migrated.nodes)if(n.published){n.published=wrap(n.published);n.publicationFingerprint=JSON.stringify(wrap(JSON.parse(n.publicationFingerprint)));}
    return validateScenario(migrated);
  }
  return {id,copy,getNode,children,ancestorPath,effectiveView,moveNode,copyObject,editObject,deleteObject,addNode,deleteNode,publicObject,publicContent,fingerprint,publishCommander,defaultState,validateScenario,selectedMask};
})();
