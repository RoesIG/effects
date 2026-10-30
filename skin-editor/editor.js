/* FX Tools · Skin Editor 1.0 beta 6D — mouse-anchored zoom, pan, split view, multisurface selections, stamps and project library. */
(()=>{'use strict';
const $=id=>document.getElementById(id), SIZE=64, PIXELS=SIZE*SIZE, STORE='fxtools.skin-editor.project.v1', LIBRARY='fxtools.skin-editor.library.v1';
const PART_NAMES=['Cabeza','Torso','Brazo der.','Brazo izq.','Pierna der.','Pierna izq.'];
const FACES=['frente','espalda','derecha','izquierda','arriba','abajo'];
const TOOL_NAMES={stamp:'Pegar diseño',brush:'Pincel',erase:'Borrador',eyedrop:'Cuentagotas',bucket:'Relleno',line:'Línea',rectangle:'Rectángulo',ellipse:'Elipse',select:'Selección',lasso:'Lazo',gradient:'Degradado',lighten:'Aclarar',darken:'Oscurecer',replace:'Cambiar color'};
const SKIN_BOXES=[
  {name:'Cabeza',pos:[0,28,0],w:8,h:8,d:8,base:[0,0],outer:[32,0]},
  {name:'Torso',pos:[0,18,0],w:8,h:12,d:4,base:[16,16],outer:[16,32]},
  {name:'Brazo der.',pos:[-6,18,0],w:4,h:12,d:4,base:[40,16],outer:[40,32],slim:true},
  {name:'Brazo izq.',pos:[6,18,0],w:4,h:12,d:4,base:[32,48],outer:[48,48],slim:true},
  {name:'Pierna der.',pos:[-2,6,0],w:4,h:12,d:4,base:[0,16],outer:[0,32]},
  {name:'Pierna izq.',pos:[2,6,0],w:4,h:12,d:4,base:[16,48],outer:[0,48]}
];
let layers=[],activeLayer=0,tool='brush',model='classic',outerShown=true,exploded=false,explodeGap=5,visibleParts=[true,true,true,true,true,true];
let fg='#a84360',bg='#202432',pattern='solid',patternScale=2,gradientMiddle=false,gradientMid='#5973d5',gradientMiddlePos=.5,eyedropSource='visible',opacity=1,brushSize=1,strength=.35,tolerance=0,shapeFill='outline',gradMode='linear',grid=true;
let selection=null,drag=null,clipboard=null,stampRotation=0,stampFlipX=false,stampFlipY=false,lastFace=null,undoStack=[],redoStack=[],view='3d',dirty=false,saveTimer=0;
let savedProjectId=null,hover=null, cursorCanvas=$('cursorCanvas'), cursorCtx=cursorCanvas.getContext('2d');
let frameCompose=false, drawingPaused=false;
let yaw=-.32,pitch=.14,zoom=60,cameraTarget=[0,16,0],uvZoom=1,uvPan=[0,0],spaceDown=false,symmetry=false,outerPreview='both',viewLight=1,renderQueued=false,resizeObserver=null;
let gl,glCanvas=$('glCanvas'),atlas=$('atlasCanvas'),atlasCtx=atlas.getContext('2d',{willReadFrequently:true});
let faceTextureCache=new Map(),gpu=null,software=null,sceneTextureCanvas=document.createElement('canvas'),sceneCtx=sceneTextureCanvas.getContext('2d',{willReadFrequently:true});sceneTextureCanvas.width=sceneTextureCanvas.height=64;
let composed=new Uint8ClampedArray(PIXELS*4),canvasImage=sceneCtx.createImageData(64,64);
const partState=(i)=>SKIN_BOXES.map((b,j)=>({...b,index:j,w:(b.slim&&model==='slim'?3:b.w),pos:[b.pos[0]+(b.slim&&model==='slim'?(j===2?.5:j===3?-.5:0):0),...b.pos.slice(1)]}))[i];
function rectsFor(box,outer=false){const [x,y]=outer?box.outer:box.base,w=box.w,h=box.h,d=box.d;
 return [{face:'frente',x:x+d,y:y+d,w,h},{face:'espalda',x:x+2*d+w,y:y+d,w,h},{face:'derecha',x,y:y+d,w:d,h},{face:'izquierda',x:x+d+w,y:y+d,w:d,h},{face:'arriba',x:x+d,y,w,h:d},{face:'abajo',x:x+d+w,y,w,h:d}];}
function allRects(target){return SKIN_BOXES.map((_,i)=>{const b=partState(i);return rectsFor(b,target==='outer').map((r,fi)=>({...r,part:i,fi,target}));}).flat()}
function findFace(x,y,target=layers[activeLayer]?.target||'base'){return allRects(target).find(f=>x>=f.x&&y>=f.y&&x<f.x+f.w&&y<f.y+f.h)||null}
function validPixel(x,y){return x>=0&&x<64&&y>=0&&y<64}
function rgba(hex,a=255){hex=hex.replace('#','');return [parseInt(hex.slice(0,2),16),parseInt(hex.slice(2,4),16),parseInt(hex.slice(4,6),16),a]}
function hexOf(p){return '#'+p.slice(0,3).map(n=>n.toString(16).padStart(2,'0')).join('')}
function newLayer(name,target='base',data){return {name,target,visible:true,locked:false,opacity:1,data:data?new Uint8ClampedArray(data):new Uint8ClampedArray(PIXELS*4)}}
function initNew(){savedProjectId=null;model='classic';outerPreview='both';$('layerPreview').value=outerPreview;const base=newLayer('Skin base','base');const outer=newLayer('Detalles exteriores','outer');const paintBox=(b,cl)=>{for(const r of rectsFor(b,false))for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++){const n=(y*64+x)*4;base.data.set(rgba(cl),n)}};
 SKIN_BOXES.forEach((_,i)=>{const b=partState(i);paintBox(b,i===0?'#d7ad8f':i===1?'#703449':i===2?'#343746':i===3?'#414553':i===4?'#252d3e':'#2e3548')});
 for(const [x,y] of [[10,11],[13,11]]){base.data.set(rgba('#f2f2f0'),(y*64+x)*4);base.data.set(rgba('#252838'),(y*64+x+1)*4)}
 for(let x=8;x<16;x++)for(let y=8;y<10;y++)base.data.set(rgba('#28252c'),(y*64+x)*4);
 // Different sleeves, cuffs and boots make all six pieces instantly recognisable.
 for(const part of [2,3]){const rect=rectsFor(partState(part),false)[0];for(let y=rect.y+8;y<rect.y+11;y++)for(let x=rect.x;x<rect.x+rect.w;x++)base.data.set(rgba('#ac5267'),(y*64+x)*4)}
 for(const part of [4,5]){const rect=rectsFor(partState(part),false)[0];for(let y=rect.y+10;y<rect.y+12;y++)for(let x=rect.x;x<rect.x+rect.w;x++)base.data.set(rgba('#111826'),(y*64+x)*4)}
 // Exterior de muestra, separada de la piel; facilita comprobar el interruptor global.
 const coat=rectsFor(partState(1),true)[0];for(let x=coat.x;x<coat.x+coat.w;x++){
  outer.data.set(rgba('#a54e69'),((coat.y+0)*64+x)*4);
  outer.data.set(rgba('#843851'),((coat.y+coat.h-1)*64+x)*4);
 }
 layers=[base,outer];activeLayer=0;outerShown=true;selection=null;undoStack=[];redoStack=[];$('projectName').value='Mi skin';model='classic';$('modelType').value=model;visibleParts=visibleParts.map(()=>true);updateToggles();updateAll(true);notify('Skin nueva preparada');}
function snapshot(){return {layers:layers.map(l=>({...l,data:new Uint8ClampedArray(l.data)})),activeLayer,selection:selection?new Uint8Array(selection):null,model,outerShown,outerPreview,visibleParts:[...visibleParts],exploded,explodeGap}}
function restore(s){layers=s.layers.map(l=>({...l,data:new Uint8ClampedArray(l.data)}));activeLayer=Math.min(s.activeLayer,layers.length-1);selection=s.selection?new Uint8Array(s.selection):null;model=s.model||model;outerShown=s.outerShown;outerPreview=s.outerPreview||'both';visibleParts=s.visibleParts||Array(6).fill(true);exploded=!!s.exploded;explodeGap=s.explodeGap||5;$('modelType').value=model;$('explodeDistance').value=explodeGap;$('explodeVal').textContent=explodeGap;$('layerPreview').value=outerPreview;updateToggles();rebuildModel();updateAll()}
function remember(){undoStack.push(snapshot());if(undoStack.length>35)undoStack.shift();redoStack=[];updateUndoButtons()}
function doUndo(){if(!undoStack.length)return;redoStack.push(snapshot());restore(undoStack.pop());notify('Acción deshecha')}
function doRedo(){if(!redoStack.length)return;undoStack.push(snapshot());restore(redoStack.pop());notify('Acción recuperada')}
function updateUndoButtons(){$('undo').disabled=!undoStack.length;$('redo').disabled=!redoStack.length}
function layerPixel(l,n){let p=n*4;return [l.data[p],l.data[p+1],l.data[p+2],l.data[p+3]]}
function composite(){faceTextureCache.clear();composed.fill(0);for(const l of layers){if(!l.visible)continue;for(let i=0;i<PIXELS;i++){let n=i*4,sa=l.data[n+3]/255*l.opacity;if(sa<=0)continue;let da=composed[n+3]/255,oa=sa+da*(1-sa);for(let j=0;j<3;j++)composed[n+j]=Math.round((l.data[n+j]*sa+composed[n+j]*da*(1-sa))/oa);composed[n+3]=Math.round(oa*255)}}canvasImage.data.set(composed);sceneCtx.putImageData(canvasImage,0,0);if(gpu){gl.bindTexture(gl.TEXTURE_2D,gpu.texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,64,64,0,gl.RGBA,gl.UNSIGNED_BYTE,composed)}render2D();scheduleRender()}
function updateAll(noAutosave=false){composite();renderLayers();renderParts();updateSelectionNote();updateUndoButtons();$('targetName').textContent=layers[activeLayer]?.target==='outer'?'Exterior':'Base';updatePaintControls();$('stageIndicator').textContent=`64 × 64 · ${model==='slim'?'Slim':'Classic'}`;if(!noAutosave)queueSave()}
function queueSave(){dirty=true;clearTimeout(saveTimer);saveTimer=setTimeout(()=>saveLocal(true),1100)}
function saveData(){return {version:1,name:$('projectName').value||'Mi skin',model,outerShown,outerPreview,exploded,explodeGap,viewLight,layers:layers.map(l=>({...l,data:btoa(String.fromCharCode(...l.data))})),activeLayer,visibleParts}}
function savedIndex(){try{let a=JSON.parse(localStorage.getItem(LIBRARY)||'[]');return Array.isArray(a)?a.filter(v=>v&&typeof v.id==='string').slice(0,20):[]}catch(e){return []}}
function renderSavedProjects(){const select=$('savedProjects');if(!select)return;const index=savedIndex();select.replaceChildren(new Option('— Mis proyectos guardados —',''));for(const entry of index){const option=new Option(`${entry.name} · ${new Date(entry.time).toLocaleDateString('es-CL')}`,entry.id);select.append(option)}select.value=index.some(e=>e.id===savedProjectId)?savedProjectId:''}
function saveInLibrary(copy=false){try{let index=savedIndex(),id=!copy&&savedProjectId&&index.some(e=>e.id===savedProjectId)?savedProjectId:null;if(!id&&index.length>=12)return notify('Máximo de 12 proyectos locales. Elimina uno o exporta .fxskin');if(!id)id=Date.now().toString(36)+Math.random().toString(36).slice(2,8);const name=$('projectName').value.trim()||'Mi skin';localStorage.setItem(LIBRARY+':'+id,JSON.stringify(saveData()));index=index.filter(e=>e.id!==id);index.unshift({id,name,time:Date.now()});localStorage.setItem(LIBRARY,JSON.stringify(index));savedProjectId=id;renderSavedProjects();notify(copy?'Copia independiente guardada':'Proyecto guardado en Mis proyectos')}catch(e){notify('Sin espacio para más proyectos. Exporta un .fxskin para conservarlo')}}
function openSavedProject(){const id=$('savedProjects').value;if(!id)return notify('Elige un proyecto guardado');if(!confirm('¿Abrir este proyecto y sustituir la skin actual?'))return;try{const raw=localStorage.getItem(LIBRARY+':'+id);if(!raw)throw Error();loadData(JSON.parse(raw));savedProjectId=id;renderSavedProjects();queueSave();notify('Proyecto abierto desde Mis proyectos')}catch(e){notify('No se pudo recuperar ese proyecto')}}
function deleteSavedProject(){const id=$('savedProjects').value;if(!id)return notify('Elige un proyecto guardado');if(!confirm('¿Eliminar este proyecto de Mis proyectos?'))return;try{localStorage.removeItem(LIBRARY+':'+id);localStorage.setItem(LIBRARY,JSON.stringify(savedIndex().filter(e=>e.id!==id)));if(savedProjectId===id)savedProjectId=null;renderSavedProjects();notify('Proyecto borrado de la biblioteca; la skin abierta sigue intacta')}catch(e){notify('No se pudo eliminar ese proyecto')}}
function saveLocal(quiet=false){try{localStorage.setItem(STORE,JSON.stringify(saveData()));dirty=false;$('autosaveStatus').textContent='Guardado local actualizado';if(!quiet)notify('Proyecto guardado en este navegador')}catch(e){$('autosaveStatus').textContent='El guardado local no está disponible';if(!quiet)notify('No se pudo guardar; descarga el proyecto')}}
function loadData(doc){savedProjectId=null;if(!doc||doc.version!==1||!Array.isArray(doc.layers)||!doc.layers.length||doc.layers.length>30)throw Error('Archivo de proyecto no válido');const result=doc.layers.map(l=>{const raw=atob(l.data);if(raw.length!==PIXELS*4)throw Error('Capa incompatible');const data=Uint8ClampedArray.from(raw,c=>c.charCodeAt(0));return {...newLayer(String(l.name).slice(0,64),l.target==='outer'?'outer':'base',data),visible:l.visible!==false,locked:!!l.locked,opacity:Math.max(0,Math.min(1,+l.opacity||0))}});layers=result;activeLayer=Math.min(doc.activeLayer||0,layers.length-1);model=doc.model==='slim'?'slim':'classic';$('modelType').value=model;$('projectName').value=String(doc.name||'Mi skin').slice(0,80);outerShown=doc.outerShown!==false;outerPreview=['both','base','outer','ghost'].includes(doc.outerPreview)?doc.outerPreview:'both';$('layerPreview').value=outerPreview;exploded=!!doc.exploded;explodeGap=+doc.explodeGap||5;viewLight=+doc.viewLight||1;visibleParts=Array.isArray(doc.visibleParts)&&doc.visibleParts.length===6?doc.visibleParts.map(Boolean):Array(6).fill(true);selection=null;undoStack=[];redoStack=[];$('explodeDistance').value=explodeGap;$('viewBrightness').value=Math.round(viewLight*100);$('brightnessVal').textContent=`${Math.round(viewLight*100)}%`;updateToggles();rebuildModel();updateAll(true)}
function download(blob,name){let url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2500)}
function fileSafe(){return ($('projectName').value||'skin').replace(/[^\wáéíóúñ -]+/gi,'').trim().replace(/ +/g,'_')||'skin'}
function exportPNG(){composite();sceneTextureCanvas.toBlob(blob=>{if(blob)download(blob,fileSafe()+'.png');notify('PNG 64×64 exportado')},'image/png')}
function projectExport(){download(new Blob([JSON.stringify(saveData())],{type:'application/json'}),fileSafe()+'.fxskin');notify('Proyecto editable exportado')}
function getPixel(x,y,source=composed){let n=(y*64+x)*4;return source.slice(n,n+4)}
// A colour picker samples the actual unlit skin colour, not rendered brightness,
// antialiasing, selection outlines or the coordinate of the editable target.
// The two source modes are deliberately independent of the currently painted layer.
function sampleCompositeTexel(hit){return hit?Array.from(getPixel(hit.x,hit.y)):null}
function sampleActiveTexel(hit){return hit?Array.from(getPixel(hit.x,hit.y,layers[activeLayer].data)):null}
function sampleVisible2D(hit){
 if(!hit||(hit.face.target==='outer'&&!outerShown))return null;
 const rgba=sampleCompositeTexel(hit);return rgba&&rgba[3]>0?rgba:null;
}
function pickColor2D(event){
 const box=atlas.getBoundingClientRect();
 const x=Math.floor((event.clientX-box.left)*64/box.width);
 const y=Math.floor((event.clientY-box.top)*64/box.height);
 if(!validPixel(x,y))return null;
 // The colour picker may sample the *whole* UV atlas even when editing
 // the other layer, unlike the brush which stays on its chosen target.
 const face=findFace(x,y,'base')||findFace(x,y,'outer');
 return face?{x,y,part:face.part,fi:face.fi,face}:null;
}
function sampleVisible3D(clientX,clientY){
 // Ray-cast independently against the base and the slightly expanded exterior.
 // Never sample the exterior where its texel is transparent (or globally hidden).
 const base=pickFromClient(clientX,clientY,'base');
 const outside=outerShown?pickFromClient(clientX,clientY,'outer'):null;
 const bp=base?sampleCompositeTexel(base):null,op=outside?sampleCompositeTexel(outside):null;
 const baseOk=bp&&bp[3]>0,outerOk=op&&op[3]>0;
 if(!baseOk&&!outerOk)return null;
 // The distances use the same coordinate space per renderer (NDC or ray units).
 // An opaque base part in front of another part's exterior must stay in front.
 const useOuter=outerOk&&(!baseOk||outside.depth<=base.depth+0.00001);
 if(!useOuter)return {...base,color:bp};
 // Apply the exterior over the corresponding base face (UV regions differ),
 // including partially transparent overlay texels and opacity of work layers.
 const face=outside.face,outerX=outside.x-face.x,outerY=outside.y-face.y;
 const baseFace=rectsFor(partState(outside.part),false)[outside.fi];
 const baseX=baseFace.x+Math.min(baseFace.w-1,Math.floor(outerX*baseFace.w/face.w));
 const baseY=baseFace.y+Math.min(baseFace.h-1,Math.floor(outerY*baseFace.h/face.h));
 let under=Array.from(getPixel(baseX,baseY));
 // The directly hit base pixel is the best sample when both targets match.
 if(base&&base.part===outside.part&&base.fi===outside.fi)under=bp;
 return {...outside,color:compositeOver(under,op)};
}
function eyedropAt(event){
 const active=layers[activeLayer];
 if(!active)return null;
 if(view==='2d'){
  const p=eyedropSource==='layer'?pick2D(event):pickColor2D(event);if(!p)return null;
  const rgba=eyedropSource==='layer'?sampleActiveTexel(p):sampleVisible2D(p);
  return {...p,color:rgba&&rgba[3]>0?rgba:null};
 }
 if(eyedropSource==='visible')return sampleVisible3D(event.clientX,event.clientY);
 const p=pickFromClient(event.clientX,event.clientY,active.target);
 if(!p)return null;
 const rgba=sampleActiveTexel(p);return {...p,color:rgba&&rgba[3]>0?rgba:null};
}
function applySample(event){
 const sample=eyedropAt(event);
 if(!sample||!sample.color){
  notify(eyedropSource==='layer'?'Esta capa no tiene color en ese píxel. Prueba «Color visible».':'Píxel transparente: no hay color para copiar.');
  return false;
 }
 fg=hexOf(sample.color);
 $('foreground').value=fg;syncColorSwatches();
 recentColor(fg);
 if($('pickedColor')){$('pickedColor').style.backgroundColor=fg;$('pickedHex').textContent=fg.toUpperCase();}
 hover=sample;lastFace=sample.face;
 $('pixelInfo').textContent=`${sample.x}, ${sample.y} · ${PART_NAMES[sample.part]} · ${sample.face.face}`;
 if(view==='3d')drawCursor();else drawHover2D(sample);
 notify(`Color copiado: ${fg.toUpperCase()} · ${eyedropSource==='layer'?'capa actual':'color visible'}`);
 return true;
}
function similar(a,b){return Math.max(...a.map((x,i)=>Math.abs(x-b[i])))<=tolerance*2.55}
function compositeOver(dst,src){let sa=src[3]/255,da=dst[3]/255,oa=sa+da*(1-sa);if(!oa)return [0,0,0,0];return [...[0,1,2].map(i=>Math.round((src[i]*sa+dst[i]*da*(1-sa))/oa)),Math.round(oa*255)]}
function patternColor(x,y){const ax=Math.floor(x/patternScale),ay=Math.floor(y/patternScale);let alt=pattern==='checker'?(ax+ay)%2:pattern==='stripes'?ay%2:pattern==='diagonal'?((ax+ay)%4)<2:pattern==='fabric'?((x%4===0&&y%4===0)||((x+y)%7===0)):false;return alt?bg:fg}
function gradientColors(t){const start=rgba(bg),end=rgba(fg);if(!gradientMiddle)return start.map((v,i)=>Math.round(v*(1-t)+end[i]*t));const m=rgba(gradientMid),mid=gradientMiddlePos,values=t<=mid?[start,m,t/Math.max(.0001,mid)]:[m,end,(t-mid)/Math.max(.0001,1-mid)];return values[0].map((v,i)=>Math.round(v*(1-values[2])+values[1][i]*values[2]))}
function paintAt(x,y,color=null,force=false,operation=tool,face=null){x=Math.round(x);y=Math.round(y);if(!color)color=rgba(patternColor(x,y),Math.round(opacity*255));if(!validPixel(x,y)||!layers[activeLayer]||layers[activeLayer].locked||!layers[activeLayer].visible)return;const f=face||findFace(x,y);if(!f||face&&!faceFilter(x,y,face))return;if(selection&&!selection[y*64+x])return;
 if(drag?.strokePixels&&['brush','erase','lighten','darken'].includes(operation)){const key=y*64+x;if(drag.strokePixels.has(key))return;drag.strokePixels.add(key)}const layer=layers[activeLayer];let i=(y*64+x)*4,old=Array.from(layer.data.slice(i,i+4));if(operation==='erase')layer.data.fill(0,i,i+4);else if(operation==='lighten'||operation==='darken'){if(old[3]===0){const beneath=Array.from(composed.slice(i,i+4));if(beneath[3]===0)return;old=beneath}let sign=operation==='lighten'?1:-1;const v=Math.max(1,Math.round(strength*70));layer.data.set([Math.max(0,Math.min(255,old[0]+sign*v)),Math.max(0,Math.min(255,old[1]+sign*v)),Math.max(0,Math.min(255,old[2]+sign*v)),old[3]||255],i)}else layer.data.set(compositeOver(old,color),i)}
