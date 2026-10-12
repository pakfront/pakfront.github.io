'use strict';
const MapDocument = (() => {
  const clone=Geometry.clone,id=()=>crypto.randomUUID();
  const presets={
    terrain:{woods:['Woods','Polygon','#47704b'],town:['Town','Polygon','#996b50'],marsh:['Marsh','Polygon','#738c70'],open:['Open ground','Polygon','#c0b876'],lake:['Lake','Polygon','#568aa4']},
    elevation:{raised:['Raised area','Polygon','#b18946'],depression:['Depression','Polygon','#7b79a2']},
    route:{road:['Road','LineString','#95754d'],trail:['Trail','LineString','#a89568'],railroad:['Railroad','LineString','#484d4a']},
    obstacle:{fence:['Fence','LineString','#846a4b'],creek:['Creek','LineString','#488ba5'],hedge:['Hedge','LineString','#507c48'],wall:['Wall','LineString','#73716b']},
    landmark:{bridge:['Bridge','Point','#805d3f'],ford:['Ford','Point','#488ba5'],gate:['Gate','Point','#846a4b'],building:['Building','Point','#996b50'],landmark:['Landmark','Point','#7c586c']},
    annotation:{label:['Label','Point','#334339'],arrow:['Arrow','LineString','#a34d36'],boundary:['Boundary','LineString','#795ba0'],area:['Shaded area','Polygon','#795ba0']}
  };
  const categories=Object.keys(presets);
  // Editable eastern-US rural battlefield assumptions, not surveyed terrain or a ruleset.
  // Point width/height describe a footprint; los.heightMeters is always vertical.
  const physicalDefaults={
    terrain:{
      woods:{los:{mode:'limited',heightMeters:15,penetrationMeters:30},movement:'Slow through trees and underbrush; formations may break up.',cover:'Trees provide intermittent cover.',sight:'Deciduous or mixed woodland; adjust for season and understory.'},
      town:{los:{mode:'limited',heightMeters:8,penetrationMeters:10},movement:'Streets allow passage; buildings constrain formations.',cover:'Buildings provide substantial cover.',sight:'Abstract village buildings and yards; draw streets or gaps as needed.'},
      marsh:{los:{mode:'limited',heightMeters:2,penetrationMeters:30},movement:'Soft, wet ground; difficult for wheeled transport.',cover:'Reeds provide concealment with little hard cover.',sight:'Tall reeds and wetland vegetation; reduce height for open wet ground.'},
      open:{los:{mode:'none',heightMeters:0,penetrationMeters:0},movement:'Generally suitable for formed troops; adjust for crops and soil.',cover:'Little cover.',sight:'No additional sight obstruction; ground elevation still applies.'},
      lake:{los:{mode:'none',heightMeters:0,penetrationMeters:0},movement:'Water prevents ordinary foot or wheeled passage.',cover:'Little cover.',sight:'No additional sight obstruction.',crossing:'Requires a designated crossing or boat.'}
    },
    route:{
      road:{widthMeters:6,movement:'Rural dirt road; suitable for troops and wagons.',sight:'Road surface creates no additional sight obstruction.'},
      trail:{widthMeters:2,movement:'Narrow foot or bridle trail; wheeled passage is limited.',sight:'Trail creates no additional sight obstruction.'},
      railroad:{widthMeters:4,movement:'Track and ballast impede wheeled passage across the line.',sight:'No embankment assumed; draw elevation separately.'}
    },
    obstacle:{
      fence:{widthMeters:0.3,los:{mode:'limited',heightMeters:1.2,penetrationMeters:3},movement:'Farm fence interrupts movement; crossing takes time.',cover:'Some concealment; little hard cover.',sight:'Low rail or board fence; standing observers may see over it.',crossing:'Use a gate or adjudicate crossing the fence.'},
      creek:{widthMeters:4,movement:'Small creek interrupts formed movement and wagons.',cover:'Banks may offer cover; draw bank elevation separately.',sight:'Water creates no additional sight obstruction.',crossing:'Use a bridge or ford; assess water depth manually.'},
      hedge:{widthMeters:2,los:{mode:'limited',heightMeters:2,penetrationMeters:3},movement:'Dense hedge impedes movement.',cover:'Good concealment; limited hard cover.',sight:'Dense shrubs form a narrow visual screen.',crossing:'Use a gap or gate.'},
      wall:{widthMeters:0.5,los:{mode:'opaque',heightMeters:1.5,penetrationMeters:0},movement:'Low stone wall interrupts movement.',cover:'Hard cover below wall height.',sight:'Opaque below the wall top; higher observers may see over it.',crossing:'Use a gap or adjudicate climbing.'}
    },
    landmark:{
      bridge:{widthMeters:6,heightMeters:12,movement:'Narrow crossing suitable for troops and wagons.',crossing:'Bridge crossing; assess capacity manually.',sight:'Bridge deck adds no sight obstruction; add parapets separately.'},
      ford:{widthMeters:6,heightMeters:8,movement:'Shallow crossing; footing and water conditions require adjudication.',crossing:'Ford crossing; assess depth manually.',sight:'No additional sight obstruction.'},
      gate:{widthMeters:3,heightMeters:0.3,los:{mode:'limited',heightMeters:1.2,penetrationMeters:3},movement:'Opening in a fence or hedge; passage depends on whether the gate is open.',crossing:'Adjudicate gate opening and passage.',sight:'Low farm gate; set no obstruction if open.'},
      building:{widthMeters:12,heightMeters:8,los:{mode:'limited',heightMeters:8,penetrationMeters:10},movement:'Rural house or farm building; interior movement is abstract.',cover:'Substantial cover.',sight:'Abstract building budget; interior and exterior paths use the same rule.'},
      landmark:{widthMeters:2,heightMeters:2,movement:'Reference point; no movement effect assumed.',sight:'Reference point; no additional sight obstruction assumed.'}
    }
  };
  function presetProperties(category,subtype){
    if(!presets[category]?.[subtype])throw Error('Choose a feature preset.');
    if(category==='elevation')return {relativeHeightMeters:subtype==='depression'?-20:20,priority:0};
    if(category==='annotation')return {};
    return clone({movement:'',cover:'',sight:'',crossing:'',widthMeters:0,heightMeters:0,relatedFeatureIds:[],los:{mode:'none',heightMeters:0,penetrationMeters:0},...physicalDefaults[category][subtype]});
  }
  function create(title='Untitled battlefield') {return {format:'kriegsspiel-map',version:2,id:id(),revision:0,title,coordinateSystem:{kind:'local-image',width:1408,height:768,metersPerUnit:10,calibrated:false,baselineElevationMeters:0},background:null,layers:[{id:id(),name:'Battlefield',order:0,exportEnabled:true}],features:[]};}
  function legacy(source,title='Battlefield') {
    const d=create(title);d.coordinateSystem={kind:'local-image',width:source.width,height:source.height,metersPerUnit:source.metersPerPixel,calibrated:source.calibrated,baselineElevationMeters:0};
    d.background={data:source.map,x:0,y:0,width:source.width,height:source.height};return d;
  }
  function feature(category,subtype,points,layerId) {
    const p=presets[category]?.[subtype];if(!p)throw Error('Choose a feature preset.');
    const properties=presetProperties(category,subtype);
    return {id:id(),layerId,category,subtype,name:p[0],geometry:Geometry.fromPoints(p[1],points),properties,style:{stroke:p[2],fill:p[2],strokeWidth:category==='route'?5:3,opacity:p[1]==='Polygon'?0.3:1,fontSize:18,dashed:['trail','fence','boundary'].includes(subtype)}};
  }
  const finite=n=>typeof n==='number'&&Number.isFinite(n),validId=v=>typeof v==='string'&&/^[A-Za-z0-9_-]+$/.test(v);
  const image=v=>typeof v==='string'&&/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(v);
  function keys(o,allowed,message) {if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).some(k=>!allowed.includes(k)))throw Error(message);}
  function validateStyle(s) {
    keys(s,['stroke','fill','strokeWidth','opacity','fontSize','dashed'],'Invalid feature style.');
    if(!/^#[0-9a-f]{6}$/i.test(s.stroke)||!/^#[0-9a-f]{6}$/i.test(s.fill)||!finite(s.strokeWidth)||s.strokeWidth<0||s.strokeWidth>100||!finite(s.opacity)||s.opacity<0||s.opacity>1||!finite(s.fontSize)||s.fontSize<=0||s.fontSize>200||typeof s.dashed!=='boolean')throw Error('Invalid style color, width, opacity, or font size.');
  }
  function validate(d,{publicOnly=false,portable=false}={}) {
    keys(d,['format','version','id','revision','title','coordinateSystem','background','layers','features','extensions'],'Invalid map document fields.');
    if(d.format!=='kriegsspiel-map'||![1,2].includes(d.version))throw Error('Unsupported map format or version. Expected kriegsspiel-map version 1 or 2.');
    if(!validId(d.id)||!Number.isInteger(d.revision)||d.revision<0||typeof d.title!=='string')throw Error('Invalid map identity or title.');
    const c=d.coordinateSystem;
    keys(c,['kind','width','height','metersPerUnit','calibrated','baselineElevationMeters'],'Invalid map coordinate system.');
    if(c.kind!=='local-image'||![c.width,c.height,c.metersPerUnit].every(n=>finite(n)&&n>0)||!finite(c.baselineElevationMeters)||typeof c.calibrated!=='boolean')throw Error('Map extent and scale must be positive numbers.');
    if(d.background!==null) {
      const b=d.background;keys(b,['data','x','y','width','height'],'Invalid map background.');
      if(!(image(b.data)||(!portable&&b.data==='fake-pea-ridge-map.jpg'))||![b.x,b.y,b.width,b.height].every(finite)||b.width<=0||b.height<=0)throw Error('Map background must be an embedded PNG or JPEG.');
    }
    if(!Array.isArray(d.layers)||!d.layers.length||!Array.isArray(d.features))throw Error('Map needs layers and features.');
    const ids=new Set([d.id]),layers=new Set();
    for(const l of d.layers){keys(l,['id','name','order','exportEnabled'],'Invalid layer fields.');if(!validId(l.id)||ids.has(l.id)||typeof l.name!=='string'||!l.name.trim()||!Number.isInteger(l.order)||l.order<0||typeof l.exportEnabled!=='boolean')throw Error('Invalid map layer.');ids.add(l.id);layers.add(l.id);}
    const featureIds=new Set();
    for(const f of d.features) {
      keys(f,['id','layerId','category','subtype','name','geometry','properties','style'],'Invalid feature fields.');
      const preset=presets[f.category]?.[f.subtype];
      if(!validId(f.id)||ids.has(f.id)||!layers.has(f.layerId)||!preset||typeof f.name!=='string'||f.geometry?.type!==preset[1])throw Error('Invalid feature identity, layer, or preset geometry.');
      Geometry.validate(f.geometry);validateStyle(f.style);ids.add(f.id);featureIds.add(f.id);
      const p=f.properties;
      const allowed=publicOnly?(f.category==='elevation'?['relativeHeightMeters']:[]):f.category==='elevation'?['relativeHeightMeters','priority']:f.category==='annotation'?[]:['movement','cover','sight','crossing','widthMeters','heightMeters','relatedFeatureIds'];
      if(!publicOnly&&d.version===2&&f.category!=='elevation'&&f.category!=='annotation')allowed.push('los');
      keys(p,allowed,'Unsupported feature properties.');
      if(p.los!==undefined){keys(p.los,['mode','heightMeters','penetrationMeters'],'Invalid sight settings.');if(!['none','opaque','limited'].includes(p.los.mode)||![p.los.heightMeters,p.los.penetrationMeters].every(v=>finite(v)&&v>=0))throw Error('Sight heights and penetration must be nonnegative.');}
      if(f.category==='elevation'&&(!finite(p.relativeHeightMeters)||(!publicOnly&&!Number.isInteger(p.priority))))throw Error('Elevation needs a signed height and integer priority.');
      for(const k of ['movement','cover','sight','crossing'])if(k in p&&typeof p[k]!=='string')throw Error('Invalid feature characteristics.');
      for(const k of ['widthMeters','heightMeters'])if(k in p&&(!finite(p[k])||p[k]<0))throw Error('Physical dimensions must be nonnegative.');
      if('relatedFeatureIds' in p&&(!Array.isArray(p.relatedFeatureIds)||new Set(p.relatedFeatureIds).size!==p.relatedFeatureIds.length||p.relatedFeatureIds.some(v=>!validId(v)||v===f.id)))throw Error('Invalid related feature references.');
    }
    for(const f of d.features)if(f.properties.relatedFeatureIds?.some(v=>!featureIds.has(v)))throw Error('Related feature is missing.');
    if(publicOnly&&d.extensions!==undefined)throw Error('Public maps cannot contain extensions.');
    if(d.extensions!==undefined)keys(d.extensions,Object.keys(d.extensions).filter(k=>!['__proto__','constructor','prototype'].includes(k)),'Invalid map extensions.');
    return d;
  }
  function normalize(d,options) {validate(d,options);const n=clone(d);n.version=2;n.features.forEach(f=>f.geometry=Geometry.normalize(f.geometry));return n;}
  function publicProjection(d) {
    const layers=d.layers.filter(l=>l.exportEnabled).sort((a,b)=>a.order-b.order),layerIds=new Map(layers.map((l,i)=>[l.id,'layer-'+i]));
    // Stable public identities exclude authoring IDs and revision from draft comparison.
    const result={format:d.format,version:d.version,id:'public-map',revision:0,title:d.title,coordinateSystem:clone(d.coordinateSystem),background:clone(d.background),layers:layers.map((l,i)=>({id:'layer-'+i,name:l.name,order:i,exportEnabled:true})),features:[]};
    if(!result.layers.length)result.layers=[{id:'empty-layer',name:'Battlefield',order:0,exportEnabled:true}];
    result.features=d.features.filter(f=>layerIds.has(f.layerId)).map((f,i)=>({id:'feature-'+i,layerId:layerIds.get(f.layerId),category:f.category,subtype:f.subtype,name:f.name,geometry:clone(f.geometry),properties:f.category==='elevation'?{relativeHeightMeters:f.properties.relativeHeightMeters}:{},style:clone(f.style)}));
    return result;
  }
  function elevationAt(d,p) {const applicable=d.features.filter(f=>f.category==='elevation'&&Geometry.pointInPolygon(f.geometry,p));applicable.sort((a,b)=>(a.properties.priority??0)-(b.properties.priority??0)||d.features.indexOf(a)-d.features.indexOf(b));return d.coordinateSystem.baselineElevationMeters+(applicable.at(-1)?.properties.relativeHeightMeters??0);}
  function compatible(a,b) {const x=a.coordinateSystem,y=b.coordinateSystem;return a.id===b.id&&x.kind===y.kind&&x.width===y.width&&x.height===y.height;}
  const settings=source=>{const d=source.mapDocument||source,c=d.coordinateSystem;return {width:c.width,height:c.height,metersPerPixel:c.metersPerUnit,calibrated:c.calibrated,map:d.background?.data||null};};
  return {id,clone,presets,categories,presetProperties,create,legacy,feature,validate,validateStyle,normalize,publicProjection,elevationAt,compatible,settings,image};
})();
