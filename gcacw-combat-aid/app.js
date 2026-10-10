const TERRAIN = ["Clear", "Rolling", "Rough/Hill/Loess", "Wds/Cty/Mtn", "Swamp"];
const MAP_TERRAIN = ["clear", "rolling", "woods", "loess", "hill", "mountain", "swamp", "provisional-swamp"];
const MAP_TERRAIN_LABELS = { clear:"Clear", rolling:"Rolling", woods:"Woods", loess:"Loess", hill:"Hill", mountain:"Mountain", swamp:"Swamp", "provisional-swamp":"Provisional swamp" };
const BARRIERS = ["none", "woods", "loess", "creek", "minor-river", "major-river", "all-water"];
const BARRIER_LABELS = { none:"None", woods:"Woods hexside", loess:"Loess hexside", creek:"Creek", "minor-river":"Minor river", "major-river":"Major river", "all-water":"All-water / impassable" };
const CROSSINGS = ["none", "road", "pike", "rr", "trail", "bridge", "dam", "ferry", "ford"];
const CROSSING_LABELS = { none:"None", road:"Road", pike:"Pike", rr:"Railroad", trail:"Trail", bridge:"Bridge", dam:"Dam", ferry:"Ferry", ford:"Ford" };
const HEXSIDES = ["None", "Bridge", "Dam", "Ferry", "Ford", "Creek", "Ridge", "Bluff"];
const ATTACK_TYPES = {
  "Column of Route": { inf: 0, cav: 0, drm: -3 }, "Hasty": { inf: 1, cav: 2, drm: -1 }, "Normal": { inf: 2, cav: 4, drm: 0 }, "Prepared": { inf: 4, cav: 4, drm: 1 }, "Assault": { inf: null, cav: null, drm: 1 }
};
const ENTRENCHMENTS = [
  { name: "None", mult: 1, inf: 4, cav: 0, art: 2 }, { name: "Abatis / Breastworks-Build", mult: 1.5, inf: 0, cav: 0, art: 0 },
  { name: "Breastwork / Fort-Build / Fort-Build-1", mult: 2, inf: 0, cav: 0, art: 0 }, { name: "Fort-Build-2", mult: 2.5, inf: 0, cav: 0, art: 0 }, { name: "Fort", mult: 3, inf: 0, cav: 0, art: 0 }
];
const ARTILLERY_TABLE = { "Clear": [-3,-2,0,1,"2*"], "Rolling": [-2,-1,0,"1*",1], "Rough/Hill/Loess": [-1,"-1*",0,0,"1*"], "Wds/Cty/Mtn": [0,0,0,0,0], "Swamp": [0,0,0,0,0] };
const POSITION_NAMES = ["North", "Northeast", "Southeast", "South", "Southwest", "Northwest"];
const STORAGE_KEY = "gcacw-combat-aid-v2";

function blankEdge() { return { barrier:"none", crossing:"none" }; }
function blankHex() { return { occupancy:"empty", demoralized:false, unitCV:2, terrain:"clear", centerEdge:blankEdge(), clockwiseEdge:blankEdge(), externalZoc:"none", externalCV:0, primary:false }; }
const defaults = {
  attacker:{ tactics:2, type:"Normal", inf:8, cav:0, art:1, mult:1 },
  defender:{ tactics:2, terrain:"Clear", mapTerrain:"clear", hexside:"None", redoubt:false, rows:ENTRENCHMENTS.map(x=>({inf:x.inf,cav:x.cav,art:x.art})) },
  modifiers:{ artilleryResolved:0, rain:0, otherAttacker:0, water:0, creek:0, ridge:0, hill:0, mountain:0, demoralized:0, otherDefender:0, activeAttackerCavalry:false, flanksRefused:false },
  flankConditions:{ rain:false, riversUnfordable:false }, hexes:POSITION_NAMES.map(blankHex), selectedHex:0
};
let shareNotice = "";
let state = loadSharedState() || loadState();