function mirroredTexel(x,y,face){if(!face)return null;const other=[0,1,3,2,5,4][face.part],fi=face.fi===2?3:face.fi===3?2:face.fi;const rect=rectsFor(partState(other),layers[activeLayer].target==='outer')[fi];const rx=x-face.x,ry=y-face.y;if(rx<0||rx>=face.w||ry<0||ry>=face.h)return null;const px=(fi===2||fi===3)?rx:face.w-1-rx;return {x:rect.x+Math.min(rect.w-1,px),y:rect.y+ry,face:{...rect,part:other,fi,target:layers[activeLayer].target}}}
function paintBrush(x,y,operation=tool,face=null){let r=brushSize;for(let dy=0;dy<r;dy++)for(let dx=0;dx<r;dx++){const px=x+dx-Math.floor((r-1)/2),py=y+dy-Math.floor((r-1)/2);paintAt(px,py,undefined,false,operation,face);if(symmetry){const origin=face||findFace(px,py),m=mirroredTexel(px,py,origin);if(m&&(m.x!==px||m.y!==py))paintAt(m.x,m.y,undefined,false,operation,m.face)}}}
function rasterLine(a,b,cb){let x=a.x,y=a.y,x1=b.x,y1=b.y,dx=Math.abs(x1-x),dy=Math.abs(y1-y),sx=x<x1?1:-1,sy=y<y1?1:-1,err=dx-dy;for(let n=0;n<140;n++){cb(x,y);if(x===x1&&y===y1)break;let e=err*2;if(e>-dy){err-=dy;x+=sx}if(e<dx){err+=dx;y+=sy}}}
function rectLoop(a,b,cb,filled){let x0=Math.min(a.x,b.x),x1=Math.max(a.x,b.x),y0=Math.min(a.y,b.y),y1=Math.max(a.y,b.y);for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if(filled||x===x0||x===x1||y===y0||y===y1)cb(x,y)}
function ellipseLoop(a,b,cb,filled){let x0=Math.min(a.x,b.x),x1=Math.max(a.x,b.x),y0=Math.min(a.y,b.y),y1=Math.max(a.y,b.y),cx=(x0+x1)/2,cy=(y0+y1)/2,rx=Math.max(.5,(x1-x0+1)/2),ry=Math.max(.5,(y1-y0+1)/2);for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){let v=((x-cx)/rx)**2+((y-cy)/ry)**2;if(v<=1.15&&(filled||v>=.55))cb(x,y)}}
function faceFilter(x,y,face){if(!face)return true;return x>=face.x&&x<face.x+face.w&&y>=face.y&&y<face.y+face.h}
function faceDomain(face){const mask=new Uint8Array(PIXELS);if(face)for(let y=face.y;y<face.y+face.h;y++)for(let x=face.x;x<face.x+face.w;x++)mask[y*64+x]=1;return mask}
function getDomain(face){return selection?new Uint8Array(selection):faceDomain(face)}
function bucketAt(p,mode='bucket'){const layer=layers[activeLayer];let domain=getDomain(p.face),ref=Array.from(layer.data.slice((p.y*64+p.x)*4,(p.y*64+p.x)*4+4));if(mode==='replace'){for(let y=0;y<64;y++)for(let x=0;x<64;x++){let idx=y*64+x;if(domain[idx]&&similar(Array.from(layer.data.slice(idx*4,idx*4+4)),ref))paintAt(x,y,null,false,'brush')}return}let seen=new Uint8Array(PIXELS),stack=[p.y*64+p.x],done=0;while(stack.length){let idx=stack.pop();if(idx<0||idx>=PIXELS||seen[idx]||!domain[idx])continue;seen[idx]=1;let here=Array.from(layer.data.slice(idx*4,idx*4+4));if(!similar(here,ref))continue;let x=idx%64,y=(idx/64)|0;paintAt(x,y,rgba(fg,Math.round(opacity*255)),false,'brush');done++;if(x>0)stack.push(idx-1);if(x<63)stack.push(idx+1);if(y>0)stack.push(idx-64);if(y<63)stack.push(idx+64);if(done>PIXELS)break}}
function gradientScreenAt(a,b){if(!selection)return;const dx=b[0]-a[0],dy=b[1]-a[1],mag=Math.max(1,dx*dx+dy*dy),len=Math.max(1,Math.hypot(dx,dy)),cm=cameraMatrix(),bounds=glCanvas.getBoundingClientRect(),from=rgba(bg),to=rgba(fg);
 const startHit=pickFromClient(a[0],a[1]),endHit=pickFromClient(b[0],b[1]);
 const centerWorld=startHit?hitWorld(startHit):null,endWorld=endHit?hitWorld(endHit):null;
 const worldRadius=centerWorld&&endWorld?Math.max(.01,Math.hypot(...centerWorld.map((v,k)=>v-endWorld[k]))):null;
 let changed=0;
 for(let i=0;i<6;i++){let box=partState(i),faces=softwareCorners(box,layers[activeLayer].target==='outer'),rects=rectsFor(box,layers[activeLayer].target==='outer');for(let fi=0;fi<6;fi++){let r=rects[fi],corners=faces[fi];for(let yy=0;yy<r.h;yy++)for(let xx=0;xx<r.w;xx++){let x=r.x+xx,y=r.y+yy;if(!selection[y*64+x])continue;
 const proj=projectVertex(lerpVertex(corners,(xx+.5)/r.w,(yy+.5)/r.h),cm);if(!proj)continue;const px=bounds.left+proj.x*bounds.width/glCanvas.width,py=bounds.top+proj.y*bounds.height/glCanvas.height;
 const amount=gradMode==='radial'&&centerWorld&&worldRadius?Math.hypot(...lerpVertex(corners,(xx+.5)/r.w,(yy+.5)/r.h).map((v,k)=>v-centerWorld[k]))/worldRadius:gradMode==='radial'?Math.hypot(px-a[0],py-a[1])/len:((px-a[0])*dx+(py-a[1])*dy)/mag;let t=Math.max(0,Math.min(1,amount));if(gradMode==='dither'){const bayer=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5][(y%4)*4+x%4]/16;t=t>=bayer?1:0}const colour=gradientColors(t);colour[3]=gradMode==='transparent'?Math.round(255*(1-t)*opacity):Math.round(255*opacity);if(gradMode==='transparent'){colour[0]=to[0];colour[1]=to[1];colour[2]=to[2];layers[activeLayer].data.set(colour,(y*64+x)*4)}else paintAt(x,y,colour,false,'brush');changed++;
 }}}
 return changed;
}
function gradientAt(a,b,face){const domain=getDomain(face),dx=b.x-a.x,dy=b.y-a.y,mag=Math.max(1,dx*dx+dy*dy);let from=rgba(bg),to=rgba(fg),len=Math.max(1,Math.hypot(dx,dy));for(let y=0;y<64;y++)for(let x=0;x<64;x++){if(!domain[y*64+x])continue;if(gradMode==='radial'&&!selection&&Math.hypot(x-a.x,y-a.y)>len)continue;let t=gradMode==='radial'?Math.hypot(x-a.x,y-a.y)/len:((x-a.x)*dx+(y-a.y)*dy)/mag;t=Math.max(0,Math.min(1,t));if(gradMode==='dither'){let dither=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5][(y%4)*4+(x%4)]/16;t=t>=dither?1:0}let out=gradientColors(t);out[3]=gradMode==='transparent'?Math.round(255*(1-t)*opacity):Math.round(opacity*255);if(gradMode==='transparent'){out[0]=to[0];out[1]=to[1];out[2]=to[2];if(face&&!faceFilter(x,y,face))continue;layers[activeLayer].data.set(out,(y*64+x)*4)}else paintAt(x,y,out,false,'brush',selection?null:face)}}
// Screen-space selection traverses any visible face, even across seams and body parts.
function insidePolygon2D(x,y,points){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside}return inside}
function selectScreen(points,lasso=false,add=false,subtract=false,restrictedPart=null){
 if(!points.length)return;remember();const mask=selection&& (add||subtract)?new Uint8Array(selection):new Uint8Array(PIXELS),b=glCanvas.getBoundingClientRect();
 const xs=points.map(t=>t[0]),ys=points.map(t=>t[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 // In a screen rectangle selection is based on projected texel centers.
 const camera=cameraMatrix();for(let i=0;i<6;i++){if(!visibleParts[i]||(restrictedPart!==null&&restrictedPart!==i))continue;let box=partState(i),faces=softwareCorners(box,layers[activeLayer].target==='outer'),rects=rectsFor(box,layers[activeLayer].target==='outer');
 for(let fi=0;fi<6;fi++){let r=rects[fi],corners=faces[fi];for(let y=0;y<r.h;y++)for(let x=0;x<r.w;x++){
  const world=lerpVertex(corners,(x+.5)/r.w,(y+.5)/r.h),point=projectVertex(world,camera);if(!point)continue;
  let cx=b.left+point.x*b.width/glCanvas.width,cy=b.top+point.y*b.height/glCanvas.height;
  if(cx<minX||cx>maxX||cy<minY||cy>maxY||lasso&&!insidePolygon2D(cx,cy,points))continue;
  const hit=pickFromClient(cx,cy);if(!hit||hit.part!==i||hit.fi!==fi)continue;
  mask[(r.y+y)*64+r.x+x]=subtract?0:1;
 }}}
 selection=mask;updateSelectionNote();render2D();queueSave();
}
function copyActiveSelection(){if(!selection)return notify('Primero selecciona un área');const indexes=[];for(let y=0;y<64;y++)for(let x=0;x<64;x++)if(selection[y*64+x])indexes.push({x,y,pixel:Array.from(layers[activeLayer].data.slice((y*64+x)*4,(y*64+x)*4+4))});if(!indexes.length)return notify('La selección está vacía');let x0=Math.min(...indexes.map(v=>v.x)),y0=Math.min(...indexes.map(v=>v.y)),x1=Math.max(...indexes.map(v=>v.x)),y1=Math.max(...indexes.map(v=>v.y));clipboard={width:x1-x0+1,height:y1-y0+1,pixels:indexes.map(v=>({...v,x:v.x-x0,y:v.y-y0}))};stampFlipX=stampFlipY=false;stampRotation=0;remember();selection=null;updateSelectionNote();render2D();notify(`Copiados ${indexes.length} píxeles. Marca el área de destino (opcional) y pulsa Pegar en…`)}
function stampPixelPosition(v){let x=stampFlipX?clipboard.width-1-v.x:v.x,y=stampFlipY?clipboard.height-1-v.y:v.y,width=clipboard.width,height=clipboard.height;for(let n=0;n<stampRotation;n++){const t=x;x=height-1-y;y=t;[width,height]=[height,width]}return [x,y]}
function forStampPixels(p,fn){if(!clipboard||!p||!p.face)return;for(const v of clipboard.pixels){const [dx,dy]=stampPixelPosition(v),px=p.x+dx,py=p.y+dy;if(!validPixel(px,py)||!faceFilter(px,py,p.face)||selection&&!selection[py*64+px]||v.pixel[3]===0)continue;fn(px,py,v.pixel)}}
function stampAt(p){if(!clipboard)return;const dims=stampRotation%2?[clipboard.height,clipboard.width]:[clipboard.width,clipboard.height];let changes=0;remember();const layer=layers[activeLayer],face=p.face;
 forStampPixels(p,(px,py,pixel)=>{layer.data.set(pixel,(py*64+px)*4);changes++});afterChange();notify(`${changes} píxeles pegados (${dims[0]}×${dims[1]})`)}

 function duplicateToOppositeArm(){
  if(!selection||!selection.some(Boolean))return notify('Primero selecciona el diseño de un brazo');
  const target=layers[activeLayer].target,l=layers[activeLayer];
  const map=new Map();
  for(let y=0;y<64;y++)for(let x=0;x<64;x++)if(selection[y*64+x]){
   const face=findFace(x,y,target);if(!face||face.part!==2&&face.part!==3)continue;
   const flipped=mirroredTexel(x,y,face);if(!flipped)continue;
   const colour=Array.from(l.data.slice((y*64+x)*4,(y*64+x)*4+4));if(colour[3]===0)continue;
   map.set(flipped.y*64+flipped.x,colour);
  }
  if(!map.size)return notify('La selección no contiene píxeles pintados de brazos');
  if(!confirm(`¿Duplicar ${map.size} píxeles al brazo opuesto?`))return;
  remember();for(const [idx,c] of map)l.data.set(c,idx*4);
  afterChange();notify(`Duplicados ${map.size} píxeles al brazo opuesto`);
 }
function updatePasteInfo(){const label=$('pasteTransformStatus');if(label)label.textContent=clipboard?`Diseño ${clipboard.width}×${clipboard.height} · giro ${stampRotation*90}°${stampFlipX?' · reflejo H':''}${stampFlipY?' · reflejo V':''}`:'Primero copia una selección'}
function selectionFromRect(a,b,add=false,subtract=false,mode='2d',restrictedPart=null){const m=add&&selection?new Uint8Array(selection):new Uint8Array(PIXELS);let x0=Math.min(a.x,b.x),x1=Math.max(a.x,b.x),y0=Math.min(a.y,b.y),y1=Math.max(a.y,b.y);for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if(validPixel(x,y)&&findFace(x,y)&&(restrictedPart===null||findFace(x,y).part===restrictedPart)&&( !a.face||mode==='2d'||faceFilter(x,y,a.face)))m[y*64+x]=subtract?0:1;selection=m;updateSelectionNote()}
function selectionLasso(points,add=false,subtract=false,mode='2d',restrictedPart=null){if(points.length<3)return;const m=add&&selection?new Uint8Array(selection):new Uint8Array(PIXELS);let xmin=Math.max(0,Math.min(...points.map(p=>p.x))),xmax=Math.min(63,Math.max(...points.map(p=>p.x))),ymin=Math.max(0,Math.min(...points.map(p=>p.y))),ymax=Math.min(63,Math.max(...points.map(p=>p.y)));for(let y=ymin;y<=ymax;y++)for(let x=xmin;x<=xmax;x++){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){let a=points[i],b=points[j];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside}if(inside&&findFace(x,y)&&(restrictedPart===null||findFace(x,y).part===restrictedPart)&&(!points[0].face||mode==='2d'||faceFilter(x,y,points[0].face)))m[y*64+x]=subtract?0:1}selection=m;updateSelectionNote()}
function selectWholePart(part){
 if(!Number.isInteger(part)||part<0||part>=PART_NAMES.length)return false;
 remember();const mask=new Uint8Array(PIXELS),target=layers[activeLayer].target;
 for(const r of rectsFor(partState(part),target==='outer'))
  for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++)mask[y*64+x]=1;
 selection=mask;
 // Remember an actual face of this body part, not the last hover position.
 lastFace={...rectsFor(partState(part),target==='outer')[0],part,fi:0,target};
 updateSelectionNote();render2D();queueSave();
 notify('Seleccionadas todas las caras de '+PART_NAMES[part]);return true;
}
function updateSelectionNote(){let n=selection?selection.reduce((a,b)=>a+b,0):0;$('selectNote').textContent=n?`${n} píxeles seleccionados. Los efectos quedan limitados a esta área.`:'Sin selección. Puedes pintar sobre cualquier cara visible.';updateSelectionTexture()}
function drawSelection2D(){if(!selection)return;const ctx=atlasCtx,s=atlas.width/64;ctx.fillStyle='rgba(75,197,255,.24)';for(let i=0;i<PIXELS;i++)if(selection[i])ctx.fillRect((i%64)*s,Math.floor(i/64)*s,s,s);ctx.strokeStyle='#8ce6ff';ctx.lineWidth=1.5;for(let i=0;i<PIXELS;i++)if(selection[i]){const x=i%64,y=Math.floor(i/64);if(x===0||!selection[i-1]){ctx.beginPath();ctx.moveTo(x*s,y*s);ctx.lineTo(x*s,(y+1)*s);ctx.stroke()}if(x===63||!selection[i+1]){ctx.beginPath();ctx.moveTo((x+1)*s,y*s);ctx.lineTo((x+1)*s,(y+1)*s);ctx.stroke()}if(y===0||!selection[i-64]){ctx.beginPath();ctx.moveTo(x*s,y*s);ctx.lineTo((x+1)*s,y*s);ctx.stroke()}if(y===63||!selection[i+64]){ctx.beginPath();ctx.moveTo(x*s,(y+1)*s);ctx.lineTo((x+1)*s,(y+1)*s);ctx.stroke()}}}
function render2D(){atlasCtx.clearRect(0,0,atlas.width,atlas.height);atlasCtx.imageSmoothingEnabled=false;atlasCtx.drawImage(sceneTextureCanvas,0,0,atlas.width,atlas.height);const s=atlas.width/64;if(!outerShown||outerPreview==='base'){for(const r of allRects('outer'))atlasCtx.clearRect(r.x*s,r.y*s,r.w*s,r.h*s);}if(outerPreview==='outer'){for(const r of allRects('base'))atlasCtx.clearRect(r.x*s,r.y*s,r.w*s,r.h*s);}atlasCtx.strokeStyle='rgba(255,255,255,.18)';atlasCtx.lineWidth=2;for(const f of allRects(layers[activeLayer]?.target||'base'))atlasCtx.strokeRect(f.x*s+.5,f.y*s+.5,f.w*s-.5,f.h*s-.5);if(grid){atlasCtx.lineWidth=1;atlasCtx.strokeStyle='rgba(168,200,233,.17)';for(let i=0;i<=64;i++){atlasCtx.beginPath();atlasCtx.moveTo(i*s,0);atlasCtx.lineTo(i*s,atlas.height);atlasCtx.moveTo(0,i*s);atlasCtx.lineTo(atlas.width,i*s);atlasCtx.stroke()}}drawSelection2D();if(drag&&(drag.kind==='select'||drag.kind==='lasso')&&drag.mode==='2d'){
 const points=(drag.kind==='select'?[drag.start,{x:drag.last.x,y:drag.start.y},drag.last,{x:drag.start.x,y:drag.last.y}]:drag.points);
 if(points.length>1){atlasCtx.save();atlasCtx.beginPath();atlasCtx.moveTo(points[0].x*s,points[0].y*s);for(const v of points.slice(1))atlasCtx.lineTo(v.x*s,v.y*s);if(drag.kind==='select')atlasCtx.closePath();atlasCtx.setLineDash([6,4]);atlasCtx.strokeStyle='#89e5ff';atlasCtx.fillStyle='rgba(58,181,241,.12)';atlasCtx.lineWidth=3;atlasCtx.stroke();if(drag.kind==='select')atlasCtx.fill();atlasCtx.restore()}}
 }

