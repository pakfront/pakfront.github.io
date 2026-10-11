// GCACW Charts & Tables v1.6, page 4; Series Rules §5.1.
const MovementRules = (() => {
  const games = ['Standard', 'SIV', 'SJW', 'HCR', 'RTG', 'LLO', 'GTC', 'HSN', 'AIO', 'BAC', 'RWH', 'AGA', 'OTR', 'TOM', 'TPC', 'BTC'];
  const defaults = { side:'USA', unit:'infantry', leader:'none', game:'Standard', fatigue:0, exhausted:false, organized:true, manpower:7, garrison:false, heat:false, supply:false, early:false, retreat:false, btcDates:false, optional:false, force:false, distance1:'', distance2:'', extendedRoll:'', force1:'', force2:'' };
  const extendedColumns = ['Organized · any manpower', 'Disorganized · manpower ≤ 5', 'Disorganized · manpower 6–9', 'Disorganized · manpower ≥ 10'];
  const extendedTable = [['NE','NE','NE','NE'], ['D',1,1,1], ['D',1,1,2], ['D',1,2,3]];
  function leaders(s) {
    if (s.unit === 'cavalry') return ['none', 'division', 'corps'];
    return s.side === 'USA' && s.game === 'BTC' ? ['none', 'infantry', 'grand'] : ['none', 'infantry'];
  }
  function die(v) { return Number.isInteger(Number(v)) && Number(v)>=1 && Number(v)<=6 ? Number(v) : null; }
  function calculate(s) {
    const cavalry=s.unit==='cavalry', leader=leaders(s).includes(s.leader)?s.leader:'none';
    let drm=0, minimum=0;
    if (cavalry) drm=(s.side==='CSA'?1:0)+(leader==='division'?1:leader==='corps'?2:0);
    else if (leader==='grand') drm=s.btcDates?2:1;
    else if (leader==='infantry') {
      drm=s.side==='CSA'?(['OTR','AGA'].includes(s.game)?1:2):1;
      if (s.side==='USA' && ['SIV','AGA','OTR'].includes(s.game)) { drm=0; minimum=2; }
    } else if (s.side==='CSA') {
      drm=['OTR','AGA'].includes(s.game)?0:1;
      if (drm===0) minimum=2;
    }
    const optional=s.fatigue===4 && s.optional && s.organized;
    const eligible=s.fatigue<4 || optional;
    const fatigue=Math.min(4,s.fatigue+1);
    const extended=eligible && !optional && fatigue>=(s.exhausted?2:3);
    const extendedReason=!eligible?'March unavailable at starting fatigue 4.':optional?'No extended march roll required: optional organized fatigue-4 march.':extended?`Extended march roll required: ${s.exhausted?'exhausted':'normal'} side reaches fatigue ${fatigue}.`:`No extended march roll required: ${s.exhausted?'exhausted':'normal'} side reaches fatigue ${fatigue}.`;
    const modifiers=[];
    const add=(label,value)=>{if(value)modifiers.push({label,value});};
    if (!s.exhausted && s.fatigue===3) add('Normal side: fatigue 3 → 4',1);
    if (s.exhausted && s.fatigue===2) add('Exhausted side: fatigue 2 → 3',1);
    if (s.exhausted && s.fatigue===3) add('Exhausted side: fatigue 3 → 4',3);
    if (s.side==='USA') {
      const zero=cavalry && (['HSN','AIO','BAC','RWH','AGA','TOM','TPC'].includes(s.game) || ['RTG','LLO','GTC'].includes(s.game)&&!s.garrison);
      const garrison=s.garrison && ['SJW','HCR','RTG','RWH'].includes(s.game);
      add(zero?'Union cavalry exception':garrison?'Union garrison / non-Regular Army':'Other Union units',zero?0:garrison?2:1);
    }
    add('Heat event',s.heat?1:0); add('Out of supply (Advanced Game)',s.supply?1:0);
    if(s.game==='AGA') { add('1861 scenario',s.early?1:0); add('1861 cavalry',s.early&&cavalry?-3:0); add('Retreat March (scenarios 2, 5, 6, 7)',s.retreat?-3:0); }
    const extendedDRM=modifiers.reduce((sum,m)=>sum+m.value,0);
    const roll=die(s.extendedRoll), modifiedRoll=roll===null?null:roll+extendedDRM;
    const extendedColumn=s.organized?0:s.manpower<=5?1:s.manpower<=9?2:3;
    const chartRow=!extended||modifiedRoll===null?null:modifiedRoll<=5?0:modifiedRoll===6?1:modifiedRoll===7?2:3;
    let loss=0, organized=s.organized&&!optional, extendedResult=extended?'Awaiting roll':'Not required';
    if(chartRow!==null) {
      const result=extendedTable[chartRow][extendedColumn];
      if(result==='NE') extendedResult='NE — no effect';
      else { organized=false; if(result==='D')extendedResult='D — disorganized';
        else {loss=result; extendedResult=`Lose ${loss} manpower; disorganized`;}
      }
    }
    const afterExtended=Math.max(0,s.manpower-loss);
    const forceEligible=eligible&&!optional&&s.unit!=='artillery'&&organized&&afterExtended>0&&(!extended||roll!==null);
    const d1=die(s.distance1),d2=die(s.distance2),f1=die(s.force1),f2=die(s.force2);
    const base=eligible&&d1!==null&&(!cavalry||d2!==null)?Math.max(minimum,d1+(cavalry?d2:0)+drm):null;
    let bonus=0, forceLoss=0, forceResult='Not selected';
    if(s.force) {
      if(!forceEligible)forceResult=extended&&roll===null?'Resolve extended march first':'Not eligible';
      else if(f1===null||cavalry&&f2===null){bonus=null;forceResult='Awaiting roll';}
      else {const sum=f1+(cavalry?f2:0);bonus=Math.max(cavalry?4:2,sum-1);forceLoss=cavalry?(sum>=8?1:0):sum===6?(afterExtended>=6?2:1):sum>=2?1:0;organized=false;forceResult=`+${bonus} MP; ${forceLoss?`lose ${forceLoss} manpower`:'no manpower loss'}; disorganized`;}
    }
    const remaining=Math.max(0,afterExtended-forceLoss), pending=extended&&roll===null||s.force&&forceEligible&&bonus===null;
    const total=base===null||pending||!remaining?null:base+(bonus||0);
    return {extendedReason,extendedColumn,chartRow,cavalry,leader,drm,minimum,eligible,optional,fatigue,extended,modifiers,extendedDRM,modifiedRoll,extendedResult,loss,afterExtended,forceEligible,base,bonus,forceLoss,forceResult,remaining,organized,pending,total};
  }
  return {games,defaults,leaders,calculate,extendedColumns,extendedTable};
})();