// Version 1 uses the defaults' fixed field order, omitting repeated JSON keys.
function shareChoices(key,template){
  return ({type:Object.keys(ATTACK_TYPES),terrain:template==="Clear"?TERRAIN:MAP_TERRAIN,
    mapTerrain:MAP_TERRAIN,hexside:HEXSIDES,occupancy:["empty","attacker","defender","offmap"],
    barrier:BARRIERS,crossing:CROSSINGS,externalZoc:["none","normal","restricted"]})[key];
}
function packShared(value,template=defaults,key=""){
  if(template && typeof template==="object") return Object.keys(template).flatMap(k=>packShared(value[k],template[k],k));
  if(typeof template==="string") return [shareChoices(key,template).indexOf(value)];
  return [typeof template==="boolean"?Number(value):value];
}
function unpackShared(values){
  let index=0;
  function read(template,key=""){
    if(template && typeof template==="object"){
      const result=Array.isArray(template)?[]:{};
      for(const k of Object.keys(template)) result[k]=read(template[k],k);
      return result;
    }
    const value=values[index++];
    if(typeof value!=="number" || !Number.isFinite(value)) throw Error("Invalid value");
    if(typeof template==="string"){
      const choices=shareChoices(key,template);
      if(!Number.isInteger(value)||value<0||value>=choices.length) throw Error("Invalid choice");
      return choices[value];
    }
    if(typeof template==="boolean"){
      if(value!==0&&value!==1) throw Error("Invalid flag");
      return !!value;
    }
    if(key==="selectedHex"){
      if(!Number.isInteger(value)||value<0||value>6) throw Error("Invalid hex");
      return value===6?"center":value;
    }
    return value;
  }
  if(!Array.isArray(values)) throw Error("Invalid worksheet");
  const result=read(defaults);
  if(index!==values.length) throw Error("Invalid worksheet length");
  return result;
}
function encodeSharedState(snapshot){
  const values=packShared({...snapshot,selectedHex:snapshot.selectedHex==="center"?6:snapshot.selectedHex});
  return "1."+btoa(JSON.stringify(values)).replaceAll("+","-").replaceAll("/","_").replace(/=+$/,"");
}
function decodeSharedState(encoded){
  if(encoded.length>12000||!/^1\.[A-Za-z0-9_-]+$/.test(encoded)) throw Error("Unsupported share link");
  const data=encoded.slice(2).replaceAll("-","+").replaceAll("_","/");
  return unpackShared(JSON.parse(atob(data)));
}
function loadSharedState(){
  const encoded=new URLSearchParams(location.hash.slice(1)).get("state");
  if(encoded===null) return null;
  try {
    const shared=decodeSharedState(encoded);
    shareNotice="Shared worksheet loaded. You can edit it and share a new link.";
    return shared;
  } catch {
    shareNotice="This share link is invalid or from an unsupported version. Your saved worksheet was loaded instead.";
    return null;
  }
}
function openShareDialog(){
  const url=new URL(location.href);
  url.hash="state="+encodeSharedState(state);
  get("share-url").value=url.href;
  const local=location.protocol==="file:"||["localhost","127.0.0.1","[::1]"].includes(location.hostname);
  get("share-status").textContent=local?"For a link other players can open, use Share worksheet on the hosted website.":"Copy the link and paste it into Discord or another chat.";
  get("share-dialog").showModal();
  get("share-url").select();
}
async function copyShareLink(){
  try {
    await navigator.clipboard.writeText(get("share-url").value);
    get("share-status").textContent="Link copied.";
  } catch {
    get("share-url").focus(); get("share-url").select();
    get("share-status").textContent="Select and copy the link above (Ctrl+C or ⌘C).";
  }
}