function updateTool(t){tool=t;document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));$('toolName').textContent=TOOL_NAMES[tool];$('eyedropOptions').hidden=tool!=='eyedrop';$('stageHint').textContent=(tool==='select'||tool==='lasso'?'Selección: arrastra un área; Ctrl + clic selecciona toda la pieza. Shift + arrastre suma; Ctrl + arrastre resta.':tool==='gradient'?'Arrastra para definir la dirección. Usa una selección para limitar el degradado.':tool==='eyedrop'?'Haz clic en un píxel para copiar su color sin modificar la skin.':tool==='stamp'?'Haz clic en el destino para pegar el diseño copiado (girar/reflejar en el panel).' :'Pinta sobre los píxeles resaltados · Clic derecho para girar · Rueda para zoom');}
function notify(s){const n=$('notice');n.textContent=s;n.classList.add('show');clearTimeout(notify.t);notify.t=setTimeout(()=>n.classList.remove('show'),3000);$('statusText').textContent=s}
function renderLayers(){const box=$('layers');box.innerHTML='';layers.forEach((l,i)=>{const el=document.createElement('div');el.className='layer'+(i===activeLayer?' selected':'');let eye=document.createElement('button');eye.textContent=l.visible?'◉':'◌';eye.title='Mostrar/ocultar capa';eye.onclick=()=>{remember();l.visible=!l.visible;updateAll()};let title=document.createElement('span');title.className='layer-name';title.textContent=l.name;title.title='Doble clic para renombrar';title.onclick=()=>{activeLayer=i;lastFace=null;if(l.target==='outer'&&!outerShown){outerShown=true;updateToggles()}updateAll(true)};title.ondblclick=()=>{let name=prompt('Nombre de capa',l.name);if(name&&name.trim()){l.name=name.trim().slice(0,64);updateAll()}};let type=document.createElement('small');type.textContent=l.target==='outer'?'Ext.':'Base';let slider=document.createElement('input');slider.type='range';slider.min='0';slider.max='100';slider.title='Opacidad de capa';slider.value=Math.round(l.opacity*100);slider.onpointerdown=()=>remember();slider.oninput=()=>{l.opacity=slider.value/100;composite();queueSave()};let lock=document.createElement('button');lock.textContent=l.locked?'▣':'▢';lock.title='Bloquear/desbloquear';lock.className=l.locked?'locked':'';lock.onclick=()=>{remember();l.locked=!l.locked;renderLayers();queueSave()};el.append(eye,title,type,slider,lock);el.onclick=e=>{if(e.target.closest('button,input,.layer-name'))return;activeLayer=i;lastFace=null;if(l.target==='outer'&&!outerShown){outerShown=true;updateToggles()}updateAll(true)};box.append(el)});$('targetName').textContent=layers[activeLayer].target==='outer'?'Exterior':'Base'}
function renderParts(){const box=$('partButtons');box.innerHTML='';PART_NAMES.forEach((n,i)=>{const b=document.createElement('button');b.textContent=(visibleParts[i]?'◉ ':'◌ ')+n;b.className=visibleParts[i]?'':'off';b.onclick=()=>{remember();visibleParts[i]=!visibleParts[i];scheduleRender();renderParts();queueSave()};box.append(b)})}
function countExteriorPixels(){let count=0;for(const l of layers)if(l.target==='outer'&&l.visible)for(let i=3;i<l.data.length;i+=4)if(l.data[i]>0){count++;}return count}
function setPaintTarget(target){
 let index=layers.findIndex(l=>l.target===target&&l.visible&&!l.locked);
 if(index<0)index=layers.findIndex(l=>l.target===target);
 if(index<0){remember();layers.push(newLayer(target==='outer'?'Detalles exteriores':'Skin base',target));index=layers.length-1}
 activeLayer=index;
 if(target==='outer'&&!outerShown)outerShown=true;
 lastFace=null;hover=null; // Keep any active area selection when switching paint layer.
 updateToggles();updateAll();drawCursor();
 notify(target==='outer'?'Pintando sobre la segunda capa (ropa y accesorios)':'Pintando sobre la capa base');
}
function updatePaintControls(){
 const target=layers[activeLayer]?.target||'base';
 for(const [id,mode] of [['paintBase','base'],['paintOuter','outer']]){
  const b=$(id);if(!b)continue;b.setAttribute('aria-pressed',String(target===mode));
 }
 const hint=$('paintModeHint');
 if(hint)hint.textContent=target==='outer'?'Editando capa exterior · Elige la zona en 3D o 2D':'Editando capa base · Pulsa «Pintar exterior» para chaquetas y mangas';
}
function updateToggles(){
 $('outerToggle').setAttribute('aria-pressed',String(outerShown));
 $('outerToggle').textContent=(outerShown?'◉ Exterior visible':'◌ Exterior oculto');
 $('outerToggle').title='Solo mostrar u ocultar toda la capa exterior. No cambia dónde pintas.';
 $('explode').setAttribute('aria-pressed',String(exploded));
 $('explode').textContent=(exploded?'⤡ Unir partes':'⤢ Separar partes');
 updatePaintControls();
}

