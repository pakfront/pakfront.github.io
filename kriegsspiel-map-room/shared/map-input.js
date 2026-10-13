'use strict';
// Shared pen/mouse interaction rules. Document edits remain in each application.
const MapInput = (() => {
  let tablet=false;
  try { tablet=localStorage.getItem('kriegsspiel-tablet')==='true'; } catch (_) {}
  const editing=()=>document.activeElement?.matches('input,textarea,select,[contenteditable="true"]');
  function handle(svg,e,selector='[data-vertex]') {
    const p=MapViewport.position(svg,e),radius=MapViewport.tolerance(svg,tablet?16:8);
    let nearest=null,best=radius;
    for(const h of svg.querySelectorAll(selector)) {
      const d=Math.hypot(Number(h.getAttribute('cx'))-p[0],Number(h.getAttribute('cy'))-p[1]);
      if(d<=best){best=d;nearest=h;}
    }
    return nearest||e.target.closest(selector);
  }
  function moved(d,e) {
    if(d.moving)return true;
    d.moving=Math.hypot(e.clientX-d.screen[0],e.clientY-d.screen[1])>=(tablet?6:4);
    return d.moving;
  }
  function mount(options) {
    const svg=document.getElementById('map'),bar=document.querySelector('.mapbar');
    const controls=document.createElement('div');controls.className='pen-controls';
    controls.innerHTML='<button id="tabletMode" aria-pressed="false">Tablet mode: off</button><button id="mapUndo">Undo</button><button id="cancelDrawing">Cancel</button><button id="zoomOut" aria-label="Zoom out">−</button><button id="zoomIn" aria-label="Zoom in">+</button><details class="pen-help"><summary>Pen controls</summary><div class="pen-help-content"><p>Hold Space or the pen side button (right-click) to pan temporarily. + / − zoom; F fits the map. Esc cancels; Enter finishes; Ctrl / Cmd + Z undoes. Repeated taps cycle overlapping objects. Hold Ctrl / Cmd to bypass snapping. Map these keys to tablet buttons in your tablet settings. Tablet mode enlarges controls and ignores finger input on the map.</p><label class="check"><input id="penSnap" type="checkbox">Snap geometry to nearby vertices and edges</label><p>Pen buttons depend on your device and driver; Space and the Pan tool are always available.</p></div></details>';
    bar.after(controls);
    const toggle=document.getElementById('tabletMode');
    const refresh=()=>{document.documentElement.classList.toggle('tablet-mode',tablet);toggle.textContent=`Tablet mode: ${tablet?'on':'off'}`;toggle.setAttribute('aria-pressed',String(tablet));options.render();};
    toggle.onclick=()=>{cancel();tablet=!tablet;try{localStorage.setItem('kriegsspiel-tablet',String(tablet));}catch(_){}refresh();};
    document.getElementById('mapUndo').onclick=()=>{cancel();document.getElementById('undo').click();};
    document.getElementById('cancelDrawing').onclick=()=>{cancel();options.cancelDrawing();};
    const snapSetting=document.getElementById('penSnap');
    if(document.getElementById('snap'))snapSetting.closest('label').hidden=true;
    let space=false,active=null,pan=null,lastPointer=null,cycle=null,pendingPick=null;
    const original={down:svg.onpointerdown,move:svg.onpointermove,up:svg.onpointerup,dbl:svg.ondblclick};
    const release=id=>{if(svg.hasPointerCapture(id))svg.releasePointerCapture(id);};
    function cancel(){const id=active;active=null;pan=null;pendingPick=null;options.cancelDrag();if(id!==null)release(id);svg.classList.remove('temporary-pan');options.render();}
    function zoom(delta,at=null){cancel();const box=options.box();options.setBox(MapViewport.zoom(box,at||[box[0]+box[2]/2,box[1]+box[3]/2],delta,options.width()));options.render();}
    document.getElementById('zoomIn').onclick=()=>zoom(-1);
    document.getElementById('zoomOut').onclick=()=>zoom(1);
    svg.onpointerdown=e=>{
      if(active!==null||(tablet&&e.pointerType==='touch'))return;
      if(e.button!==0&&e.button!==2)return;
      active=e.pointerId;lastPointer=[e.clientX,e.clientY];
      if(space||e.button===2){e.preventDefault();svg.focus({preventScroll:true});pan={screen:lastPointer,box:options.box().slice(),barrel:e.button===2};svg.classList.add('temporary-pan');svg.setPointerCapture(e.pointerId);return;}
      original.down?.(e);
      // Capture even point-placement taps so another pointer cannot join the gesture.
      svg.setPointerCapture(e.pointerId);
    };
    svg.onpointermove=e=>{
      if((tablet&&e.pointerType==='touch')||(active!==null&&e.pointerId!==active))return;
      lastPointer=[e.clientX,e.clientY];
      // A barrel button can change during tip contact without another pointerdown.
      if(e.pointerType==='pen'&&active===e.pointerId){
        if((e.buttons&2)&&!pan){options.cancelDrag();options.render();pan={screen:lastPointer,box:options.box().slice(),barrel:true};svg.classList.add('temporary-pan');}
        else if(pan?.barrel&&!(e.buttons&2)){cancel();return;}
      }
      if(pendingPick&&Math.hypot(e.clientX-pendingPick.x,e.clientY-pendingPick.y)>=(tablet?6:4))pendingPick=null;
      if(pan){const scale=MapViewport.tolerance(svg,1);options.setBox([pan.box[0]+(pan.screen[0]-e.clientX)*scale,pan.box[1]+(pan.screen[1]-e.clientY)*scale,pan.box[2],pan.box[3]]);options.render();return;}
      original.move?.(e);
      svg.querySelectorAll('.pen-hover').forEach(h=>h.classList.remove('pen-hover'));
      if(active===null){const selector=options.tool().startsWith('los')?'[data-los-endpoint]':options.tool()==='select'?'[data-vertex]':null;if(selector)handle(svg,e,selector)?.classList.add('pen-hover');}
    };
    svg.onpointerup=e=>{if(e.pointerId!==active)return;const navigating=!!pan,id=active;active=null;pan=null;svg.classList.remove('temporary-pan');if(!navigating){original.up?.(e);if(pendingPick)options.select(pendingPick.id);}pendingPick=null;release(id);};
    svg.onpointercancel=e=>{if(e.pointerId===active)cancel();};
    svg.addEventListener('lostpointercapture',e=>{if(e.pointerId===active)cancel();});
    svg.onwheel=e=>{e.preventDefault();zoom(e.deltaY,MapViewport.position(svg,e));};
    svg.ondblclick=e=>{if(space||e.button!==0){e.preventDefault();return;}original.dbl?.(e);};
    svg.addEventListener('contextmenu',e=>e.preventDefault());
    document.addEventListener('keydown',e=>{
      if(editing())return;
      if(e.code==='Space'&&document.activeElement?.closest('.workspace')){e.preventDefault();if(!space){cancel();space=true;svg.classList.add('temporary-pan');}return;}
      if(e.ctrlKey||e.metaKey){if(e.key.toLowerCase()==='z'){cancel();if(!document.getElementById('redo')){e.preventDefault();document.getElementById('undo').click();}}return;}
      if(e.key==='+'||e.key==='='||e.key==='-'){e.preventDefault();const at=lastPointer?MapViewport.position(svg,{clientX:lastPointer[0],clientY:lastPointer[1]}):null;zoom(e.key==='-'?1:-1,at);}
      if(e.key.toLowerCase()==='f'){e.preventDefault();cancel();document.getElementById('fit').click();}
      if(e.key==='Enter'&&document.activeElement===svg){e.preventDefault();e.stopPropagation();document.getElementById('finish').click();}
      if(e.key==='Escape')cancel();
    },true);
    document.addEventListener('keyup',e=>{if(e.code==='Space'){space=false;if(pan)cancel();svg.classList.remove('temporary-pan');}});
    window.addEventListener('blur',()=>{space=false;cancel();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){space=false;cancel();}});
    window.addEventListener('storage',e=>{if(e.key==='kriegsspiel-tablet'){tablet=e.newValue==='true';refresh();}});
    document.addEventListener('click',e=>{if(active!==null&&e.target.closest('button,[data-tool]'))cancel();},true);
    refresh();
    return {
      pick(e,selector,attribute){
        const candidates=[...new Set(document.elementsFromPoint(e.clientX,e.clientY).map(el=>el.closest(selector)?.getAttribute(attribute)).filter(Boolean))];
        if(!candidates.length){cycle=null;return null;}
        const signature=candidates.join('|');
        const repeat=cycle&&cycle.signature===signature&&Math.hypot(e.clientX-cycle.x,e.clientY-cycle.y)<(tablet?16:8);
        const current=candidates.indexOf(options.selected());
        const index=repeat&&current>=0?current:0;
        pendingPick=repeat?{id:candidates[(index+1)%candidates.length],x:e.clientX,y:e.clientY}:null;
        cycle={signature,index,x:e.clientX,y:e.clientY};return candidates[index];
      },
      snap(p,e,features,excludeId=null){
        if(!snapSetting.checked||e?.ctrlKey||e?.metaKey)return {point:p,target:false};
        return GeometryEditor.snap(p,features,MapViewport.tolerance(svg,tablet?16:10),0,excludeId);
      }
    };
  }
  return {mount,handle,moved};
})();