function clone(value){ return JSON.parse(JSON.stringify(value)); }
function n(value){ const x=Number(value); return Number.isFinite(x)?x:0; }
function trim(value){ return Number.isInteger(value)?String(value):String(Math.round(value*100)/100); }
function signed(value){ const x=n(value); return x>0?`+${trim(x)}`:x<0?`−${trim(Math.abs(x))}`:"0"; }
function title(value){ return value.charAt(0).toUpperCase()+value.slice(1); }
function get(id){ return document.getElementById(id); }
function setValue(id,value){ if(get(id)) get(id).value=value; }
function setChecked(id,value){ if(get(id)) get(id).checked=!!value; }
function setOptions(id,values,selected,label=x=>x){ const el=get(id); el.innerHTML=values.map(v=>`<option value="${v}"${String(v)===String(selected)?" selected":""}>${label(v)}</option>`).join(""); }
function saveState(){ try { localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); } catch {} }
function loadState(){
  try {
    const saved=JSON.parse(localStorage.getItem(STORAGE_KEY));
    if(saved) return hydrate(saved);
    const legacy=JSON.parse(localStorage.getItem("gcacw-combat-aid-v1"));
    if(legacy) return hydrate({ attacker:legacy.attacker, defender:legacy.defender, modifiers:legacy.modifiers });
  } catch {}
  return clone(defaults);
}
function hydrate(saved){
  const next=clone(defaults);
  next.attacker={...next.attacker,...saved.attacker};
  next.defender={...next.defender,...saved.defender,rows:saved.defender?.rows||next.defender.rows};
  next.modifiers={...next.modifiers,...saved.modifiers}; next.flankConditions={...next.flankConditions,...saved.flankConditions};
  if(saved.hexes?.length===6) next.hexes=saved.hexes.map(h=>({ ...blankHex(), ...h, centerEdge:{...blankEdge(),...h.centerEdge}, clockwiseEdge:{...blankEdge(),...h.clockwiseEdge} }));
  next.selectedHex=saved.selectedHex??0; return next;
}
function mapToCombatTerrain(mapTerrain){ return ({clear:"Clear",rolling:"Rolling",woods:"Wds/Cty/Mtn",loess:"Rough/Hill/Loess",hill:"Rough/Hill/Loess",mountain:"Wds/Cty/Mtn",swamp:"Swamp","provisional-swamp":"Swamp"})[mapTerrain]; }
function combatToMapTerrain(combat){ return ({Clear:"clear",Rolling:"rolling","Rough/Hill/Loess":"hill","Wds/Cty/Mtn":"woods",Swamp:"swamp"})[combat]; }
function primaryHexside(hex){
  if(["bridge","dam","ferry","ford"].includes(hex.centerEdge.crossing)) return title(hex.centerEdge.crossing);
  if(hex.centerEdge.barrier==="creek") return "Creek";
  return "None";
}
function resolvedArtilleryModifier(value,defenderArtillery){ return defenderArtillery===0?Math.max(0,n(value)):n(value); }

function buildInputs(){
  setOptions("attack-type",Object.keys(ATTACK_TYPES),state.attacker.type); setOptions("defender-terrain",TERRAIN,state.defender.terrain); setOptions("defender-hexside",HEXSIDES,state.defender.hexside);
  setOptions("artillery-resolved",[2,1,0,-1,-2,-3],state.modifiers.artilleryResolved,signed); setOptions("rain-mod",[0,-1],state.modifiers.rain,signed);
  ["water-crossing-mod","creek-mod","ridge-mod","hill-mod","mountain-mod"].forEach(id=>setOptions(id,[0,-1,-2],0,signed)); setOptions("demoralized-mod",[0,-1],state.modifiers.demoralized,signed);
  setOptions("hex-terrain",MAP_TERRAIN,"clear",v=>MAP_TERRAIN_LABELS[v]); setOptions("center-terrain",MAP_TERRAIN,state.defender.mapTerrain,v=>MAP_TERRAIN_LABELS[v]);
  setOptions("hex-center-barrier",BARRIERS,"none",v=>BARRIER_LABELS[v]); setOptions("hex-ring-barrier",BARRIERS,"none",v=>BARRIER_LABELS[v]);
  setOptions("hex-center-crossing",CROSSINGS,"none",v=>CROSSING_LABELS[v]); setOptions("hex-ring-crossing",CROSSINGS,"none",v=>CROSSING_LABELS[v]);
  setOptions("hex-external-zoc",["none","normal","restricted"],"none",v=>v==="none"?"None":`${title(v)} ZOC`);
  get("defender-rows").innerHTML=ENTRENCHMENTS.map((row,i)=>`<div class="unit-row" data-row="${i}"><span class="unit-label">${row.name}</span><input type="number" min="0" step="0.5" data-kind="inf" aria-label="${row.name} infantry CV"><input type="number" min="0" step="0.5" data-kind="cav" aria-label="${row.name} cavalry CV"><input type="number" min="0" step="0.5" data-kind="art" aria-label="${row.name} artillery"><span class="unit-mult">${trim(row.mult)}</span></div>`).join("");
  get("defender-rows").querySelectorAll(".unit-row").forEach((row,i)=>["inf","cav","art"].forEach(kind=>row.querySelector(`[data-kind="${kind}"]`).value=state.defender.rows[i][kind]));
  const heads=["Defender terrain","−4 or less","−3 to +1","+2 to +4","+5 to +7","+8 or more"];
  get("artillery-table").innerHTML=`<thead><tr>${heads.map(x=>`<th>${x}</th>`).join("")}</tr></thead><tbody>${TERRAIN.map(t=>`<tr><td>${t}</td>${ARTILLERY_TABLE[t].map(v=>`<td data-terrain="${t}" data-value="${v}">${v}</td>`).join("")}</tr>`).join("")}</tbody>`;
  syncForm();
}