// CPU canvas fallback for systems that disable WebGL. Keeps all painting and picking functional.
function initSoftware(){software={ctx:glCanvas.getContext('2d',{alpha:false}),pick:document.createElement('canvas')};software.pickCtx=software.pick.getContext('2d',{willReadFrequently:true});resizeGL();notify('Vista 3D con renderizado compatible activada')}
function softwareCorners(box,outer){let [cx,cy,cz]=box.pos,dist=exploded?explodeGap:0;if(exploded){if(box.index===0)cy+=dist;if(box.index===2)cx-=dist;if(box.index===3)cx+=dist;if(box.index===4){cx-=dist*.45;cy-=dist*.65}if(box.index===5){cx+=dist*.45;cy-=dist*.65}}
let grow=outer?(box.index===0?.47:.26):0,x=box.w/2+grow,y=box.h/2+grow,z=box.d/2+grow;const P=(xx,yy,zz)=>[cx+xx,cy+yy,cz+zz];return [
[P(-x,y,z),P(x,y,z),P(x,-y,z),P(-x,-y,z)],
[P(x,y,-z),P(-x,y,-z),P(-x,-y,-z),P(x,-y,-z)],
[P(-x,y,-z),P(-x,y,z),P(-x,-y,z),P(-x,-y,-z)],
[P(x,y,z),P(x,y,-z),P(x,-y,-z),P(x,-y,z)],
[P(-x,y,-z),P(x,y,-z),P(x,y,z),P(-x,y,z)],
[P(-x,-y,z),P(x,-y,z),P(x,-y,-z),P(-x,-y,-z)] ];}
function projectVertex(p,m){let w=m[3]*p[0]+m[7]*p[1]+m[11]*p[2]+m[15];if(w<=0.001)return null;return {x:(1+(m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12])/w)*glCanvas.width/2,y:(1-(m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13])/w)*glCanvas.height/2,z:(m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14])/w}}
function lerpVertex(corners,u,v){let a=corners[0],b=corners[1],c=corners[2],d=corners[3];return [0,1,2].map(k=>a[k]*(1-u)*(1-v)+b[k]*u*(1-v)+c[k]*u*v+d[k]*(1-u)*v)}
// CPU canvas fallback. Each skin face is drawn as two textured triangles instead of
// issuing one Canvas path for every texel. The nearest-neighbour sampler keeps sharp pixels.
function affineTriangle(ctx,src,dst,texture=sceneTextureCanvas){
 const [a,b,c]=src,[A,B,C]=dst;
 const det=(b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]);
 if(Math.abs(det)<1e-7)return;
 const u=(c[1]-a[1])/det,v=-(b[1]-a[1])/det,w=-(c[0]-a[0])/det,z=(b[0]-a[0])/det;
 const X=B.x-A.x,Y=C.x-A.x,P=B.y-A.y,Q=C.y-A.y;
 const aa=X*u+Y*v,cc=X*w+Y*z,bb=P*u+Q*v,dd=P*w+Q*z;
 const ee=A.x-aa*a[0]-cc*a[1],ff=A.y-bb*a[0]-dd*a[1];
 ctx.save();ctx.beginPath();ctx.moveTo(A.x,A.y);ctx.lineTo(B.x,B.y);ctx.lineTo(C.x,C.y);ctx.closePath();ctx.clip();
 ctx.setTransform(aa,bb,cc,dd,ee,ff);ctx.imageSmoothingEnabled=false;ctx.drawImage(texture,0,0);ctx.restore();
}
function texturedQuad(ctx,points,r){
 // Isolate each skin face: sampling directly from the UV atlas can leak
 // pixels belonging to adjacent faces across anti-aliased triangle edges.
 const key=`${r.x},${r.y},${r.w},${r.h}`;
 let faceTexture=faceTextureCache.get(key);if(!faceTexture){faceTexture=document.createElement('canvas');faceTexture.width=r.w;faceTexture.height=r.h;const faceCtx=faceTexture.getContext('2d');faceCtx.imageSmoothingEnabled=false;faceCtx.drawImage(sceneTextureCanvas,r.x,r.y,r.w,r.h,0,0,r.w,r.h);faceTextureCache.set(key,faceTexture)}
 const src=[[0,0],[r.w,0],[r.w,r.h],[0,r.h]];
 affineTriangle(ctx,[src[0],src[1],src[2]],[points[0],points[1],points[2]],faceTexture);
 affineTriangle(ctx,[src[0],src[2],src[3]],[points[0],points[2],points[3]],faceTexture);
}
function rectContainsPixels(r){for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++)if(composed[(y*64+x)*4+3]>0)return true;return false}
function rectContainsSelection(r){if(!selection)return false;for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++)if(selection[y*64+x])return true;return false}
// All grid corners, painted texels and cursor outlines use exactly the same
// world-space positions. This prevents perspective seams and off-by-one lines.
function projectedFaceLattice(corners,r,m){
 const vertices=new Array((r.w+1)*(r.h+1));
 for(let y=0;y<=r.h;y++)for(let x=0;x<=r.w;x++)
  vertices[y*(r.w+1)+x]=projectVertex(lerpVertex(corners,x/r.w,y/r.h),m);
 return vertices;
}
function drawSoftwareFace(ctx,face,m,viewWidth){
 const {r,corners,target,fi}=face,points=projectedFaceLattice(corners,r,m),step=r.w+1;
 if(points.some(p=>!p))return;
 const brightness=Math.max(.25,Math.min(1.8,[1,.68,.83,.89,1.12,.59][fi]*viewLight));
 const alphaMultiplier=target==='outer'&&outerPreview==='ghost'?.3:1;
 const colors=new Map();
 for(let y=0;y<r.h;y++)for(let x=0;x<r.w;x++){
  const src=4*((r.y+y)*64+r.x+x),alpha=composed[src+3]/255*alphaMultiplier;
  if(alpha<.004)continue;
  const key=((composed[src]<<24)|(composed[src+1]<<16)|(composed[src+2]<<8)|composed[src+3])>>>0;
  let color=colors.get(key);
  if(!color){color=`rgba(${Math.min(255,Math.round(composed[src]*brightness))},${Math.min(255,Math.round(composed[src+1]*brightness))},${Math.min(255,Math.round(composed[src+2]*brightness))},${alpha})`;colors.set(key,color)}
  const tl=points[y*step+x],tr=points[y*step+x+1],br=points[(y+1)*step+x+1],bl=points[(y+1)*step+x];
  ctx.beginPath();ctx.moveTo(tl.x,tl.y);ctx.lineTo(tr.x,tr.y);ctx.lineTo(br.x,br.y);ctx.lineTo(bl.x,bl.y);ctx.closePath();ctx.fillStyle=color;ctx.fill();
 }
 // Canvas renderer parity: highlight selected texels even when outer pixels are empty.
 if(selection&&target===layers[activeLayer]?.target){
  for(let y=0;y<r.h;y++)for(let x=0;x<r.w;x++){
   if(!selection[(r.y+y)*64+r.x+x])continue;
   const tl=points[y*step+x],tr=points[y*step+x+1],br=points[(y+1)*step+x+1],bl=points[(y+1)*step+x];
   ctx.beginPath();ctx.moveTo(tl.x,tl.y);ctx.lineTo(tr.x,tr.y);ctx.lineTo(br.x,br.y);ctx.lineTo(bl.x,bl.y);ctx.closePath();
   ctx.fillStyle='rgba(62,207,255,.28)';ctx.fill();
  }
 }
 if(!grid||target!==layers[activeLayer]?.target)return;
 // Grid lines are drawn from each face's own true texel boundaries.
 // They never cross from one UV island into another.
 ctx.save();
 // Keep texel-grid strokes inside their own projected face boundary.
 ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
 ctx.lineTo(points[r.w].x,points[r.w].y);
 ctx.lineTo(points[r.h*step+r.w].x,points[r.h*step+r.w].y);
 ctx.lineTo(points[r.h*step].x,points[r.h*step].y);ctx.closePath();ctx.clip();
 ctx.beginPath();
 for(let x=0;x<=r.w;x++){
  for(let y=0;y<=r.h;y++){const pt=points[y*step+x];if(y===0)ctx.moveTo(pt.x,pt.y);else ctx.lineTo(pt.x,pt.y)}
 }
 for(let y=0;y<=r.h;y++){
  for(let x=0;x<=r.w;x++){const pt=points[y*step+x];if(x===0)ctx.moveTo(pt.x,pt.y);else ctx.lineTo(pt.x,pt.y)}
 }
 ctx.strokeStyle='rgba(17,26,40,.42)';ctx.lineWidth=Math.max(.7,Math.min(1.35,viewWidth/950));ctx.stroke();ctx.restore();
}
function drawSoftware(){if(!software)return;const ctx=software.ctx,w=glCanvas.width,h=glCanvas.height;
 ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,w,h);ctx.fillStyle='#111b2a';ctx.fillRect(0,0,w,h);
 const m=cameraMatrix(),faces=[],eye=cameraEye();
 for(const target of ['base','outer']){if(target==='outer'&&(!outerShown||outerPreview==='base')||target==='base'&&outerPreview==='outer')continue;for(let i=0;i<6;i++){
  if(!visibleParts[i])continue;const b=partState(i),quads=softwareCorners(b,target==='outer'),uvs=rectsFor(b,target==='outer');
  for(let fi=0;fi<6;fi++){const corners=quads[fi],r=uvs[fi],a=corners[0],bb=corners[1],cc=corners[2];if(target==='outer'&&!rectContainsPixels(r)&&!(grid&&layers[activeLayer]?.target==='outer')&&!(layers[activeLayer]?.target==='outer'&&rectContainsSelection(r)))continue;
   const normal=cross(bb.map((v,k)=>v-a[k]),cc.map((v,k)=>v-a[k]));
   const center=a.map((v,k)=>(v+bb[k]+cc[k]+corners[3][k])/4);
   if(dot(normal,eye.map((v,k)=>v-center[k]))>=0)continue;
   const visibleCorners=corners.map(p=>projectVertex(p,m));if(visibleCorners.some(x=>!x))continue;
   const dist=dot(center.map((v,k)=>v-eye[k]),center.map((v,k)=>v-eye[k]));
   faces.push({r,fi,corners,dist,target});
  }
 }}
 faces.sort((a,b)=>b.dist-a.dist);
 for(const f of faces)drawSoftwareFace(ctx,f,m,w);
 drawCursor();
}
function encodeRawLayerToBase64(l){return btoa(String.fromCharCode(...l.data))}
function splitImport(img,w,h){const c=document.createElement('canvas');c.width=64;c.height=64;let ctx=c.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,64,64);ctx.drawImage(img,0,0);let d=ctx.getImageData(0,0,64,64).data;
 if(h===32){const copy=new Uint8ClampedArray(d);const copyFace=(a,b,swapX=false)=>{for(let iy=0;iy<b.h;iy++)for(let ix=0;ix<b.w;ix++){let sx=a.x+(swapX?a.w-1-ix:ix),sy=a.y+iy,dx=b.x+ix,dy=b.y+iy;if(validPixel(dx,dy)&&validPixel(sx,sy))d.set(copy.slice((sy*64+sx)*4,(sy*64+sx)*4+4),(dy*64+dx)*4)}};
 for(const [sourceIndex,targetIndex] of [[4,5],[2,3]]){const src=rectsFor(partState(sourceIndex),false),dst=rectsFor(partState(targetIndex),false);const fmap=[0,1,3,2,4,5];dst.forEach((r,fi)=>copyFace(src[fmap[fi]],r,true))}}
 const bas=new Uint8ClampedArray(PIXELS*4),ext=new Uint8ClampedArray(PIXELS*4);for(const r of allRects('base'))for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++){let n=(y*64+x)*4;bas.set(d.slice(n,n+4),n)}for(const r of allRects('outer'))for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++){let n=(y*64+x)*4;ext.set(d.slice(n,n+4),n)}return [newLayer('Skin importada','base',bas),newLayer('Capa exterior','outer',ext)]}
