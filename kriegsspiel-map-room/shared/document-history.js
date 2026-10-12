'use strict';
const DocumentHistory = (() => {
  function create(limit=60) {
    const undo=[],redo=[];
    return {
      record(before){undo.push(Geometry.clone(before));if(undo.length>limit)undo.shift();redo.length=0;},
      undo(current){if(!undo.length)return null;redo.push(Geometry.clone(current));return undo.pop();},
      redo(current){if(!redo.length)return null;undo.push(Geometry.clone(current));return redo.pop();},
      clear(){undo.length=redo.length=0;},
      get canUndo(){return !!undo.length;},get canRedo(){return !!redo.length;}
    };
  }
  return {create};
})();