function syncForm(){
  const a=state.attacker,d=state.defender,m=state.modifiers;
  [["attacker-tactics",a.tactics],["attack-type",a.type],["attacker-inf",a.inf],["attacker-cav",a.cav],["attacker-art",a.art],["attacker-mult",a.mult],["defender-tactics",d.tactics],["defender-terrain",d.terrain],["defender-hexside",d.hexside],["artillery-resolved",m.artilleryResolved],["rain-mod",m.rain],["other-attacker",m.otherAttacker],["water-crossing-mod",m.water],["creek-mod",m.creek],["ridge-mod",m.ridge],["hill-mod",m.hill],["mountain-mod",m.mountain],["demoralized-mod",m.demoralized],["other-defender",m.otherDefender],["center-terrain",d.mapTerrain]].forEach(([id,value])=>setValue(id,value));
  setChecked("redoubt",d.redoubt); setChecked("cav-adjusted",m.activeAttackerCavalry); setChecked("flanks-refused",m.flanksRefused); setChecked("rain-turn",state.flankConditions.rain); setChecked("rivers-unfordable",state.flankConditions.riversUnfordable); render();
}

function calculate(){
  const a=state.attacker,d=state.defender,m=state.modifiers;
  const attackerCV=(n(a.inf)+n(a.cav))*n(a.mult), attackerArt=n(a.art)*n(a.mult);
  let defenderCV=0,defenderArt=0,defenderCav=0,defenderRaw=0;
  d.rows.forEach((row,i)=>{ defenderRaw+=n(row.inf)+n(row.cav); defenderCav+=n(row.cav); defenderCV+=(n(row.inf)+n(row.cav))*ENTRENCHMENTS[i].mult; defenderArt+=Math.floor(n(row.art)*ENTRENCHMENTS[i].mult); });
  if(d.redoubt){ defenderCV*=1.5; defenderArt=Math.floor(defenderArt*1.5); }
  const tactics=n(a.tactics)-n(d.tactics); let ratioMod=0;
  if(attackerCV>0&&defenderCV>0) ratioMod=attackerCV>=defenderCV?Math.floor(attackerCV/defenderCV)-1:1-Math.ceil(defenderCV/attackerCV);
  const ratioText=attackerCV<=0||defenderCV<=0?"—":attackerCV>=defenderCV?`${trim(attackerCV/defenderCV)}:1`:`1:${trim(defenderCV/attackerCV)}`;
  const artDiff=attackerArt-defenderArt, artColumn=artDiff<=-4?0:artDiff<=1?1:artDiff<=4?2:artDiff<=7?3:4, artTable=ARTILLERY_TABLE[d.terrain][artColumn];
  const artilleryResolved=resolvedArtilleryModifier(m.artilleryResolved,defenderArt);
  const defenderMostlyCavalry=defenderRaw>0&&defenderCav/defenderRaw>0.5;
  const cavalryAdjustment=!!m.activeAttackerCavalry&&defenderMostlyCavalry&&!d.redoubt;
  const flank=FlankRules.computeFlank({ hexes:state.hexes, centerTerrain:d.mapTerrain, conditions:state.flankConditions, defenderCV, flanksRefused:m.flanksRefused, cavalryAdjusted:cavalryAdjustment });
  const refusedExtra=m.flanksRefused?1:0, attackType=ATTACK_TYPES[a.type].drm;
  const total=tactics+ratioMod+artilleryResolved+attackType+flank.final+refusedExtra+n(m.rain)+n(m.otherAttacker)+n(m.water)+n(m.creek)+n(m.ridge)+n(m.hill)+n(m.mountain)+n(m.demoralized)+n(m.otherDefender);
  return {attackerCV,attackerArt,defenderCV,defenderArt,defenderCav,defenderRaw,defenderMostlyCavalry,cavalryAdjustment,tactics,ratioMod,ratioText,artDiff,artColumn,artTable,artilleryResolved,flank,refusedExtra,attackType,total};
}