async function importSkinByName(){
 const name=$('minecraftName').value.trim();
 if(!/^[A-Za-z0-9_]{1,16}$/.test(name))return notify('Escribe un usuario válido de Minecraft Java');
 const button=$('searchMinecraftSkin');button.disabled=true;button.textContent='Buscando…';
 try{
  const response=await fetch(`/api/skin?name=${encodeURIComponent(name)}`,{cache:'no-store'});
  if(!response.ok){if(response.status===404)throw Error('Jugador no encontrado o servidor sin API');throw Error(response.status===503?'Se necesita el servidor de importación incluido en el ZIP':`No se pudo consultar Mojang (${response.status})`)}
  const type=response.headers.get('content-type')||'';
  if(!type.includes('image/png'))throw Error('El sitio necesita habilitar el servicio /api/skin para importar por nombre');
  const modelFromServer=response.headers.get('X-Minecraft-Model')==='slim'?'slim':'classic';
  const blob=await response.blob();const img=new Image();const url=URL.createObjectURL(blob);
  try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url});
   if(img.width!==64||![32,64].includes(img.height))throw Error('La skin recibida no es 64×64 ni 64×32');
   if(!confirm(`¿Importar la skin pública de ${name} (${modelFromServer})? Se reemplazará el proyecto actual.`))return;
   remember();layers=splitImport(img,64,img.height);activeLayer=0;selection=null;undoStack=[];redoStack=[];model=modelFromServer;$('modelType').value=model;$('projectName').value=name;rebuildModel();updateToggles();updateAll();notify(`Skin de ${name} cargada desde los servicios de Mojang`);
  }finally{URL.revokeObjectURL(url)}
 }catch(e){notify(e.message||'No se pudo buscar la skin');}finally{button.disabled=false;button.textContent='Buscar skin'}
}
function importPNG(file){if(!file)return;const img=new Image();const url=URL.createObjectURL(file);img.onload=()=>{URL.revokeObjectURL(url);if(img.width!==64||![32,64].includes(img.height)){notify('El PNG debe medir 64×64 o 64×32');return}if(!confirm('¿Importar esta skin? Reemplazará el proyecto actual; puedes guardarlo antes.'))return;layers=splitImport(img,img.width,img.height);activeLayer=0;selection=null;undoStack=[];redoStack=[];$('projectName').value=file.name.replace(/\.png$/i,'');updateAll();notify(img.height===32?'Skin clásica 64×32 convertida a 64×64':'Skin importada correctamente')};img.onerror=()=>{URL.revokeObjectURL(url);notify('No se pudo abrir el PNG')};img.src=url}
// Geometry / WebGL (all rendering and picking is local).
const vertexShader=`attribute vec3 p;attribute vec2 uv;attribute float lit;attribute float piece;uniform mat4 vp;varying vec2 vUV;varying float vLight;varying float vPart;void main(){vUV=uv;vLight=lit;vPart=piece;gl_Position=vp*vec4(p,1.);}`;
// The selection must be evaluated before discarding empty outer-layer texels.
// The cyan overlay is a rendering-only guide: it never changes the skin texture.
const fragmentShader=`precision highp float;
varying vec2 vUV;
varying float vLight;
uniform sampler2D tex;
uniform sampler2D sel;
uniform float brightness;
uniform float showGrid;
uniform float layerAlpha;
void main(){
 vec4 c=texture2D(tex,vUV);
 float selected=texture2D(sel,vUV).r;
 vec2 t=fract(vUV*64.);
 vec2 edge=min(t,1.-t);
 float border=1.-step(.047,min(edge.x,edge.y));
 if(c.a<.025){
  if(selected>.5){
   // Make selected but transparent shell pixels visible while retaining the base below.
   vec3 tint=mix(vec3(.24,.81,1.),vec3(.15,.39,.51),showGrid*border*.65);
   gl_FragColor=vec4(tint,(.32+.12*showGrid*border)*layerAlpha);
   return;
  }
  if(showGrid<.5||border<.5)discard;
  gl_FragColor=vec4(.30,.37,.46,.55*layerAlpha);
  return;
 }
 c.rgb*=vLight*brightness*(1.-showGrid*border*.38);
 c.rgb=mix(c.rgb,vec3(.24,.81,1.),selected*.27);
 c.a*=layerAlpha;
 gl_FragColor=c;
}`;
const pickShader=`precision highp float;varying vec2 vUV;varying float vPart;void main(){float x=floor(clamp(vUV.x*64.,0.,63.999));float y=floor(clamp(vUV.y*64.,0.,63.999));gl_FragColor=vec4(x/255.,y/255.,vPart/255.,1.);}`;
function compileShader(type,src){let s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}
function shaderProgram(fs){let p=gl.createProgram();gl.attachShader(p,compileShader(gl.VERTEX_SHADER,vertexShader));gl.attachShader(p,compileShader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return {program:p,p:gl.getAttribLocation(p,'p'),uv:gl.getAttribLocation(p,'uv'),lit:gl.getAttribLocation(p,'lit'),piece:gl.getAttribLocation(p,'piece'),vp:gl.getUniformLocation(p,'vp'),tex:gl.getUniformLocation(p,'tex'),sel:gl.getUniformLocation(p,'sel'),brightness:gl.getUniformLocation(p,'brightness'),showGrid:gl.getUniformLocation(p,'showGrid'),layerAlpha:gl.getUniformLocation(p,'layerAlpha')}}
function initGL(){if(new URLSearchParams(location.search).get('renderer')==='cpu'){initSoftware();return}try{gl=glCanvas.getContext('webgl',{alpha:false,antialias:true,preserveDrawingBuffer:true});if(!gl){initSoftware();return}gpu={normal:shaderProgram(fragmentShader),buffer:gl.createBuffer(),texture:gl.createTexture(),selection:gl.createTexture(),groups:[]};for(const tex of [gpu.texture,gpu.selection]){gl.bindTexture(gl.TEXTURE_2D,tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE)}gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);rebuildModel();updateSelectionTexture();composite();resizeGL()}catch(e){console.warn('WebGL no disponible, se activa Canvas 2D:',e);gpu=null;gl=null;const previous=glCanvas,other=document.createElement('canvas');other.id='glCanvas';other.setAttribute('aria-label','Personaje Minecraft en 3D');previous.parentNode.replaceChild(other,previous);glCanvas=other;setupCanvasEvents(glCanvas);initSoftware();}}
function pushFace(dst,corners,rc,luminance,part){const rect=rc,uv=[[rect.x/64,rect.y/64],[(rect.x+rect.w)/64,rect.y/64],[(rect.x+rect.w)/64,(rect.y+rect.h)/64],[rect.x/64,(rect.y+rect.h)/64]];for(const j of [0,2,1,0,3,2])dst.push(...corners[j],...uv[j],luminance,part+1)}
function meshCube(dst,box,outer=false){let [cx,cy,cz]=box.pos;let ex=0,ey=0,ez=0;if(exploded){let i=box.index;if(i===0)ey=explodeGap;if(i===1)ez=0;if(i===2)ex=-explodeGap;if(i===3)ex=explodeGap;if(i===4){ex=-explodeGap*.45;ey=-explodeGap*.65}if(i===5){ex=explodeGap*.45;ey=-explodeGap*.65}}cx+=ex;cy+=ey;cz+=ez;
 let grow=outer?(box.index===0?.47:.26):0;let x=box.w/2+grow,y=box.h/2+grow,z=box.d/2+grow;
 const P=(xx,yy,zz)=>[cx+xx,cy+yy,cz+zz];
 const polys=[
  [P(-x,y,z),P(x,y,z),P(x,-y,z),P(-x,-y,z)], // front +z
  [P(x,y,-z),P(-x,y,-z),P(-x,-y,-z),P(x,-y,-z)], // back -z
  [P(-x,y,-z),P(-x,y,z),P(-x,-y,z),P(-x,-y,-z)], // anatomical right -x
  [P(x,y,z),P(x,y,-z),P(x,-y,-z),P(x,-y,z)], // anatomical left +x
  [P(-x,y,-z),P(x,y,-z),P(x,y,z),P(-x,y,z)], // top +y
  [P(-x,-y,z),P(x,-y,z),P(x,-y,-z),P(-x,-y,-z)] // bottom -y
 ];const light=[1,.63,.77,.86,1.16,.53],rects=rectsFor(box,outer);for(let j=0;j<6;j++)pushFace(dst,polys[j],rects[j],light[j],box.index)}
