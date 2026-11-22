import {unitProfile,heroProfile} from './rules.js';
export const uid=()=>crypto.randomUUID();
export const profile=()=>({combat:0,shooting:0,armour:[0],stamina:4,reputation:0,points:0,traits:[],equipment:'',notes:''});
export function blank(){const c=uid();return {id:uid(),name:'Untitled army',notes:'',target:300,settings:{columns:'one',paper:'Letter',traitDescriptions:true},contingents:[{id:c,name:'Main contingent'}],types:[],units:[],heroes:[]};}
export function addUnits(a,typeId,contingentId,quantity){const t=a.types.find(t=>t.id===typeId);if(!t)throw Error('Choose a unit type.');if(!a.contingents.some(c=>c.id===contingentId))throw Error('Choose a contingent.');for(let i=0;i<quantity;i++){let number=t.nextNumber||1;const names=new Set([...a.units,...a.heroes].map(u=>u.name.toLowerCase()));while(names.has(`${t.name} ${number}`.toLowerCase()))number++;a.units.push({id:uid(),typeId,contingentId,number,name:`${t.name} ${number}`});t.nextNumber=number+1;}}
export function totals(a){const units=a.units.map(u=>a.types.find(t=>t.id===u.typeId));const sum=(arr,k)=>arr.reduce((n,x)=>n+x[k],0);return {unitPoints:sum(units,'points'),heroPoints:sum(a.heroes,'points'),points:sum(units,'points')+sum(a.heroes,'points'),reputation:sum([...units,...a.heroes],'reputation')};}
export function validate(a){
 const fail=m=>{throw Error(m)};
 if(!a || typeof a !== 'object' || Array.isArray(a)) fail('Missing army.');
 const str=(x,label,max=500)=>{if(typeof x!=='string'||x.length>max)fail(`Invalid ${label}.`)};
 const num=(x,label,max=9999)=>{if(!Number.isInteger(x)||x<0||x>max)fail(`Invalid ${label}.`)};
 const ids=new Set();const id=x=>{str(x,'ID',100);if(!/^[a-zA-Z0-9_.-]+$/.test(x)||x in Object.prototype||ids.has(x))fail('Missing or duplicate ID.');ids.add(x)};
 id(a.id);str(a.name,'army name',100);if(!a.name.trim())fail('Army name is required.');str(a.notes,'notes',10000);num(a.target,'points target');
 if(!a.settings||!['one','two'].includes(a.settings.columns)||!['Letter','A4'].includes(a.settings.paper))fail('Invalid print settings.');
 if(a.settings.traitDescriptions!==undefined&&typeof a.settings.traitDescriptions!=='boolean')fail('Invalid trait description setting.');
 for(const k of ['contingents','types','units','heroes'])if(!Array.isArray(a[k])||a[k].length>1000)fail(`Invalid ${k} list.`);
 if(!a.contingents.length)fail('At least one contingent is required.');
 const names=new Set();
 const name=x=>{str(x,'name',100);if(!x.trim())fail('Names cannot be empty.')};
 const prof=x=>{for(const k of ['combat','shooting','stamina','reputation','points'])num(x[k],k,k==='stamina'?20:9999);if(x.stamina<1)fail('Stamina must be at least 1.');if(!Array.isArray(x.armour)||x.armour.length<1||x.armour.length>2)fail('Armour must be one value or A/B.');x.armour.forEach(v=>num(v,'armour',99));if(!Array.isArray(x.traits)||x.traits.length>50)fail('Invalid traits.');x.traits.forEach(t=>str(t,'trait',100));str(x.equipment,'equipment',500);str(x.notes,'profile notes',2000);};
 a.contingents.forEach(c=>{id(c.id);name(c.name)});
 const cs=new Set(a.contingents.map(c=>c.id));
 a.types.forEach(t=>{id(t.id);name(t.name);const n=t.name.toLowerCase();if(names.has(n))fail('Unit type names must be unique.');names.add(n);str(t.role,'unit role',100);num(t.nextNumber,'unit sequence',1000000);prof(t)});
 const ts=new Set(a.types.map(t=>t.id));names.clear();
 for(const e of [...a.units,...a.heroes]){id(e.id);name(e.name);if(names.has(e.name.toLowerCase()))fail('Every unit and hero must have a unique name.');names.add(e.name.toLowerCase());if(!cs.has(e.contingentId))fail('An entry refers to a missing contingent.');}
 a.units.forEach(u=>{if(!ts.has(u.typeId))fail('A unit refers to a missing unit type.');num(u.number,'unit number',1000000);if(u.number<1)fail('Invalid unit number.')});
 a.heroes.forEach(h=>{prof(h);num(h.level,'hero level',10);if(h.level<1)fail('Hero level must be at least 1.')});
 for(const t of a.types)if(t.standard){const s=t.standard;if(!Array.isArray(s.options)||!Array.isArray(s.traits))fail('Invalid standard unit configuration.');if(new Set(s.options).size!==s.options.length||new Set(s.traits).size!==s.traits.length)fail('Duplicate options or traits.');unitProfile(s.profile,s.options,s.traits);}
 for(const h of a.heroes)if(h.standard){const s=h.standard;if(!Array.isArray(s.traits)||!Array.isArray(s.spells)||![0,1,-1].includes(s.armourModifier))fail('Invalid standard hero configuration.');if(new Set(s.traits).size!==s.traits.length)fail('Duplicate hero traits.');s.spells.forEach(x=>{str(x.name,'spell name');num(x.points,'spell points')});heroProfile(s.level,s.armourModifier,s.missileId,s.traits,s.spells);if(h.extraNotes!==undefined)str(h.extraNotes,'hero notes',2000);}
 return a;
}
