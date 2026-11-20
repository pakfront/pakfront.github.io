import {catalog} from './catalog.js';
export function unitProfile(name,optionIds=[],traitNames=[]){
 const base=catalog.profiles.find(p=>p.name===name);if(!base)throw Error('Unknown standard profile.');
 const options=optionIds.map(id=>base.options.find(o=>o.id===id));if(options.some(o=>!o))throw Error('Unknown profile option.');
 const seen=new Set();for(const o of options)for(const k of Object.keys(o.modifiers)){if(k!=='discards'&&seen.has(k))throw Error('Choose only one option affecting '+k+'.');seen.add(k)}
 const chosen=traitNames.map(name=>base.availableTraits.find(t=>t.trait.name===name));if(chosen.some(t=>!t))throw Error('Unknown trait for this profile.');if(chosen.length>base.traitsLimit)throw Error(`Choose at most ${base.traitsLimit} traits.`);
 let combat=base.combatDice,shooting=base.shootingDice,armour=base.armour,shot=base.armourWhenShot,stamina=base.stamina,missile=base.missileType,points=base.points;
 for(const o of options){const m=o.modifiers;combat+=m.combatDice||0;shooting+=m.shootingDice||0;armour+=m.armour||0;if(shot!=null)shot+=m.armour||0;stamina+=m.stamina||0;if(m.missileType)missile=m.missileType;points+=o.points}
 for(const t of chosen)points+=t.trait.isPointCostBasedOnMissileRange?t.trait.pointCost[Math.max(0,(missile?.range||1)-1)]:(t.points||0);
 const discarded=[...options.flatMap(o=>o.modifiers.discards||[]),...chosen.flatMap(t=>t.trait.discards||[])];
 const built=(base.builtInTraits||[]).filter(t=>!discarded.includes(t.name));
 return {role:base.type,combat,shooting,armour:shot==null?[armour]:[armour,shot],stamina,reputation:Math.max(1,Math.round(points/10)),points,traits:[...built.map(t=>t.name),...traitNames],equipment:missile?.name||'',notes:''};
}
export function heroProfile(level,armourModifier=0,missileId='NO',traitNames=[],spells=[]){
 if(![1,2,3,4].includes(level))throw Error('Standard heroes have levels 1–4.');
 const missile=catalog.missiles.find(m=>m.id===missileId);if(!missile||missile.heroPointCost.length!==4)throw Error('Choose a valid hero missile type.');
 const traits=traitNames.map(n=>catalog.heroTraits.find(t=>t.name===n));if(traits.some(t=>!t))throw Error('Unknown hero trait.');
 if(spells.length&&!traitNames.includes('Sorcery'))throw Error('Choose Sorcery before adding spells.');if(spells.length>level)throw Error('A hero cannot have more spells than their level.');
 let points=[5,15,25,35][level-1]+2*armourModifier+missile.heroPointCost[level-1];
 for(const t of traits)points+=Array.isArray(t.pointCost)?t.pointCost[t.isPointCostBasedOnMissileRange?Math.max(0,missile.range-1):level-1]:t.pointCost;
 points+=spells.reduce((n,s)=>n+s.points,0);
 return {level,combat:level,shooting:missileId==='NO'?0:1,armour:[3+armourModifier],stamina:level===1?1:2,points,reputation:Math.max(1,Math.round(points/10))+traits.reduce((n,t)=>n+(t.modifiers?.reputation||0),0),equipment:missileId==='NO'?'':missile.name,traits:traitNames,notes:spells.length?'Spells: '+spells.map(s=>s.name).join(', '):''};
}