function render(){
  const c=calculate(),f=c.flank;
  get("final-drm").textContent=signed(c.total); get("combat-ratio").textContent=c.ratioText; get("artillery-diff").textContent=signed(c.artDiff); get("flank-drm-summary").textContent=signed(f.final);
  get("attacker-cv").textContent=trim(c.attackerCV); get("attacker-art-mod").textContent=trim(c.attackerArt); get("attacker-cav-ratio").textContent=c.attackerCV?`${Math.round(n(state.attacker.cav)/c.attackerCV*100)}%`:"0%";
  get("defender-cv").textContent=trim(c.defenderCV); get("defender-art-mod").textContent=trim(c.defenderArt); get("defender-cav-ratio").textContent=c.defenderRaw?`${Math.round(c.defenderCav/c.defenderRaw*100)}%`:"0%";
  if(c.defenderArt===0&&state.modifiers.artilleryResolved<0){ state.modifiers.artilleryResolved=0; setValue("artillery-resolved",0); }
  get("artillery-resolved").querySelectorAll("option").forEach(option=>option.disabled=c.defenderArt===0&&n(option.value)<0);
  get("mod-tactics").textContent=signed(c.tactics); get("mod-ratio").textContent=signed(c.ratioMod); get("mod-attack-type").textContent=signed(c.attackType); get("artillery-table-note").textContent=`Table: ${String(c.artTable).replace("-","−")}${c.defenderArt===0?" · minimum 0 (no defender artillery)":""}`;
  get("flank-count").textContent=f.coveredCount; get("flank-tab-count").textContent=f.coveredCount; get("flank-meter-fill").style.width=`${f.coveredCount/6*100}%`; get("final-flank").textContent=signed(f.final); get("flank-removed").value=f.reduction; get("flank-removed").disabled=true;
  get("flank-defender-cv").textContent=trim(c.defenderCV); get("flank-threshold").textContent=trim(c.defenderCV/4); get("visual-flank-result").textContent=signed(f.final);
  const cavalryStatus=!state.modifiers.activeAttackerCavalry?"inactive":state.defender.redoubt?"blocked by redoubt":!c.defenderMostlyCavalry?"defender is not majority cavalry":"applies";
  const special=f.special==="flanks-refused"?"Flanks Refused":f.special==="cavalry"?"Cavalry adjustment":`None${state.modifiers.activeAttackerCavalry?` · cavalry ${cavalryStatus}`:""}`;
  get("flank-breakdown").innerHTML=`<div><span>Step 1 · Covered hexes</span><b>${f.coveredCount} / 6</b></div><div><span>Step 2 · Basic bonus</span><b>${signed(f.basic)}</b></div><div><span>Step 3 · Qualifying reductions${f.eligibleReductions>3?` (${f.eligibleReductions}, max 3)`:""}</span><b>${signed(-f.reduction)}</b></div><div><span>After Step 3</span><b>${signed(f.afterStep3)}</b></div><div><span>Special adjustment</span><b>${special}</b></div>${c.refusedExtra?`<div><span>Separate Flanks Refused DRM</span><b>+1</b></div>`:""}`;
  document.querySelectorAll("#artillery-table td").forEach(td=>td.classList.toggle("is-current-table-cell",td.dataset.terrain===state.defender.terrain&&td.cellIndex===c.artColumn+1));
  renderHexes(c); saveState();
}

