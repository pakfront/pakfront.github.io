'use strict';
const OobDocument=(()=>{
 const clone=v=>JSON.parse(JSON.stringify(v));
 const create=()=>({format:'kriegsspiel-oob',version:1,title:'Untitled OOB',notes:'',entities:[],commanders:[]});
 const state=d=>({version:6,military:{entities:d.entities,commanders:d.commanders}});
 function normalize(input){
  if(!input||input.format!=='kriegsspiel-oob'||input.version!==1||typeof input.title!=='string'||typeof input.notes!=='string'||!Array.isArray(input.entities)||!Array.isArray(input.commanders))throw Error('Invalid or unsupported OOB document.');
  const d={format:input.format,version:1,title:input.title,notes:input.notes,entities:input.entities.map(e=>{
   if(!e||typeof e!=='object')throw Error('Invalid entity.');
   const r={};for(const k of ['id','type','name','parentId','order','echelon','kind','side','commanderId','notes'])r[k]=e[k];
   if(e.type==='unit')r.stats=e.stats&&{personnel:e.stats.personnel,guns:e.stats.guns,quality:e.stats.quality,equipment:e.stats.equipment};return r;
  }),commanders:input.commanders.map(c=>({id:c?.id,name:c?.name,rank:c?.rank,notes:c?.notes}))};
  const s=state(d);s.military.entities=d.entities.map(e=>({...e,operationalParentId:null}));ForceModel.validateOrganization(s,new Set(),false);return clone(d);
 }
 function totals(d,id){
  const byParent=new Map();for(const e of d.entities){if(!byParent.has(e.parentId))byParent.set(e.parentId,[]);byParent.get(e.parentId).push(e);}
  const result={units:0,formations:0,personnel:0,guns:0,personnelUnknown:0,gunsUnknown:0};
  function visit(e){if(e.type==='unit'){result.units++;for(const k of ['personnel','guns'])if(e.stats[k]===null)result[k+'Unknown']++;else result[k]+=e.stats[k];}else {if(e.type==='formation')result.formations++;for(const child of byParent.get(e.id)||[])visit(child);}}
  const root=d.entities.find(e=>e.id===id);if(root)visit(root);return result;
 }
 function extract(s){return normalize({...create(),title:s.title,entities:s.military.entities,commanders:s.military.commanders});}
 function append(s,input){
  const d=normalize(input),candidate=clone(s),ids=new Map(),used=new Set([...s.nodes,...s.objects,...s.military.entities,...s.military.commanders,...(s.visibilityMasks||[])].map(r=>r.id));
  for(const r of [...d.entities,...d.commanders]){let fresh;do{fresh=crypto.randomUUID();}while(used.has(fresh));used.add(fresh);ids.set(r.id,fresh);}
  candidate.military.commanders.push(...d.commanders.map(c=>({...c,id:ids.get(c.id)})));
  const offset=ForceModel.children(s,null).length;
  candidate.military.entities.push(...d.entities.map(e=>({...e,id:ids.get(e.id),parentId:e.parentId===null?null:ids.get(e.parentId),commanderId:e.commanderId===null?null:ids.get(e.commanderId),operationalParentId:null,order:e.order+(e.type==='force'?offset:0)})));
  ViewModel.validateScenario(candidate);s.military=candidate.military;return ids;
 }
 function counterDefaults(s,e){const stats=e.stats;return {label:e.name,kind:e.type==='unit'?e.kind:'hq',side:ForceModel.path(s,e.id)[0].side,strength:stats?[stats.personnel===null?'':`${stats.personnel} personnel`,stats.guns===null?'':`${stats.guns} guns`].filter(Boolean).join(' · '):''};}
 return {create,normalize,state,totals,extract,append,counterDefaults};
})();