function rebuildModel(){if(software){scheduleRender();return}if(!gpu)return;gpu.groups=[];let offset=0,flat=[];for(const target of ['base','outer']){for(let i=0;i<6;i++){const sub=[];meshCube(sub,partState(i),target==='outer');flat.push(...sub);gpu.groups.push({target,part:i,offset,count:sub.length/7});offset+=sub.length/7}}gpu.vertexCount=offset;gl.bindBuffer(gl.ARRAY_BUFFER,gpu.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(flat),gl.STATIC_DRAW);scheduleRender()}
function updateSelectionTexture(){if(software){scheduleRender();return}if(!gpu)return;const arr=new Uint8Array(PIXELS*4);if(selection)for(let i=0;i<PIXELS;i++)if(selection[i])arr.set([255,255,255,255],i*4);gl.bindTexture(gl.TEXTURE_2D,gpu.selection);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,64,64,0,gl.RGBA,gl.UNSIGNED_BYTE,arr);scheduleRender()}
function normalize(v){let s=Math.hypot(...v)||1;return v.map(x=>x/s)}
function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}
function dot(a,b){return a.reduce((v,x,i)=>v+x*b[i],0)}
function lookAt(eye,target,up){let z=normalize(eye.map((v,i)=>v-target[i])),x=normalize(cross(up,z)),y=cross(z,x);return [x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]}
function persp(fov,aspect,near,far){let f=1/Math.tan(fov/2),nf=1/(near-far);return [f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]}
function mul(a,b){let r=new Array(16).fill(0);for(let c=0;c<4;c++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)r[c*4+row]+=a[k*4+row]*b[c*4+k];return r}
function cameraMatrix(){return new Float32Array(mul(persp(Math.PI/4,glCanvas.width/Math.max(1,glCanvas.height),.1,500),lookAt(cameraEye(),cameraTarget,[0,1,0])))}
function enableProgram(p){gl.useProgram(p.program);gl.bindBuffer(gl.ARRAY_BUFFER,gpu.buffer);for(const [loc,size,offset] of [[p.p,3,0],[p.uv,2,12],[p.lit,1,20],[p.piece,1,24]])if(loc>=0){gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,28,offset)}gl.uniformMatrix4fv(p.vp,false,cameraMatrix());}
function drawGroups(){const p=gpu.normal;enableProgram(p);{gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,gpu.texture);gl.uniform1i(p.tex,0);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,gpu.selection);gl.uniform1i(p.sel,1);gl.uniform1f(p.brightness,viewLight)}for(const g of gpu.groups){if(!visibleParts[g.part]||g.target==='outer'&&(!outerShown||outerPreview==='base')||g.target==='base'&&outerPreview==='outer')continue;gl.uniform1f(p.showGrid,grid&&g.target===layers[activeLayer]?.target?1:0);gl.uniform1f(p.layerAlpha,g.target==='outer'&&outerPreview==='ghost'?.3:1);gl.drawArrays(gl.TRIANGLES,g.offset,g.count)}}
function drawGL(){if(software){drawSoftware();return}if(!gpu)return;gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,glCanvas.width,glCanvas.height);gl.clearColor(.065,.085,.125,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);drawGroups();gl.disable(gl.BLEND);drawCursor()}
function scheduleRender(){if(!renderQueued){renderQueued=true;requestAnimationFrame(()=>{renderQueued=false;drawGL()})}}
function resizeGL(){const w=Math.max(1,Math.round(glCanvas.clientWidth*Math.min(devicePixelRatio||1,2))),h=Math.max(1,Math.round(glCanvas.clientHeight*Math.min(devicePixelRatio||1,2)));if(cursorCanvas.width!==w||cursorCanvas.height!==h){cursorCanvas.width=w;cursorCanvas.height=h;}updateAtlasTransform();drawCursor();if(software){if(glCanvas.width!==w||glCanvas.height!==h){glCanvas.width=w;glCanvas.height=h;software.pick.width=w;software.pick.height=h;}scheduleRender();return}if(!gpu)return;if(glCanvas.width===w&&glCanvas.height===h)return;glCanvas.width=w;glCanvas.height=h;scheduleRender()}
// Exact ray/face intersection: cursor and brush address the very same UV texel.
// This avoids readPixels latency, colour quantisation and antialiasing errors.
function cameraEye(){return [cameraTarget[0]+Math.sin(yaw)*Math.cos(pitch)*zoom,cameraTarget[1]+Math.sin(pitch)*zoom,cameraTarget[2]+Math.cos(yaw)*Math.cos(pitch)*zoom]}
function cameraBasis(){const eye=cameraEye(),front=normalize(cameraTarget.map((v,k)=>v-eye[k])),right=normalize(cross(front,[0,1,0]));return {eye,front,right,up:cross(right,front)}}
function screenPlanePoint(clientX,clientY,planePoint=cameraTarget){const bounds=glCanvas.getBoundingClientRect();if(!bounds.width||!bounds.height)return null;const nx=(clientX-bounds.left)/bounds.width*2-1,ny=1-(clientY-bounds.top)/bounds.height*2,aspect=bounds.width/bounds.height;const {eye,front,right,up}=cameraBasis(),scale=Math.tan(Math.PI/8);const ray=normalize(front.map((v,i)=>v+right[i]*nx*aspect*scale+up[i]*ny*scale));const denom=dot(ray,front);if(Math.abs(denom)<1e-6)return null;const dist=dot(planePoint.map((v,i)=>v-eye[i]),front)/denom;return eye.map((v,i)=>v+ray[i]*dist)}
function hitWorld(hit){if(!hit)return cameraTarget;const box=partState(hit.part),corners=softwareCorners(box,hit.face.target==='outer')[hit.fi],r=hit.face;return lerpVertex(corners,(hit.x-r.x+.5)/r.w,(hit.y-r.y+.5)/r.h)}
function panCamera(dx,dy){const {right,up}=cameraBasis(),unit=2*zoom*Math.tan(Math.PI/8)/Math.max(1,glCanvas.clientHeight);cameraTarget=cameraTarget.map((v,i)=>v+unit*(-dx*right[i]+dy*up[i]));scheduleRender()}
function zoomCameraAt(clientX,clientY,delta){const next=Math.max(10,Math.min(250,zoom*Math.exp(delta*.0012)));if(next===zoom)return;const hit=pickFromClient(clientX,clientY),plane=hitWorld(hit),before=screenPlanePoint(clientX,clientY,plane);zoom=next;const after=screenPlanePoint(clientX,clientY,plane);if(before&&after)cameraTarget=cameraTarget.map((v,i)=>v+before[i]-after[i]);scheduleRender()}
function updateAtlasTransform(){const stage=$('stage'),half=view==='split';const base=Math.max(90,Math.min((half?stage.clientWidth/2:stage.clientWidth)-26,stage.clientHeight-26));const dimension=base*uvZoom;atlas.style.width=atlas.style.height=dimension+'px';atlas.style.left=half?'75%':'50%';atlas.style.top='50%';atlas.style.transform=`translate(calc(-50% + ${uvPan[0]}px),calc(-50% + ${uvPan[1]}px))`}
function zoomUVAt(e){e.preventDefault();const rect=atlas.getBoundingClientRect();if(!rect.width)return;const prev=uvZoom,next=Math.max(.4,Math.min(16,prev*Math.exp(-e.deltaY*.0012)));if(prev===next)return;const cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;uvPan[0]+=(e.clientX-cx)*(1-next/prev);uvPan[1]+=(e.clientY-cy)*(1-next/prev);uvZoom=next;updateAtlasTransform()}
function panUV(dx,dy){uvPan[0]+=dx;uvPan[1]+=dy;updateAtlasTransform()}
// In the Canvas 2D renderer textures are rasterized by affine triangles.
// Pick through those very same triangles, avoiding perspective/texture drift.
function triangleWeights(x,y,a,b,c){
 const den=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
 if(Math.abs(den)<.000001)return null;
 const u=((b.y-c.y)*(x-c.x)+(c.x-b.x)*(y-c.y))/den;
 const v=((c.y-a.y)*(x-c.x)+(a.x-c.x)*(y-c.y))/den;
 const w=1-u-v;
 return u>=-.00001&&v>=-.00001&&w>=-.00001?[u,v,w]:null;
}
function pickSoftwareFromClient(clientX,clientY,target=layers[activeLayer]?.target||'base'){
 const rect=glCanvas.getBoundingClientRect();if(!rect.width||!rect.height)return null;
 const mx=(clientX-rect.left)*glCanvas.width/rect.width,my=(clientY-rect.top)*glCanvas.height/rect.height;
 if(mx<0||my<0||mx>=glCanvas.width||my>=glCanvas.height)return null;
 const m=cameraMatrix(),eye=cameraEye(),isOuter=target==='outer';
 let best=null,nearest=Infinity;
 for(let i=0;i<6;i++){
  if(!visibleParts[i])continue;
  const b=partState(i),quads=softwareCorners(b,isOuter),uvs=rectsFor(b,isOuter);
  for(let fi=0;fi<6;fi++){
   const corners=quads[fi],a=corners[0],bb=corners[1],cc=corners[2];
   const normal=cross(bb.map((v,k)=>v-a[k]),cc.map((v,k)=>v-a[k]));
   const center=a.map((v,k)=>(v+bb[k]+cc[k]+corners[3][k])/4);
   if(dot(normal,eye.map((v,k)=>v-center[k]))>=0)continue;
   const p=corners.map(v=>projectVertex(v,m));if(p.some(v=>!v))continue;
   for(const tri of [[0,1,2],[0,2,3]]){
    const w=triangleWeights(mx,my,p[tri[0]],p[tri[1]],p[tri[2]]);
    if(!w)continue;
    const z=w[0]*p[tri[0]].z+w[1]*p[tri[1]].z+w[2]*p[tri[2]].z;
    if(z>=nearest)continue;
    const uv=[[0,0],[1,0],[1,1],[0,1]],u=w[0]*uv[tri[0]][0]+w[1]*uv[tri[1]][0]+w[2]*uv[tri[2]][0];
    const v=w[0]*uv[tri[0]][1]+w[1]*uv[tri[1]][1]+w[2]*uv[tri[2]][1],r=uvs[fi];
    const x=r.x+Math.max(0,Math.min(r.w-1,Math.floor(u*r.w)));
    const y=r.y+Math.max(0,Math.min(r.h-1,Math.floor(v*r.h)));
    best={x,y,part:i,fi,face:{...r,part:i,fi,target},depth:z};nearest=z;
   }
  }
 }
 return best;
}
function pickFromClient(clientX,clientY,target=layers[activeLayer]?.target||'base'){
 const bounds=glCanvas.getBoundingClientRect();if(!bounds.width||!bounds.height)return null;
 const mx=(clientX-bounds.left)/bounds.width,my=(clientY-bounds.top)/bounds.height;
 if(mx<0||mx>1||my<0||my>1)return null;
 const {eye:origin,front,right,up}=cameraBasis();
 const aspect=glCanvas.width/Math.max(1,glCanvas.height),scale=Math.tan(Math.PI/8);
 const xx=(mx*2-1)*aspect*scale,yy=(1-my*2)*scale;
 const direction=normalize(front.map((v,k)=>v+right[k]*xx+up[k]*yy));
 const isOuter=target==='outer';
 let best=null,bestDist=Infinity;
 for(let i=0;i<6;i++){if(!visibleParts[i])continue;const b=partState(i),quad=softwareCorners(b,isOuter),rects=rectsFor(b,isOuter);
  for(let fi=0;fi<6;fi++){
   const corners=quad[fi],a=corners[0],ab=corners[1].map((v,k)=>v-a[k]),ad=corners[3].map((v,k)=>v-a[k]);
   const normal=cross(ab,ad),denom=dot(normal,direction);
   if(denom<=1e-8)continue; // the stored polygon normals point inward
   const t=dot(normal,a.map((v,k)=>v-origin[k]))/denom;
   if(t<=0||t>=bestDist)continue;
   const hit=origin.map((v,k)=>v+direction[k]*t),delta=hit.map((v,k)=>v-a[k]);
   const u=dot(delta,ab)/dot(ab,ab),v=dot(delta,ad)/dot(ad,ad);
   if(u<-.00001||v<-.00001||u>1.00001||v>1.00001)continue;
   const r=rects[fi],px=r.x+Math.min(r.w-1,Math.max(0,Math.floor(Math.max(0,u-.00000001)*r.w))),py=r.y+Math.min(r.h-1,Math.max(0,Math.floor(Math.max(0,v-.00000001)*r.h)));
   best={x:px,y:py,part:i,face:{...r,part:i,fi,target},fi,depth:t};bestDist=t;
  }
 }
 return best;
}
function pick3D(event){return pickFromClient(event.clientX,event.clientY)}
function drawCursor(){
 if(!cursorCtx||!cursorCanvas)return;const ctx=cursorCtx;ctx.clearRect(0,0,cursorCanvas.width,cursorCanvas.height);
 if(drag&&(drag.kind==='select'||drag.kind==='lasso')&&drag.mode==='3d'){
   const bounds=glCanvas.getBoundingClientRect(),place=p=>[(p[0]-bounds.left)*cursorCanvas.width/Math.max(1,bounds.width),(p[1]-bounds.top)*cursorCanvas.height/Math.max(1,bounds.height)];
   const pts=(drag.kind==='select'?[[drag.screenStart[0],drag.screenStart[1]],[drag.screenLast[0],drag.screenStart[1]],drag.screenLast,[drag.screenStart[0],drag.screenLast[1]]]:drag.screenPoints).map(place);
   if(pts.length>1){ctx.save();ctx.setLineDash([6,4]);ctx.lineWidth=2;ctx.strokeStyle='#9aeaff';ctx.fillStyle='rgba(55,170,245,.11)';ctx.beginPath();ctx.moveTo(...pts[0]);for(let i=1;i<pts.length;i++)ctx.lineTo(...pts[i]);if(drag.kind==='select')ctx.closePath();ctx.stroke();if(drag.kind==='select')ctx.fill();ctx.restore();}
 }
 if(view==='2d'||!hover||!hover.face||!visibleParts[hover.part])return;
 const b=partState(hover.part),corners=softwareCorners(b,hover.face.target==='outer')[hover.fi];
 const r=hover.face,m=cameraMatrix(),span=brushSize;
 if(tool==='stamp'&&clipboard){const colors=[];forStampPixels(hover,(px,py,pixel)=>{const u0=(px-r.x)/r.w,v0=(py-r.y)/r.h,u1=(px-r.x+1)/r.w,v1=(py-r.y+1)/r.h;const pts=[[u0,v0],[u1,v0],[u1,v1],[u0,v1]].map(([u,v])=>projectVertex(lerpVertex(corners,u,v),m));if(pts.some(v=>!v))return;ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);for(const pt of pts.slice(1))ctx.lineTo(pt.x,pt.y);ctx.closePath();ctx.fillStyle=`rgba(${pixel[0]},${pixel[1]},${pixel[2]},${Math.min(.6,pixel[3]/255*.55)})`;ctx.fill();ctx.strokeStyle='#ffe08a';ctx.lineWidth=1;ctx.stroke()});return;}
 const radius=Math.floor((span-1)/2);
 for(let oy=0;oy<span;oy++)for(let ox=0;ox<span;ox++){
  const px=hover.x+ox-radius,py=hover.y+oy-radius;
  if(!faceFilter(px,py,r)||selection&&!selection[py*64+px])continue;
  const u0=(px-r.x)/r.w,v0=(py-r.y)/r.h,u1=(px-r.x+1)/r.w,v1=(py-r.y+1)/r.h;
  const points=[[u0,v0],[u1,v0],[u1,v1],[u0,v1]].map(([u,v])=>projectVertex(lerpVertex(corners,u,v),m));
  if(points.some(p=>!p))continue;
  ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);for(const p of points.slice(1))ctx.lineTo(p.x,p.y);ctx.closePath();
  ctx.fillStyle='rgba(255,224,121,.23)';ctx.fill();ctx.lineWidth=Math.max(1.5,Math.min(3,cursorCanvas.width/400));ctx.strokeStyle='#161923';ctx.stroke();ctx.lineWidth=1.25;ctx.strokeStyle='#ffe08a';ctx.stroke();
 }
}
function hoverPointer(e){if(drag?.kind==='orbit')return;const p=tool==='eyedrop'?eyedropAt(e):point(e);hover=p;
 if(p&&p.face){$('pixelInfo').textContent=`${p.x}, ${p.y} · ${PART_NAMES[p.part]} · ${p.face.face}`}else $('pixelInfo').textContent='—';
 if(canvasMode(e)==='3d')drawCursor();else drawHover2D(p);
}
function drawHover2D(p){if(view==='3d')return;render2D();if(!p)return;
 if(!p.face)return;const ctx=atlasCtx,scale=atlas.width/64,span=brushSize,half=Math.floor((span-1)/2);
 if(tool==='stamp'&&clipboard){let w=stampRotation%2?clipboard.height:clipboard.width,h=stampRotation%2?clipboard.width:clipboard.height;ctx.save();forStampPixels(p,(px,py,pixel)=>{ctx.fillStyle=`rgba(${pixel[0]},${pixel[1]},${pixel[2]},${Math.min(.6,pixel[3]/255*.55)})`;ctx.fillRect(px*scale,py*scale,scale,scale)});ctx.strokeStyle='#ffe38c';ctx.lineWidth=2;ctx.setLineDash([5,3]);ctx.strokeRect(p.x*scale,p.y*scale,w*scale,h*scale);ctx.restore();return} 
 for(let y=0;y<span;y++)for(let x=0;x<span;x++){
  const px=p.x+x-half,py=p.y+y-half;
  if(!faceFilter(px,py,p.face)||selection&&!selection[py*64+px])continue;
  ctx.fillStyle='rgba(255,219,110,.23)';ctx.fillRect(px*scale,py*scale,scale,scale);
  ctx.strokeStyle='#ffe08a';ctx.lineWidth=2;ctx.strokeRect(px*scale+1,py*scale+1,scale-2,scale-2);
 }
}
function requestComposite(){if(frameCompose)return;frameCompose=true;requestAnimationFrame(()=>{frameCompose=false;composite()})}
function pick2D(event){const box=atlas.getBoundingClientRect(),x=Math.floor((event.clientX-box.left)*64/box.width),y=Math.floor((event.clientY-box.top)*64/box.height);if(!validPixel(x,y))return null;const face=findFace(x,y);if(!face)return (tool==='select'||tool==='lasso')?{x,y,part:null,face:null}:null;return {x,y,part:face.part,face}}
function canvasMode(event){return view==='split'?(event.currentTarget===atlas||event.target===atlas?'2d':'3d'):view}
function point(event){return canvasMode(event)==='3d'?pick3D(event):pick2D(event)}
function afterChange(){composite();queueSave()}
function startPointer(e){
 const mode=canvasMode(e);
 if(e.button===0&&(tool==='eyedrop'||e.altKey&&tool!=='select'&&tool!=='lasso')){
  e.preventDefault();applySample(e);return;
 }
 if(layers[activeLayer]?.target==='outer'&&!outerShown&&e.button===0){notify('Activa «Capa exterior» para pintar sus detalles');return}
 if(e.button===2||e.button===1||e.button===0&&spaceDown){
  hover=null;drawCursor();drag={kind:(e.button===1||spaceDown||mode==='2d')?'pan':'orbit',mode,x:e.clientX,y:e.clientY};e.preventDefault();e.target.setPointerCapture(e.pointerId);return;
 }
 if(e.button!==0)return;const p=point(e);
 if(!p&&(tool==='select'||tool==='lasso')){
  e.preventDefault();e.target.setPointerCapture(e.pointerId);
  const phantom={x:0,y:0,part:null,face:null};
  drag={kind:tool,mode,start:phantom,last:phantom,points:[],screenStart:[e.clientX,e.clientY],screenPoints:[[e.clientX,e.clientY]],screenLast:[e.clientX,e.clientY],add:e.shiftKey,subtract:e.ctrlKey||e.metaKey,startedOutside:true,restrictedPart:null};return;
 }
 if(!p){if(mode==='3d'){drag={kind:'orbit',mode,x:e.clientX,y:e.clientY};e.target.setPointerCapture(e.pointerId)}return}
 if(p.face)lastFace=p.face;hover=p.face?p:null;drawCursor();$('pixelInfo').textContent=p.face?`${p.x}, ${p.y} · ${PART_NAMES[p.part]} · ${p.face.face}`:'Espacio libre · arrastra para seleccionar';
 e.preventDefault();e.target.setPointerCapture(e.pointerId);
 if(tool==='stamp'){if(!clipboard)return notify('Primero copia una selección');if(layers[activeLayer].locked||!layers[activeLayer].visible)return notify('La capa está bloqueada u oculta');stampAt(p);return}
 if(tool==='select'&&(e.ctrlKey||e.metaKey)&&p.face){selectWholePart(p.part);return}
  if(tool==='select'||tool==='lasso'){drag={kind:tool,mode,start:p,last:p,points:[p],screenStart:[e.clientX,e.clientY],screenPoints:[[e.clientX,e.clientY]],screenLast:[e.clientX,e.clientY],add:e.shiftKey,subtract:e.ctrlKey||e.metaKey,startedOutside:!p.face,restrictedPart:$('limitSelectionPart').checked?p.part:null};return}
 if(layers[activeLayer].locked||!layers[activeLayer].visible){notify('La capa está bloqueada u oculta');return}
 remember();drag={kind:'paint',mode,start:p,last:p,before:new Uint8ClampedArray(layers[activeLayer].data),strokePixels:new Set(),screenStart:[e.clientX,e.clientY],screenEnd:[e.clientX,e.clientY],client:{x:e.clientX,y:e.clientY}};
 if(selection&&!selection[p.y*64+p.x])notify('Hay una selección activa: solo se pinta dentro de ella (Esc para quitarla)');
 if(tool==='bucket'||tool==='replace'){bucketAt(p,tool);drag=null;afterChange();return}
 if(['brush','erase','lighten','darken'].includes(tool)){paintBrush(p.x,p.y,tool,p.face);requestComposite();queueSave()}
}
function movePointer(e){
 const mode=canvasMode(e);
 if(!drag){hoverPointer(e);return}
 if(drag.kind==='pan'){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(drag.mode==='2d')panUV(dx,dy);else panCamera(dx,dy);drag.x=e.clientX;drag.y=e.clientY;return;}
 if(drag.kind==='orbit'){
  const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  yaw-=dx*.012;pitch=Math.max(-1.46,Math.min(1.46,pitch+dy*.012));drag.x=e.clientX;drag.y=e.clientY;
  scheduleRender();return;
 }
 if(drag.kind==='paint'&&drag.mode==='3d'&&tool==='gradient'&&selection){layers[activeLayer].data.set(drag.before);drag.strokePixels.clear();drag.screenEnd=[e.clientX,e.clientY];gradientScreenAt(drag.screenStart,drag.screenEnd);requestComposite();queueSave();return}
 if((drag.kind==='select'||drag.kind==='lasso')&&drag.mode==='3d'){drag.screenLast=[e.clientX,e.clientY];if(drag.kind==='lasso')drag.screenPoints.push([e.clientX,e.clientY]);hover=point(e);drawCursor();return}
 const p=point(e);
 if(!p){hover=null;drawCursor();return}
 hover=p;drawCursor();if(p.face)$('pixelInfo').textContent=`${p.x}, ${p.y} · ${PART_NAMES[p.part]} · ${p.face.face}`;
 if(drag.kind==='select'||drag.kind==='lasso'){
  if(mode==='3d'&&drag.start.face&&p.face&&(p.face.part!==drag.start.face.part||p.face.fi!==drag.start.face.fi))return;
  drag.last=p;
  if(drag.kind==='lasso'&&(!drag.points.length||p.x!==drag.points.at(-1).x||p.y!==drag.points.at(-1).y))drag.points.push(p);
  if(mode==='2d')render2D();return;
 }
 if(drag.kind!=='paint')return;
 const a=drag.start,b=p;
 if(['brush','erase','lighten','darken'].includes(tool)){
  if(mode==='3d'){
   const dist=Math.hypot(e.clientX-drag.client.x,e.clientY-drag.client.y),steps=Math.min(100,Math.max(1,Math.ceil(dist/3)));
   for(let j=1;j<=steps;j++){
    const t=j/steps,hit=pickFromClient(drag.client.x+(e.clientX-drag.client.x)*t,drag.client.y+(e.clientY-drag.client.y)*t);
    if(hit)paintBrush(hit.x,hit.y,tool,hit.face);
   }
  }else if(drag.last.face.part===p.face.part&&drag.last.face.fi===p.face.fi){rasterLine(drag.last,p,(x,y)=>paintBrush(x,y,tool,p.face))}
  else paintBrush(p.x,p.y,tool,p.face);
  drag.last=p;drag.client={x:e.clientX,y:e.clientY};requestComposite();queueSave();return;
 }
 // Shape preview stays on the face where the drag began; no jumps to other UV islands.
 if(mode==='3d'&&(p.face.part!==a.face.part||p.face.fi!==a.face.fi))return;
 layers[activeLayer].data.set(drag.before);drag.strokePixels.clear();
 if(tool==='line')rasterLine(a,b,(x,y)=>paintBrush(x,y,'brush',a.face));
 else if(tool==='rectangle')rectLoop(a,b,(x,y)=>paintAt(x,y,undefined,false,'brush',a.face),shapeFill==='fill');
 else if(tool==='ellipse')ellipseLoop(a,b,(x,y)=>paintAt(x,y,undefined,false,'brush',a.face),shapeFill==='fill');
 else if(tool==='gradient')gradientAt(a,b,a.face);
 drag.last=p;requestComposite();queueSave();
}
function endPointer(e){
 if(!drag)return;
 if((drag.kind==='select'||drag.kind==='lasso')&&Math.hypot(e.clientX-drag.screenStart[0],e.clientY-drag.screenStart[1])<4&&!drag.add&&!drag.subtract&&(drag.startedOutside||drag.start&&selection&&selection[drag.start.y*64+drag.start.x])){remember();selection=null;updateSelectionNote();render2D();queueSave()}
 else if(drag.kind==='select'){if(drag.mode==='3d'){const [x0,y0]=drag.screenStart,[x1,y1]=drag.screenLast;selectScreen([[x0,y0],[x1,y0],[x1,y1],[x0,y1]],false,drag.add,drag.subtract,drag.restrictedPart)}else{remember();selectionFromRect(drag.start,drag.last,drag.add,drag.subtract,'2d',drag.restrictedPart);render2D();queueSave()}}
 else if(drag.kind==='lasso'){if(drag.mode==='3d')selectScreen(drag.screenPoints,true,drag.add,drag.subtract,drag.restrictedPart);else{remember();selectionLasso(drag.points,drag.add,drag.subtract,'2d',drag.restrictedPart);render2D();queueSave()}}
 else if(drag.kind==='paint'){
  if(['line','rectangle','ellipse','gradient'].includes(tool)&&drag.last.x===drag.start.x&&drag.last.y===drag.start.y){
   if(tool==='gradient')gradientAt(drag.start,{x:drag.start.x+1,y:drag.start.y},drag.start.face);
   else paintBrush(drag.start.x,drag.start.y,'brush',drag.start.face);
  }
  afterChange();
 }
 drag=null;
 if(e?.clientX!==undefined)hoverPointer(e);
}
function wheelZoom(e){e.preventDefault();if(canvasMode(e)==='2d')zoomUVAt(e);else zoomCameraAt(e.clientX,e.clientY,e.deltaY)}
function setView(next){view=next;glCanvas.hidden=next==='2d';atlas.hidden=next==='3d';$('stage').classList.toggle('split',next==='split');$('view3d').classList.toggle('selected',next==='3d');$('view2d').classList.toggle('selected',next==='2d');$('viewSplit').classList.toggle('selected',next==='split');$('stageTag').textContent=next==='3d'?'VISTA 3D · ZOOM AL CURSOR':next==='2d'?'MAPA UV 2D · ZOOM AL CURSOR':'VISTAS 3D + 2D · SINCRONIZADAS';$('cameraShortcuts').hidden=next==='2d';$('stageHint').textContent='Rueda: zoom donde apuntas · Rueda pulsada / Espacio + arrastrar: mover · Clic derecho: girar 3D';hover=null;drawCursor();resizeGL();render2D()}