function sourceSummary(evaluation){
  if(!evaluation.sources.length) return "No attacker ZOC";
  const normal=evaluation.sources.filter(s=>s.type==="normal").length, restricted=evaluation.sources.filter(s=>s.type==="restricted").length;
  return normal?`${normal} normal${restricted?` + ${restricted} restricted`:""} ZOC source${normal+restricted===1?"":"s"}`:`${restricted} restricted ZOC source${restricted===1?"":"s"}`;
}
const HEX_CENTERS=[[500,137],[813,339],[813,635],[500,724],[188,635],[188,339]], CENTER_POINT=[500,445];
const CROSSING_CODES={road:"Rd",pike:"Pk",rr:"RR",trail:"Tr",bridge:"Br",dam:"Dm",ferry:"Fy",ford:"Fd"};
function edgeGraphic(from,to,edge,key){
  if(!edge||edge.barrier==="none"&&edge.crossing==="none") return "";
  const dx=to[0]-from[0],dy=to[1]-from[1],distance=Math.hypot(dx,dy)||1,ux=dx/distance,uy=dy/distance,px=-uy,py=ux,mx=(from[0]+to[0])/2,my=(from[1]+to[1])/2;
  const half=72,crossHalf=38,labelX=mx+px*25,labelY=my+py*25;
  const barrier=edge.barrier!=="none"?`<line class="map-edge ${edge.barrier}" x1="${mx-px*half}" y1="${my-py*half}" x2="${mx+px*half}" y2="${my+py*half}"/>`:"";
  const crossing=edge.crossing!=="none"?`<line class="map-crossing ${edge.crossing}" x1="${mx-ux*crossHalf}" y1="${my-uy*crossHalf}" x2="${mx+ux*crossHalf}" y2="${my+uy*crossHalf}"/><text class="edge-code" x="${labelX}" y="${labelY}">${CROSSING_CODES[edge.crossing]}</text>`:"";
  const description=`${BARRIER_LABELS[edge.barrier]}${edge.crossing!=="none"?` with ${CROSSING_LABELS[edge.crossing]}`:""}`;
  return `<g data-edge="${key}"><title>${description}</title>${barrier}${crossing}</g>`;
}
function renderHexsideLayer(){
  const centerEdges=state.hexes.map((h,i)=>edgeGraphic(CENTER_POINT,HEX_CENTERS[i],h.centerEdge,`center-${i}`)).join("");
  const ringEdges=state.hexes.map((h,i)=>edgeGraphic(HEX_CENTERS[i],HEX_CENTERS[(i+1)%6],h.clockwiseEdge,`ring-${i}-${(i+1)%6}`)).join("");
  return `<svg class="hexside-layer" viewBox="0 0 1000 860" preserveAspectRatio="none" aria-hidden="true">${centerEdges}${ringEdges}</svg>`;
}
function renderHexes(c=calculate()){
  const selected=state.selectedHex,map=get("hex-map"),evaluations=c.flank.evaluations;
  map.innerHTML=renderHexsideLayer()+state.hexes.map((h,i)=>{ const e=evaluations[i]; return `<button type="button" class="hex ${h.occupancy} ${e.covered?"covered":""} ${e.reduction&&c.flank.basic?"reduction":""} ${h.primary?"primary":""} ${selected===i?"is-selected":""}" data-index="${i}" data-terrain="${h.terrain}" aria-label="${POSITION_NAMES[i]}: ${e.covered?"covered":"not covered"}${e.reduction?", reduction":""}"><span class="hex-inner"><span class="hex-role">${h.occupancy==="offmap"?"Off map":h.occupancy}</span><span class="hex-detail">${MAP_TERRAIN_LABELS[h.terrain]}</span><span class="hex-edge">${e.covered?"COVERED":"OPEN"}${e.reduction&&c.flank.basic?" · −1":""}</span></span></button>`; }).join("")+`<button type="button" class="hex center ${selected==="center"?"is-selected":""}" data-index="center" data-terrain="${state.defender.mapTerrain}" aria-label="Center defender hex"><span class="hex-inner"><span class="hex-role">Defender</span><span class="hex-detail">${MAP_TERRAIN_LABELS[state.defender.mapTerrain]}</span></span></button>`;
  map.querySelectorAll(".hex").forEach(btn=>btn.addEventListener("click",()=>selectHex(btn.dataset.index==="center"?"center":Number(btn.dataset.index))));
  const center=selected==="center"; get("outer-hex-editor").hidden=center; get("center-hex-editor").hidden=!center; get("hex-position-label").textContent=center?"Center":POSITION_NAMES[selected]; get("hex-editor-title").textContent=center?"Edit defending hex":"Edit adjacent hex";
  if(!center){
    const h=state.hexes[selected],e=evaluations[selected]; document.querySelectorAll("[data-occupancy]").forEach(b=>b.classList.toggle("is-active",b.dataset.occupancy===h.occupancy));
    [["hex-terrain",h.terrain],["hex-unit-cv",h.unitCV],["hex-center-barrier",h.centerEdge.barrier],["hex-center-crossing",h.centerEdge.crossing],["hex-ring-barrier",h.clockwiseEdge.barrier],["hex-ring-crossing",h.clockwiseEdge.crossing],["hex-external-zoc",h.externalZoc],["hex-external-cv",h.externalCV]].forEach(([id,value])=>setValue(id,value));
    setChecked("hex-demoralized",h.demoralized); setChecked("hex-primary",h.primary); get("hex-unit-cv").disabled=h.occupancy!=="attacker"; get("hex-demoralized").disabled=!["attacker","defender"].includes(h.occupancy); get("hex-primary").disabled=h.occupancy!=="attacker"; get("hex-external-cv").disabled=h.externalZoc==="none";
    const reasons=e.coveredReasons.map(r=>`<li>${r}</li>`).join("")||"<li>No coverage condition applies.</li>"; const reductions=e.reductionReasons.map(r=>`<li>Reduction: ${r}</li>`).join("");
    get("hex-ruling").innerHTML=`<strong>${e.covered?"Covered":"Not covered"}${e.reduction&&c.flank.basic?" · reduces the bonus by 1":""}</strong><ul><li>${sourceSummary(e)}; ${trim(e.sourceCV)} CV against ${trim(e.threshold)} required.</li>${reasons}${reductions}</ul>`;
  }
}

