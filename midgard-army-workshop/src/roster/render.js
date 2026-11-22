import {traitDescription} from './traits.js';
import {totals} from './model.js';
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const symbols = {
 combat: { label: 'Combat', path: '<path d="m4 3 8 7-2 2-7-8V3h1Zm16 0-8 7 2 2 7-8V3h-1ZM9 13l-6 6m12-6 6 6M4 13l7 7m9-7-7 7"/>' },
 shooting: { label: 'Shooting', path: '<path d="M6 3q18 9 0 18L10 12 6 3Zm-3 9h18m-4-4 4 4-4 4"/>' },
 armour: { label: 'Armour', path: '<path d="M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6l-9-4Z"/>' },
 stamina: { label: 'Stamina', path: '<path d="M12 21 3 12C-3 5 7-2 12 6c5-8 15-1 9 6l-9 9Z"/>' },
 reputation: { label: 'Reputation', path: '<path d="M5 22V2m0 2h14l-3 5 3 5H5"/>' }
};
function icon(key) {
 return `<svg class="stat-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${symbols[key].path}</svg>`;
}
function stats(profile) {
 return Object.entries(symbols).map(([key, symbol]) => {
  const value = Array.isArray(profile[key]) ? profile[key].join('/') : profile[key];
  return `<span class="stat" role="img" aria-label="${symbol.label}: ${value}" title="${symbol.label}: ${value}">${icon(key)}<span aria-hidden="true">${value}</span></span>`;
 }).join('');
}
function track(label, count, traits = []) {
 const stamina = label === 'Stamina hits';
 // Hearts count up from 1 on the left; cross them off from right to left.
 const breakAt = traits.some(t => t.toLowerCase() === 'brittle') ? [2, 1] : [1];
 const marks = Array.from({length: count}, (_, i) => {
  if (!stamina) return '<span class="box" aria-hidden="true"></span>';
  const remaining = i + 1;
  const low = remaining <= Math.floor(count / 2);
  const breaks = breakAt.includes(remaining);
  const description = `${remaining} stamina remaining${breaks ? ': break-test threshold' : ''}${low ? '. Half stamina or less remaining' : ''}`;
  const heart = breaks
   ? '<svg class="stat-icon break-heart" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10 5C5-2-2 5 3 12l7 8-2-7 4-4-2-4ZM14 5c5-7 12 0 7 7l-7 8-2-7 4-4-2-4Z"/></svg>'
   : icon('stamina');
  const startLow = remaining === 1 && count >= 2 ? '<span class="low-stamina" role="group" aria-label="Half stamina or less remaining">' : '';
  const endLow = remaining === Math.floor(count / 2) && count >= 2 ? '</span>' : '';
  return `${startLow}<span class="heart-mark${breaks ? ' break-test' : ''}" data-remaining="${remaining}" role="img" aria-label="${description}" title="${description}">${heart}</span>${endLow}`;
 }).join('');
 return `<span class="track${stamina ? ' stamina' : ''}"><span class="track-label">${label}</span><span class="boxes">${marks}</span></span>`;
}
function detail(p, showDescriptions){
 const traits = showDescriptions
  ? p.traits.map(name=>{const description=traitDescription(name);return `<div class="traits trait-description"><strong>${esc(name)}</strong>${description?`: ${esc(description)}`:' (custom trait; see profile notes)'}</div>`}).join('')
  : p.traits.length?`<div class="traits">${esc(p.traits.join(', '))}</div>`:'';
 return (p.equipment?`<div class="traits">${esc(p.equipment)}</div>`:'')+traits+(p.notes?`<div class="traits">${esc(p.notes)}</div>`:'');
}
function contingentBadge(style) {
 if (!style) return '';
 const mark = {square: '■', triangle: '▲', diamond: '◆'}[style.shape];
 return `<i class="contingent-badge" style="color:${esc(style.color)}" aria-label="${esc(style.shape)} badge">${mark}</i>`;
}
export function renderRoster(a, badges = {}){const total=totals(a);return `<header><div class="eyebrow">Midgard Heroic Battles · force roster</div><h1>${esc(a.name)}</h1><div class="summary"><span>Points <strong>${total.points}${a.target?' / '+a.target:''}</strong></span><span>Hero pts <strong>${total.heroPoints}</strong></span><span>Unit pts <strong>${total.unitPoints}</strong></span><span>Reputation <strong>${total.reputation}</strong></span></div><div class="legend">${Object.entries(symbols).map(([k,s])=>`<span class="stat">${icon(k)}${s.label}</span>`).join('')}</div></header><div id="contingents">${a.contingents.map(c=>{
const units=a.units.filter(u=>u.contingentId===c.id);const heroes=a.heroes.filter(h=>h.contingentId===c.id);return `<section class="contingent"><h2>${contingentBadge(badges[c.id])}${esc(c.name)}<span>${units.length} units · ${heroes.length} heroes</span></h2>${heroes.map(h=>`<div class="hero"><div class="hero-title"><strong>${esc(h.name)}</strong></div><div class="profile-line"><span class="role">Hero · Level ${h.level}</span><div class="profile">${stats(h)}</div></div>${detail(h,a.settings.traitDescriptions!==false)}<div class="hero-tracks">${track('Levels lost',h.level)}${track('Stamina hits',h.stamina,h.traits)}</div></div>`).join('')}${a.types.filter(t=>units.some(u=>u.typeId===t.id)).flatMap(t=>{const all=units.filter(u=>u.typeId===t.id);return Array.from({length:Math.ceil(all.length/6)},(_,i)=>({...t,entries:all.slice(i*6,i*6+6),continued:i>0}))}).map(t=>`<section class="group"><div class="group-head"><h3>${esc(t.name)}${t.continued?' · continued':''}</h3>${t.continued?`<div class="traits">${esc(c.name)}</div>`:''}<div class="profile-line"><span class="role">${esc(t.role)}</span><div class="profile">${stats(t)}</div></div>${detail(t,a.settings.traitDescriptions!==false)}</div>${t.entries.map(u=>`<div class="unit"><span>${esc(u.name)}</span>${track('Stamina hits',t.stamina,t.traits)}</div>`).join('')}</section>`).join('')}${!units.length&&!heroes.length?'<p class="empty">No units or heroes yet.</p>':''}</section>`}).join('')}</div>${a.notes?`<p class="notes">${esc(a.notes)}</p>`:''}<footer>Cross off hearts from right to left. Outlined hearts mark half stamina or less remaining. Split hearts mark break-test thresholds: 1 stamina, or 2 and 1 for Brittle.</footer>`;}