// Embedded color editor; never opens an operating-system color dialog.
let editingColor=null, pickerHSV={h:0,s:1,v:1}, pickerInitial='#ffffff';
function hsvToRgb(h,s,v){let c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c;let rgb=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];return rgb.map(k=>Math.round((k+m)*255))}
function rgbToHsv([r,g,b]){r/=255;g/=255;b/=255;let max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,h=0;if(d){if(max===r)h=60*((g-b)/d%6);else if(max===g)h=60*((b-r)/d+2);else h=60*((r-g)/d+4)}return {h:(h+360)%360,s:max?d/max:0,v:max}}
function pickerHex(){return hexOf(hsvToRgb(pickerHSV.h,pickerHSV.s,pickerHSV.v))}
function drawPickerArea(){const can=$('fxColorArea'),ctx=can.getContext('2d'),{width:w,height:h}=can,base=hsvToRgb(pickerHSV.h,1,1),data=ctx.createImageData(w,h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){let sat=x/(w-1),bright=1-y/(h-1),k=(y*w+x)*4;for(let ch=0;ch<3;ch++)data.data[k+ch]=Math.round(((1-sat)*255+sat*base[ch])*bright);data.data[k+3]=255}ctx.putImageData(data,0,0);ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(pickerHSV.s*(w-1),(1-pickerHSV.v)*(h-1),5,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#111';ctx.lineWidth=1;ctx.beginPath();ctx.arc(pickerHSV.s*(w-1),(1-pickerHSV.v)*(h-1),6,0,Math.PI*2);ctx.stroke();$('fxColorPreview').style.background=pickerHex();$('fxPickerHex').value=pickerHex().toUpperCase();$('fxHue').value=Math.round(pickerHSV.h)}
function openFxColor(id){editingColor=id;const value=$(id).value;pickerInitial=value;pickerHSV=rgbToHsv(rgba(value));$('fxColorTitle').textContent=id==='foreground'?'Color principal':id==='backgroundColor'?'Color secundario':'Color intermedio';$('fxColorPicker').hidden=false;drawPickerArea();$('fxColorPicker').scrollIntoView({block:'nearest',behavior:'smooth'})}
function closeFxColor(accept){if(accept&&editingColor){const v=pickerHex();$(editingColor).value=v;if(editingColor==='foreground'){fg=v;$('hexColor').value=v.toUpperCase();recentColor(v)}if(editingColor==='backgroundColor')bg=v;if(editingColor==='gradientMid')gradientMid=v;const swatch=$(editingColor+'Swatch');if(swatch)swatch.style.background=v;syncColorSwatches()}editingColor=null;$('fxColorPicker').hidden=true}
function syncColorSwatches(){for(const [id,color] of [['foregroundSwatch',fg],['railForegroundSwatch',fg],['backgroundSwatch',bg],['railBackgroundSwatch',bg]]){const el=$(id);if(el)el.style.background=color;}const hex=$('hexColor');if(hex)hex.value=fg.toUpperCase()}
function setupFxColor(){document.querySelectorAll('[data-color-for]').forEach(b=>b.onclick=()=>openFxColor(b.dataset.colorFor));button('fxColorCancel',()=>closeFxColor(false));button('fxColorAccept',()=>closeFxColor(true));$('fxHue').oninput=e=>{pickerHSV.h=+e.target.value;drawPickerArea()};let down=false;const pick=e=>{const r=$('fxColorArea').getBoundingClientRect();pickerHSV.s=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));pickerHSV.v=1-Math.max(0,Math.min(1,(e.clientY-r.top)/r.height));drawPickerArea()};$('fxColorArea').addEventListener('pointerdown',e=>{down=true;e.currentTarget.setPointerCapture(e.pointerId);pick(e)});$('fxColorArea').addEventListener('pointermove',e=>{if(down)pick(e)});$('fxColorArea').addEventListener('pointerup',()=>down=false);$('fxColorArea').addEventListener('lostpointercapture',()=>down=false);$('fxPickerHex').addEventListener('change',e=>{if(/^#[a-f0-9]{6}$/i.test(e.target.value))pickerHSV=rgbToHsv(rgba(e.target.value));drawPickerArea()})}
function recentColor(col){let arr=[];try{arr=JSON.parse(localStorage.getItem('fxtools.skin-editor.colors')||'[]');if(!Array.isArray(arr))arr=[]}catch(e){}arr=[col,...arr.filter(x=>x!==col)].slice(0,12);try{localStorage.setItem('fxtools.skin-editor.colors',JSON.stringify(arr))}catch(e){}let host=$('recentColors');host.innerHTML='';for(const c of arr){let b=document.createElement('button');b.style.backgroundColor=c;b.title=c;b.onclick=()=>{fg=c;$('foreground').value=c;syncColorSwatches()};host.append(b)}}
function button(id,handler){$(id).addEventListener('click',handler)}
function setupCanvasEvents(c){c.addEventListener('pointerdown',startPointer);c.addEventListener('pointermove',movePointer);c.addEventListener('pointerleave',()=>{if(!drag){hover=null;drawCursor();if(view==='2d')render2D()}});c.addEventListener('pointerup',endPointer);c.addEventListener('pointercancel',endPointer);c.addEventListener('lostpointercapture',e=>{if(drag)endPointer(e)});c.addEventListener('contextmenu',e=>e.preventDefault());c.addEventListener('wheel',wheelZoom,{passive:false})}
function bind(){setupFxColor();button('stageHelpToggle',()=>{const opened=$('stage').classList.toggle('help-open');$('stageHelpToggle').setAttribute('aria-expanded',String(opened))});document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{updateTool(b.dataset.tool);$('shapeMenu').hidden=true;$('shapeMenuToggle').setAttribute('aria-expanded','false')});button('shapeMenuToggle',()=>{const m=$('shapeMenu');m.hidden=!m.hidden;$('shapeMenuToggle').setAttribute('aria-expanded',String(!m.hidden))});$('eyedropSource').onchange=e=>{eyedropSource=e.target.value;notify(eyedropSource==='visible'?'Cuentagotas: color visible de la skin':'Cuentagotas: capa de trabajo seleccionada')};for(const c of [glCanvas,atlas])setupCanvasEvents(c);$('gridToggle').classList.toggle('toggled',grid);button('view3d',()=>setView('3d'));button('view2d',()=>setView('2d'));button('viewSplit',()=>setView('split'));button('undo',doUndo);button('redo',doRedo);button('explode',()=>{remember();exploded=!exploded;updateToggles();rebuildModel();queueSave()});button('outerToggle',()=>{remember();outerShown=!outerShown;updateToggles();render2D();scheduleRender();queueSave();if(outerShown&&countExteriorPixels()===0)notify('La segunda capa está vacía. Pulsa «Pintar exterior» y dibuja encima del personaje.')});button('resetCamera',()=>{yaw=-.32;pitch=.14;zoom=60;cameraTarget=[0,16,0];uvZoom=1;uvPan=[0,0];updateAtlasTransform();scheduleRender()});button('fullscreen',()=>{if(!document.fullscreenElement)$('stage').requestFullscreen?.();else document.exitFullscreen?.()});$('symmetryToggle').onchange=e=>{symmetry=e.target.checked;notify(symmetry?'Simetría activada':'Simetría desactivada')};$('layerPreview').onchange=e=>{remember();outerPreview=e.target.value;render2D();scheduleRender();queueSave()};button('paintBase',()=>setPaintTarget('base'));button('paintOuter',()=>setPaintTarget('outer'));button('railCopySelection',()=>{copyActiveSelection();updatePasteInfo()});button('railPasteSelection',()=>{if(!clipboard)return notify('Primero copia una selección');updateTool('stamp');notify('Haz clic en el destino para pegar. R/F para girar/reflejar')});button('gridToggle',()=>{grid=!grid;$('gridToggle').classList.toggle('toggled',grid);render2D();scheduleRender()});document.querySelectorAll('[data-camera]').forEach(b=>b.onclick=()=>{const dirs={front:[0,0],back:[Math.PI,0],left:[Math.PI/2,0],right:[-Math.PI/2,0],top:[0,1.45]};[yaw,pitch]=dirs[b.dataset.camera];scheduleRender()});
 button('newSkin',()=>{if(confirm('¿Crear una skin nueva? Guarda el proyecto actual si quieres conservarlo.'))initNew()});button('searchMinecraftSkin',importSkinByName);$('minecraftName').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();importSkinByName()}});$('importSkin').onchange=e=>{importPNG(e.target.files[0]);e.target.value=''};button('exportSkin',exportPNG);button('saveProject',projectExport);button('openProject',()=>$('projectFile').click());$('projectFile').onchange=async e=>{let f=e.target.files[0];if(!f)return;try{if(!confirm('¿Abrir este proyecto y reemplazar el actual?'))return;loadData(JSON.parse(await f.text()));queueSave();notify('Proyecto cargado correctamente')}catch(err){notify('No se pudo abrir el proyecto: '+err.message)}finally{e.target.value=''}};
 button('exportPreview',()=>{if(!gpu&&!software){notify('La vista 3D no está disponible');return}if(view==='2d')setView('3d');drawGL();glCanvas.toBlob(blob=>{if(blob)download(blob,fileSafe()+'-vista-3d.png')},'image/png')});
 $('foreground').oninput=e=>{fg=e.target.value;syncColorSwatches()};$('foreground').onchange=()=>recentColor(fg);$('backgroundColor').oninput=e=>{bg=e.target.value;syncColorSwatches()};button('swapColors',()=>{[fg,bg]=[bg,fg];$('foreground').value=fg;$('backgroundColor').value=bg;syncColorSwatches()});button('railSwapColors',()=>{[fg,bg]=[bg,fg];$('foreground').value=fg;$('backgroundColor').value=bg;syncColorSwatches()});$('hexColor').onchange=e=>{if(/^#[0-9a-f]{6}$/i.test(e.target.value)){fg=e.target.value.toLowerCase();$('foreground').value=fg;syncColorSwatches();recentColor(fg)}else e.target.value=fg.toUpperCase()};
 const slider=(id,out,cb,fmt=x=>x)=>{$(id).oninput=e=>{cb(+e.target.value);$(out).textContent=fmt(e.target.value)}};
 slider('opacity','opacityVal',v=>opacity=v/100,v=>`${v}%`);slider('brushSize','brushSizeVal',v=>brushSize=v,v=>`${v} px`);slider('strength','strengthVal',v=>strength=v/100,v=>`${v}%`);slider('tolerance','toleranceVal',v=>tolerance=v);slider('explodeDistance','explodeVal',v=>{explodeGap=v;rebuildModel();queueSave()});slider('viewBrightness','brightnessVal',v=>{viewLight=v/100;scheduleRender();queueSave()},v=>`${v}%`);
 $('gradientType').onchange=e=>gradMode=e.target.value;$('patternType').onchange=e=>{pattern=e.target.value;notify('Patrón de pintura: '+e.target.selectedOptions[0].text)};$('patternScale').oninput=e=>{patternScale=+e.target.value;$('patternScaleVal').textContent=e.target.value+' px'};$('gradientMiddle').onchange=e=>{gradientMiddle=e.target.checked;$('gradientMiddleSettings').hidden=!gradientMiddle};$('gradientMid').oninput=e=>{gradientMid=e.target.value;$('gradientMidSwatch').style.background=gradientMid};$('gradientMidPosition').oninput=e=>{gradientMiddlePos=+e.target.value/100;$('gradientMidPositionVal').textContent=e.target.value+'%'};$('shapeFill').onchange=e=>shapeFill=e.target.value;$('modelType').onchange=e=>{remember();model=e.target.value;rebuildModel();updateAll();notify('Modelo '+(model==='slim'?'Slim':'Classic')+' seleccionado')};
 button('clearSelection',()=>{remember();selection=null;updateSelectionNote();render2D();queueSave()});
 button('selectPart',()=>{if(!lastFace){notify('Haz clic primero sobre la pieza que quieres seleccionar (con Selección, Ctrl + clic también funciona)');return}selectWholePart(lastFace.part)});
 button('selectAllTarget',()=>{remember();selection=new Uint8Array(PIXELS);for(const r of allRects(layers[activeLayer].target))for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++)selection[y*64+x]=1;updateSelectionNote();render2D();queueSave();notify('Seleccionado todo el cuerpo · '+layers[activeLayer].target)});
 button('fillSelection',()=>{if(!selection||!selection.some(Boolean))return notify('Primero selecciona una zona');if(layers[activeLayer].locked)return notify('Capa bloqueada');remember();for(let y=0;y<64;y++)for(let x=0;x<64;x++)if(selection[y*64+x])paintAt(x,y,rgba(fg,Math.round(opacity*255)),false,'brush');afterChange();notify('Área seleccionada rellenada')});button('selectFace',()=>{if(!lastFace){notify('Haz clic primero en una cara del personaje');return}remember();selection=faceDomain(lastFace);updateSelectionNote();render2D()});button('invertSelection',()=>{remember();const valid=new Uint8Array(PIXELS);for(const r of allRects(layers[activeLayer].target))for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++)valid[y*64+x]=1;const old=selection||new Uint8Array(PIXELS);selection=valid.map((v,i)=>v&&!old[i]?1:0);updateSelectionNote();render2D()});button('copySelection',()=>{copyActiveSelection();updatePasteInfo()});button('pasteSelection',()=>{if(!clipboard)return notify('Primero copia una selección');updateTool('stamp');notify('Haz clic en el destino para pegar. R/F para girar/reflejar')});button('mirrorToOtherArm',duplicateToOppositeArm);button('rotatePaste',()=>{stampRotation=(stampRotation+1)%4;updatePasteInfo()});button('flipPasteX',()=>{stampFlipX=!stampFlipX;updatePasteInfo()});button('flipPasteY',()=>{stampFlipY=!stampFlipY;updatePasteInfo()});
 button('showAllParts',()=>{remember();visibleParts=Array(6).fill(true);renderParts();scheduleRender();queueSave()});
 button('addBaseLayer',()=>addLayer('base'));button('addOuterLayer',()=>addLayer('outer'));button('duplicateLayer',()=>{remember();let l=layers[activeLayer];layers.splice(activeLayer+1,0,{...l,data:new Uint8ClampedArray(l.data),name:l.name+' copia'});activeLayer++;updateAll()});button('layerUp',()=>moveLayer(1));button('layerDown',()=>moveLayer(-1));button('removeLayer',()=>{if(layers.length<2)return notify('Debe quedar al menos una capa');if(!confirm('¿Eliminar la capa seleccionada?'))return;remember();layers.splice(activeLayer,1);activeLayer=Math.min(activeLayer,layers.length-1);updateAll()});button('mergeLayer',mergeLayer);
 button('saveLocal',()=>saveLocal(false));button('saveLibrary',()=>saveInLibrary(false));button('saveLibraryCopy',()=>saveInLibrary(true));button('loadLibrary',openSavedProject);button('deleteLibrary',deleteSavedProject);button('recoverLocal',()=>{try{const raw=localStorage.getItem(STORE);if(!raw)return notify('No hay un proyecto guardado');if(confirm('¿Recuperar el último guardado local?')){loadData(JSON.parse(raw));notify('Proyecto recuperado')}}catch(e){notify('No fue posible recuperar el proyecto')}});button('clearLocal',()=>{if(confirm('¿Eliminar solo el guardado local de Skin Editor?')){localStorage.removeItem(STORE);notify('Guardado local eliminado')}});$('projectName').addEventListener('input',queueSave);
 document.addEventListener('keyup',e=>{if(e.code==='Space')spaceDown=false});window.addEventListener('blur',()=>spaceDown=false);document.addEventListener('keydown',e=>{if(e.code==='Space'&&!e.target.closest('input,textarea,select,[contenteditable]')){spaceDown=true;e.preventDefault();return}const editing=e.target.closest('input,textarea,select,[contenteditable]');if(editing)return;let c=e.ctrlKey||e.metaKey;if(e.key==='Escape'&&$('stage').classList.contains('help-open')){$('stage').classList.remove('help-open');$('stageHelpToggle').setAttribute('aria-expanded','false');return}if(e.key==='Escape'&&selection){e.preventDefault();remember();selection=null;updateSelectionNote();render2D();queueSave();return}if(e.shiftKey&&e.key.toLowerCase()==='r'&&clipboard){e.preventDefault();stampRotation=(stampRotation+1)%4;updatePasteInfo();return}if(e.shiftKey&&e.key.toLowerCase()==='h'&&clipboard){e.preventDefault();stampFlipX=!stampFlipX;updatePasteInfo();return}if(c&&e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)doRedo();else doUndo()}else if(c&&e.key.toLowerCase()==='y'){e.preventDefault();doRedo()}else if(c&&e.key.toLowerCase()==='s'){e.preventDefault();projectExport()}else if(!c){const map={b:'brush',e:'erase',i:'eyedrop',g:'bucket',l:'line',r:'rectangle',o:'ellipse',m:'select',d:'gradient'};let t=map[e.key.toLowerCase()];if(t)updateTool(t)}});window.addEventListener('resize',resizeGL);resizeObserver=new ResizeObserver(resizeGL);resizeObserver.observe($('stage'));window.addEventListener('beforeunload',()=>{if(dirty)saveLocal(true)});
 }