function selectHex(index){ state.selectedHex=index; renderHexes(); saveState(); }
function switchTab(name){ document.querySelectorAll(".tab").forEach(t=>{const active=t.dataset.tab===name;t.classList.toggle("is-active",active);t.setAttribute("aria-selected",active);});document.querySelectorAll(".tab-panel").forEach(p=>{const active=p.id===`${name}-panel`;p.classList.toggle("is-active",active);p.hidden=!active;});window.scrollTo({top:0,behavior:"smooth"}); }
function updatePrimary(hex){ if(hex.primary){ state.defender.hexside=primaryHexside(hex); setValue("defender-hexside",state.defender.hexside); } }

function bind(){
  get("share-state").addEventListener("click",openShareDialog);
  get("copy-share").addEventListener("click",copyShareLink);
  const bindings={"attacker-tactics":["attacker","tactics"],"attack-type":["attacker","type"],"attacker-inf":["attacker","inf"],"attacker-cav":["attacker","cav"],"attacker-art":["attacker","art"],"attacker-mult":["attacker","mult"],"defender-tactics":["defender","tactics"],"defender-terrain":["defender","terrain"],"defender-hexside":["defender","hexside"],"artillery-resolved":["modifiers","artilleryResolved"],"rain-mod":["modifiers","rain"],"other-attacker":["modifiers","otherAttacker"],"water-crossing-mod":["modifiers","water"],"creek-mod":["modifiers","creek"],"ridge-mod":["modifiers","ridge"],"hill-mod":["modifiers","hill"],"mountain-mod":["modifiers","mountain"],"demoralized-mod":["modifiers","demoralized"],"other-defender":["modifiers","otherDefender"]};
  Object.entries(bindings).forEach(([id,path])=>get(id).addEventListener("input",e=>{ state[path[0]][path[1]]=e.target.type==="number"||(e.target.tagName==="SELECT"&&/^-?\d/.test(e.target.value))?n(e.target.value):e.target.value; if(id==="defender-terrain"){state.defender.mapTerrain=combatToMapTerrain(e.target.value);setValue("center-terrain",state.defender.mapTerrain);} if(id==="rain-mod"){state.flankConditions.rain=n(e.target.value)!==0;setChecked("rain-turn",state.flankConditions.rain);} render(); }));
  [["redoubt","redoubt","defender"],["cav-adjusted","activeAttackerCavalry","modifiers"],["flanks-refused","flanksRefused","modifiers"]].forEach(([id,key,group])=>get(id).addEventListener("change",e=>{state[group][key]=e.target.checked;render();}));
  get("defender-rows").addEventListener("input",e=>{const row=Number(e.target.closest(".unit-row").dataset.row);state.defender.rows[row][e.target.dataset.kind]=n(e.target.value);render();});
  document.querySelectorAll(".tab").forEach(t=>t.addEventListener("click",()=>switchTab(t.dataset.tab))); document.querySelectorAll("[data-open-flank]").forEach(b=>b.addEventListener("click",()=>switchTab("flank"))); document.querySelectorAll("[data-open-combat]").forEach(b=>b.addEventListener("click",()=>switchTab("combat")));
  document.querySelectorAll("[data-occupancy]").forEach(b=>b.addEventListener("click",()=>{const h=state.hexes[state.selectedHex];h.occupancy=b.dataset.occupancy;if(h.occupancy!=="attacker")h.primary=false;render();}));
  get("hex-terrain").addEventListener("change",e=>{state.hexes[state.selectedHex].terrain=e.target.value;render();}); get("hex-unit-cv").addEventListener("input",e=>{state.hexes[state.selectedHex].unitCV=n(e.target.value);render();}); get("hex-demoralized").addEventListener("change",e=>{state.hexes[state.selectedHex].demoralized=e.target.checked;render();});
  [["hex-center-barrier","centerEdge","barrier"],["hex-center-crossing","centerEdge","crossing"],["hex-ring-barrier","clockwiseEdge","barrier"],["hex-ring-crossing","clockwiseEdge","crossing"]].forEach(([id,edge,key])=>get(id).addEventListener("change",e=>{const h=state.hexes[state.selectedHex];h[edge][key]=e.target.value;updatePrimary(h);render();}));
  get("hex-external-zoc").addEventListener("change",e=>{state.hexes[state.selectedHex].externalZoc=e.target.value;render();}); get("hex-external-cv").addEventListener("input",e=>{state.hexes[state.selectedHex].externalCV=n(e.target.value);render();});
  get("hex-primary").addEventListener("change",e=>{state.hexes.forEach(h=>h.primary=false);const h=state.hexes[state.selectedHex];h.primary=e.target.checked;updatePrimary(h);render();});
  get("center-terrain").addEventListener("change",e=>{state.defender.mapTerrain=e.target.value;state.defender.terrain=mapToCombatTerrain(e.target.value);setValue("defender-terrain",state.defender.terrain);render();});
  get("rain-turn").addEventListener("change",e=>{state.flankConditions.rain=e.target.checked;state.modifiers.rain=e.target.checked?-1:0;setValue("rain-mod",state.modifiers.rain);render();}); get("rivers-unfordable").addEventListener("change",e=>{state.flankConditions.riversUnfordable=e.target.checked;render();});
  get("reset-all").addEventListener("click",()=>{if(confirm("Reset all combat and flanking selections?")){state=clone(defaults);localStorage.removeItem(STORAGE_KEY);buildInputs();}});
}

function registerWebMCP(){
  if(!document.modelContext?.registerTool)return; const report=()=>{const c=calculate();return{finalAttackerDRM:c.total,combatRatio:c.ratioText,artilleryDifference:c.artDiff,coveredHexes:c.flank.coveredCount,basicFlank:c.flank.basic,flankReduction:c.flank.reduction,finalFlankDRM:c.flank.final};};
  try{ document.modelContext.registerTool({name:"read_combat_result",title:"Read combat result",description:"Read the calculated combat DRM and step-by-step flank result.",inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute:report}); }catch(error){console.warn("WebMCP unavailable",error);}
}

buildInputs(); bind(); render(); registerWebMCP();
if(shareNotice){ get("share-notice").textContent=shareNotice; get("share-notice").hidden=false; }
