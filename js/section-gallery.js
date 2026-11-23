/* FX Tools · imágenes personales de accesos — almacenamiento independiente. */
(()=>{
 'use strict';
 const input=document.getElementById('section-cover-file');
 if(!input)return;
 const items=[...document.querySelectorAll('[data-cover-id]')];
 const DB='FXToolsSectionCoversV1',STORE='images';
 let database=null,pending=null;
 const urls=new Map();
 const fallbackPaths={skin:'assets/sections/skin.png',crono:'assets/sections/crono.png',museo:'assets/sections/museo.png',tracker:'assets/sections/tracker.png'};
 const openDb=()=>new Promise((resolve)=>{
  if(!('indexedDB' in window))return resolve(null);
  const request=indexedDB.open(DB,1);
  request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE)};
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>resolve(null);
 });
 const get=(id)=>new Promise(resolve=>{if(!database)return resolve(null);try{const r=database.transaction(STORE).objectStore(STORE).get(id);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>resolve(null)}catch{resolve(null)}});
 const put=(id,file)=>new Promise(resolve=>{if(!database)return resolve(false);try{const t=database.transaction(STORE,'readwrite');t.objectStore(STORE).put(file,id);t.oncomplete=()=>resolve(true);t.onerror=()=>resolve(false)}catch{resolve(false)}});
 const del=(id)=>new Promise(resolve=>{if(!database)return resolve(false);try{const t=database.transaction(STORE,'readwrite');t.objectStore(STORE).delete(id);t.oncomplete=()=>resolve(true);t.onerror=()=>resolve(false)}catch{resolve(false)}});
 function setImage(id,source,removable){
  const card=items.find(el=>el.dataset.coverId===id);if(!card)return;
  const art=card.querySelector('.section-cover-art');const remove=card.querySelector('.section-cover-remove');
  if(urls.has(id)){URL.revokeObjectURL(urls.get(id));urls.delete(id)}
  art.querySelectorAll('img').forEach(img=>img.remove());
  if(!source){card.classList.remove('has-image');remove.hidden=true;return}
  const image=new Image();image.alt='';image.decoding='async';
  if(source instanceof Blob){const u=URL.createObjectURL(source);urls.set(id,u);image.src=u}
  else image.src=source;
  image.onload=()=>{card.classList.add('has-image');remove.hidden=!removable};
  image.onerror=()=>{image.remove();card.classList.remove('has-image');remove.hidden=true};
  art.prepend(image);
 }
 async function load(id){
  const existing=await get(id);
  if(existing instanceof Blob)setImage(id,existing,true);
  else setImage(id,fallbackPaths[id],false);
 }
 items.forEach(card=>{
  const id=card.dataset.coverId;
  card.querySelector('[data-cover-upload]').addEventListener('click',()=>{pending=id;input.value='';input.click()});
  card.querySelector('[data-cover-remove]').addEventListener('click',async()=>{if(await del(id))await load(id)});
 });
 input.addEventListener('change',async()=>{
  const file=input.files&&input.files[0];if(!file||!pending)return;
  if(!/^image\/(png|jpeg|webp|gif)$/.test(file.type)||file.size>8*1024*1024){alert('Usa una imagen PNG, JPG, WEBP o GIF de menos de 8 MB.');return}
  const key=pending;pending=null;
  if(await put(key,file))setImage(key,file,true);
  else alert('No se pudo guardar la imagen en este navegador. Comprueba el almacenamiento disponible.');
 });
 window.addEventListener('pagehide',()=>{for(const url of urls.values())URL.revokeObjectURL(url)});
 openDb().then(db=>{database=db;items.forEach(el=>load(el.dataset.coverId))});
})();