(() => {
  const key='gcacw-movement-v1', panel=document.getElementById('movement-panel');
  let saved={};try {saved=JSON.parse(localStorage.getItem(key))||{};}catch(_){}
  const state={...MovementRules.defaults};
  for(const [k,v] of Object.entries(saved)) {
    if(!(k in state))continue;
    if(typeof state[k]==='boolean'&&typeof v==='boolean')state[k]=v;
    else if(['fatigue','manpower'].includes(k)&&Number.isInteger(v)&&v>=(k==='fatigue'?0:1)&&v<=(k==='fatigue'?4:99))state[k]=v;
    else if(typeof state[k]==='string'&&typeof v==='string')state[k]=v;
  }
  for(const [k,choices] of Object.entries({side:['USA','CSA'],unit:['infantry','artillery','cavalry'],game:MovementRules.games})) {
    if(!choices.includes(state[k]))state[k]=MovementRules.defaults[k];
  }
  const el=id=>document.getElementById(`move-${id}`), sign=n=>n>0?`+${n}`:String(n);
  const leaderNames={none:'None — single-unit march',infantry:'Infantry leader',division:'Cavalry division leader',corps:'Cavalry corps leader',grand:'Grand Division leader (BTC)'};
  el('game').innerHTML=MovementRules.games.map(g=>`<option>${g}</option>`).join('');
  function sync() {
    const allowed=MovementRules.leaders(state);if(!allowed.includes(state.leader))state.leader='none';
    el('leader').innerHTML=allowed.map(l=>`<option value="${l}">${leaderNames[l]}</option>`).join('');
    panel.querySelectorAll('[data-movement]').forEach(input=>{const k=input.dataset.movement;if(input.type==='checkbox')input.checked=state[k];else input.value=k==='fatigueAfter'?Math.min(4,state.fatigue+1):String(state[k]);});
  }
  function render() {
    const r=MovementRules.calculate(state);
    el('distance2').closest('label').hidden=!r.cavalry;el('force2').closest('label').hidden=!r.cavalry;
    el('btcDates').closest('label').hidden=r.leader!=='grand';
    el('early').closest('label').hidden=state.game!=='AGA';el('retreat').closest('label').hidden=state.game!=='AGA';
    el('garrison').closest('label').hidden=state.side!=='USA'||!['SJW','HCR','RTG','RWH','LLO','GTC'].includes(state.game);
    el('optional').closest('label').hidden=state.fatigue!==4;
    el('extendedRoll').disabled=!r.extended;
    el('extended-roll-controls').hidden=!r.extended;
    el('extended-chart').hidden=!r.extended;
    el('modifiers').hidden=!r.extended;
    el('extended-status').textContent=r.extendedReason;
    el('force').disabled=!r.forceEligible;el('force1').disabled=el('force2').disabled=!state.force||!r.forceEligible;
    el('distance-drm').textContent=sign(r.drm);
    el('formula').textContent=`${r.cavalry?'2D6':'1D6'}${r.drm?sign(r.drm):''}${r.minimum?' · minimum 2 MP':''}`;
    el('base').textContent=r.base===null?'—':`${r.base} MP`;
    el('fatigue-result').textContent=r.eligible?`${state.fatigue} → ${r.fatigue}`:'Ineligible';
    el('total').textContent=r.total===null?'—':r.total;
    el('status').textContent=!r.eligible?'Fatigue 4: march unavailable unless the optional rule applies to an organized unit.':!r.remaining?'Unit eliminated; no movement.':r.pending?'Enter the required march rolls to complete the result.':r.optional?'Optional fatigue-4 march: disorganized, no extended or forced march.':r.base===null?'Enter the movement die roll(s).':`Final allowance: ${r.total} movement points.`;
    el('fatigueAfter').value=String(r.fatigue);
    el('extended-drm').textContent=r.extended?sign(r.extendedDRM):'—';
    el('extended-result').textContent=r.extendedResult;
    el('chart-column').textContent=MovementRules.extendedColumns[r.extendedColumn];
    el('chart-rows').innerHTML=MovementRules.extendedTable.map((row,i)=>`<tr${r.chartRow===i?' class="is-current-table-cell"':''}><th scope="row">${['≤ 5','6','7','≥ 8'][i]}</th><td>${row[r.extendedColumn]}</td></tr>`).join('');
    el('modified-roll').textContent=r.extended&&r.modifiedRoll!==null?`Modified roll: ${r.modifiedRoll}`:r.extended?'Extended march required':'No extended march for this action';
    el('modifiers').replaceChildren(...r.modifiers.map(m=>{const row=document.createElement('div'),label=document.createElement('span'),value=document.createElement('b');label.textContent=m.label;value.textContent=sign(m.value);row.append(label,value);return row;}));
    el('force-result').textContent=r.forceResult;
    el('force-note').textContent=r.forceEligible?`${r.cavalry?'2D6 − 1, minimum 4':'1D6 − 1, minimum 2'} MP. Force march disorganizes the unit.`:r.extended&&r.modifiedRoll===null?'Resolve extended march before choosing force march.':state.unit==='artillery'?'Artillery cannot force march.':'Force march requires an organized, surviving unit below starting fatigue 4.';
    el('remaining').textContent=r.pending?'—':`${r.remaining} manpower · ${r.organized?'organized':'disorganized'}`;
    try {localStorage.setItem(key,JSON.stringify(state));}catch(_){}
  }
  panel.addEventListener('input',event=>{
    const input=event.target,k=input.dataset.movement;if(!k)return;
    if(k==='manpower'&&!input.checkValidity()){
      el('total').textContent='—';el('status').textContent='Enter starting manpower from 1 to 99.';return;
    }
    if(k==='fatigueAfter'){state.fatigue=Number(input.value)-1;el('fatigue').value=String(state.fatigue);render();return;}
    state[k]=['organized','exhausted'].includes(k)?input.value==='true':input.type==='checkbox'?input.checked:['fatigue','manpower'].includes(k)?Number(input.value):input.value;
    if(['unit','side','game'].includes(k))sync();render();
  });
  el('reset').addEventListener('click',()=>{Object.assign(state,MovementRules.defaults);sync();render();});
  sync();render();
})();