function addLayer(target){if(layers.length>=24)return notify('Límite de 24 capas alcanzado');remember();layers.splice(activeLayer+1,0,newLayer(target==='outer'?'Nueva capa exterior':'Nueva capa base',target));activeLayer++;updateAll()}
function moveLayer(dir){let j=activeLayer+dir;if(j<0||j>=layers.length)return;remember();[layers[activeLayer],layers[j]]=[layers[j],layers[activeLayer]];activeLayer=j;updateAll()}
function mergeLayer(){let i=activeLayer,j=i-1;if(j<0)return notify('No hay una capa inferior');let top=layers[i],bot=layers[j];if(top.target!==bot.target)return notify('Solo se combinan capas del mismo tipo (Base / Exterior)');remember();for(let p=0;p<PIXELS;p++){let a=layerPixel(bot,p),b=layerPixel(top,p);b[3]=Math.round(b[3]*top.opacity);let mix=compositeOver(a,b);bot.data.set(mix,p*4)}bot.opacity=1;layers.splice(i,1);activeLayer=j;updateAll();notify('Capas combinadas')}
async function start(){bind();initGL();updateToggles();recentColor(fg);renderSavedProjects();try{const raw=localStorage.getItem(STORE);if(raw){loadData(JSON.parse(raw));notify('Proyecto anterior recuperado');return}}catch(e){console.warn('Guardado inválido',e)}initNew();saveLocal(true)}
start();
})();
