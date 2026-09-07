const KEY='cobblemon.state';
const POKE_LIST_URL='https://pokeapi.co/api/v2/pokemon?limit=1302&offset=0';
const POKE_DETAIL_URL='https://pokeapi.co/api/v2/pokemon/';
const defaultState={currentRegion:'Hoenn',currentGym:1,pokemon:[]};
let state=FXStorage.get(KEY,defaultState);
if(!Array.isArray(state.pokemon)) state.pokemon=[];
let editingId=null;
let pokemonIndex=[];
let selectedDex=null;
let searchTimer=null;

const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
const titleCase=s=>String(s||'').split('-').map(x=>x?x[0].toUpperCase()+x.slice(1):'').join(' ');
const uid=()=>crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const currentMons=()=>state.pokemon.filter(p=>p.region===state.currentRegion);
const teamMons=()=>currentMons().filter(p=>p.inTeam).slice(0,6);
const save=()=>{FXStorage.set(KEY,state);render();};
const hearts=n=>[1,2,3].map(i=>`<span class="heart ${i<=Number(n)?'':'off'}">♥</span>`).join('');
const statLabel={hp:'HP',attack:'ATQ',defense:'DEF','special-attack':'AT.ESP','special-defense':'DEF.ESP',speed:'VEL'};

function cobbledexRender(id){return id?`https://cobbledex.b-cdn.net/3dmons/previews/large/${id}.webp`:'';}
function fallbackArtwork(d){return d?.sprites?.other?.['official-artwork']?.front_default || d?.sprites?.front_default || '';}
function getImage(p){return p.customImage || p.image || p.autoImage || p.fallbackImage || '';}
function pokemonImg(p,cls=''){const src=getImage(p); if(!src)return `<div class="poke-placeholder ${cls}">PKM</div>`; const fb=esc(p.fallbackImage||''); return `<img class="${cls}" src="${esc(src)}" alt="${esc(p.species)}" data-fallback="${fb}" onerror="if(this.dataset.fallback&&this.src!==this.dataset.fallback){this.src=this.dataset.fallback;this.dataset.fallback=''}else{this.outerHTML='<div class=&quot;poke-placeholder&quot;>PKM</div>'}">`;}
function typePills(types=[]){return types.map(t=>`<span class="type-pill type-${esc(t)}">${esc(titleCase(t))}</span>`).join('');}
function statsInline(stats={}){const ordered=['hp','attack','defense','special-attack','special-defense','speed'];return ordered.filter(k=>stats[k]!=null).map(k=>`<span><b>${statLabel[k]}</b><strong>${stats[k]}</strong></span>`).join('');}

async function loadPokemonIndex(){
  try{
    $('dex-status').textContent='Cargando';
    const cached=FXStorage.get('cobblemon.pokeindex',null);
    if(cached?.items?.length && Date.now()-cached.time < 1000*60*60*24*14){pokemonIndex=cached.items;$('dex-status').textContent='Listo';return;}
    const r=await fetch(POKE_LIST_URL);if(!r.ok)throw new Error('PokeAPI list');
    const j=await r.json();pokemonIndex=j.results.map((x,i)=>({name:x.name,id:Number((x.url.match(/pokemon\/(\d+)\/?$/)||[])[1])||i+1}));
    FXStorage.set('cobblemon.pokeindex',{time:Date.now(),items:pokemonIndex});$('dex-status').textContent='Listo';
  }catch(e){console.warn(e);$('dex-status').textContent='Offline';}
}
async function fetchDexPokemon(query){
  const slug=String(query).trim().toLowerCase().replace(/\s+/g,'-');
  if(!slug)return null;
  const cacheKey=`cobblemon.dex.${slug}`;const cached=FXStorage.get(cacheKey,null);if(cached)return cached;
  const r=await fetch(POKE_DETAIL_URL+encodeURIComponent(slug));if(!r.ok)throw new Error('No encontrado');
  const d=await r.json();
  const data={id:d.id,slug:d.name,species:titleCase(d.name),types:d.types.sort((a,b)=>a.slot-b.slot).map(x=>x.type.name),stats:Object.fromEntries(d.stats.map(x=>[x.stat.name,x.base_stat])),autoImage:cobbledexRender(d.id),fallbackImage:fallbackArtwork(d)};
  FXStorage.set(cacheKey,data);return data;
}

function renderSpeciesSuggestions(){
  const q=$('poke-species-search').value.trim().toLowerCase();const box=$('species-results');
  if(q.length<2){box.classList.remove('open');box.innerHTML='';return;}
  let matches=pokemonIndex.filter(p=>p.name.includes(q));
  matches.sort((a,b)=>(a.name.startsWith(q)?-1:1)-(b.name.startsWith(q)?-1:1)||a.name.length-b.name.length);
  matches=matches.slice(0,8);
  if(!matches.length){box.innerHTML='<button type="button" class="species-result muted-result">Sin coincidencias cargadas</button>';box.classList.add('open');return;}
  box.innerHTML=matches.map(p=>`<button type="button" class="species-result" data-species="${esc(p.name)}"><span>#${String(p.id).padStart(4,'0')}</span><strong>${esc(titleCase(p.name))}</strong></button>`).join('');box.classList.add('open');
  box.querySelectorAll('[data-species]').forEach(b=>b.onclick=()=>selectSpecies(b.dataset.species));
}
async function selectSpecies(name){
  $('species-results').classList.remove('open');$('species-note').textContent='Cargando ficha…';$('selected-species').classList.add('loading');
  try{selectedDex=await fetchDexPokemon(name);$('poke-species-search').value=selectedDex.species;renderSelectedSpecies();$('species-note').textContent='Ficha automática cargada. Tú solo completas los datos de tu partida.';}
  catch(e){selectedDex=null;$('species-note').textContent='No pude cargar esa especie. Comprueba la conexión o prueba otro nombre.';renderSelectedSpecies();}
  $('selected-species').classList.remove('loading');
}
function renderSelectedSpecies(){
  const box=$('selected-species');
  if(!selectedDex){box.innerHTML='<div class="selected-visual"><span>PKM</span></div><div><strong>Sin especie seleccionada</strong><small>Los stats y tipos aparecerán aquí.</small></div>';return;}
  const tmp={species:selectedDex.species,autoImage:selectedDex.autoImage,fallbackImage:selectedDex.fallbackImage};
  box.innerHTML=`<div class="selected-visual">${pokemonImg(tmp)}</div><div class="selected-info"><div class="dex-heading"><strong>${esc(selectedDex.species)}</strong><span>#${String(selectedDex.id).padStart(4,'0')}</span></div><div class="type-row">${typePills(selectedDex.types)}</div><div class="mini-stats">${statsInline(selectedDex.stats)}</div></div>`;
}

function renderTeam(){
  const wrap=$('team-grid'),mons=teamMons();wrap.innerHTML='';$('team-count').textContent=`${mons.length} / 6`;
  mons.forEach(p=>{
    const card=document.createElement('div');card.className=`poke-card selected ${Number(p.lives)===0?'dead':''}`;
    card.innerHTML=`<div class="poke-card-head"><div><div class="poke-name">${esc(p.nickname||p.species)}</div><div class="poke-species">${esc(p.species)}${p.level?` · Nv. ${esc(p.level)}`:''}</div></div><button class="more-btn" data-edit="${p.id}" title="Editar">•••</button></div><div class="poke-visual">${pokemonImg(p)}</div><div class="type-row compact">${typePills(p.types)}</div><div class="lives-row"><div class="lives">${hearts(p.lives)}</div><span class="life-label ${Number(p.lives)===0?'out':''}">${Number(p.lives)===0?'INUTILIZABLE':`${p.lives}/3`}</span></div><div class="life-controls"><button class="life-btn danger" data-life="-1" data-id="${p.id}" ${Number(p.lives)===0?'disabled':''}>−</button><span>VIDA</span><button class="life-btn" data-life="1" data-id="${p.id}" ${Number(p.lives)===3?'disabled':''}>+</button></div>`;
    wrap.appendChild(card);
  });
  for(let i=mons.length;i<6;i++){const slot=document.createElement('button');slot.className='empty-team-slot';slot.innerHTML='<span>+</span><small>Añadir al equipo</small>';slot.onclick=()=>openEdit();wrap.appendChild(slot);}
  wrap.querySelectorAll('[data-life]').forEach(b=>b.onclick=()=>changeLife(b.dataset.id,Number(b.dataset.life)));
  wrap.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openEdit(b.dataset.edit));
}
function renderList(){
  const q=$('poke-search').value.trim().toLowerCase(),region=$('filter-region').value,list=$('pokemon-list');list.innerHTML='';
  const seriesCount=$('series-count'); if(seriesCount) seriesCount.textContent=String(state.pokemon.length);
  const mons=state.pokemon.filter(p=>(region==='all'||p.region===region)&&(!q||`${p.nickname||''} ${p.species||''}`.toLowerCase().includes(q)));
  mons.forEach(p=>{
    const row=document.createElement('div');row.className=`list-row ${Number(p.lives)===0?'row-dead':''}`;
    row.innerHTML=`<div class="list-mon"><div class="list-thumb">${pokemonImg(p)}</div><div class="row-title"><strong>${esc(p.nickname||p.species)}</strong><span>${esc(p.species)} · ${esc(p.region)}${p.level?` · Nv. ${esc(p.level)}`:''}</span><div class="type-row tiny">${typePills(p.types)}</div></div></div><div class="list-stats">${statsInline(p.stats)}</div><div class="list-lives">${hearts(p.lives)}<small>${Number(p.lives)?'Activo':'Inutilizable'}</small></div><div class="list-flags">${p.inTeam?'<span class="badge live">Equipo</span>':''}${p.champion?'<span class="badge warn">🏆</span>':''}</div><div class="row-actions"><button class="btn small" data-team="${p.id}">${p.inTeam?'Quitar':'Equipo'}</button><button class="btn small" data-edit="${p.id}">Editar</button></div>`;
    list.appendChild(row);
  });
  if(!mons.length)list.innerHTML='<div class="empty">No hay Pokémon que coincidan con el filtro.</div>';
  list.querySelectorAll('[data-team]').forEach(b=>b.onclick=()=>toggleTeam(b.dataset.team));list.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openEdit(b.dataset.edit));
}
function renderRegions(){
  $('region-cards').innerHTML=['Kanto','Johto','Hoenn'].map(r=>{
    const champs=state.pokemon.filter(p=>p.region===r&&p.champion).slice(0,6);
    const slots=Array.from({length:6},(_,i)=>{const p=champs[i];return p?`<div class="champion-mon"><div class="champion-img">${pokemonImg(p)}</div><b>${esc(p.nickname||p.species)}</b><small>${esc(p.species)}</small></div>`:`<div class="champion-mon empty-champ"><div class="champion-img">—</div><b>VACÍO</b><small>—</small></div>`;}).join('');
    return `<div class="region-card ${r===state.currentRegion?'current':''}"><div class="region-head"><div><strong>${r}</strong><p>${r===state.currentRegion?'REGIÓN ACTUAL':'HISTORIAL'}</p></div><span>🏆 ${champs.length}/6</span></div><div class="champion-grid">${slots}</div></div>`;
  }).join('');
}
function renderPreview(){
  $('preview-region').textContent=state.currentRegion.toUpperCase();$('preview-gym').textContent=`GIMNASIO ${state.currentGym}`;const mons=teamMons();
  $('preview-team').innerHTML=Array.from({length:6},(_,i)=>{const p=mons[i];return p?`<div class="preview-mon"><div class="dot">${pokemonImg(p)}</div><b>${esc(p.nickname||p.species)}</b><span>${'♥'.repeat(Number(p.lives))}${'♡'.repeat(3-Number(p.lives))}</span></div>`:`<div class="preview-mon"><div class="dot">—</div><b>VACÍO</b><span>♡♡♡</span></div>`;}).join('');
}
let newlyUnusableId=null;
function renderUnusable(){
  const mons=state.pokemon.filter(p=>Number(p.lives)===0);
  const count=$('unusable-count'), list=$('unusable-list');
  if(count) count.textContent=String(mons.length);
  if(!list) return;
  if(!mons.length){list.innerHTML='<div class="unusable-empty">Todavía no hay Pokémon inutilizables.</div>';return;}
  list.innerHTML=mons.map(p=>`<div class="unusable-card ${p.id===newlyUnusableId?'just-out':''}"><div class="unusable-visual">${pokemonImg(p)}</div><div class="unusable-info"><b>${esc(p.nickname||p.species)}</b><span>${esc(p.species)} · ${esc(p.region)}</span><small>♡♡♡ · ${p.outGym?`INUTILIZABLE EN GYM ${p.outGym}`:'INUTILIZABLE'}</small></div></div>`).join('');
  if(newlyUnusableId) setTimeout(()=>{newlyUnusableId=null;},900);
}

function render(){
  $('current-region').value=state.currentRegion;$('gym-number').value=state.currentGym;renderTeam();renderList();renderRegions();renderPreview();renderUnusable();
}
function toggleTeam(id){const p=state.pokemon.find(x=>x.id===id);if(!p)return;if(Number(p.lives)===0&&!p.inTeam){alert('Este Pokémon está inutilizable y no puede volver al equipo.');return;}if(!p.inTeam&&state.pokemon.filter(x=>x.region===p.region&&x.inTeam).length>=6){alert('El equipo de esa región ya tiene 6 Pokémon.');return;}p.inTeam=!p.inTeam;save();}
function changeLife(id,delta){const p=state.pokemon.find(x=>x.id===id);if(!p)return;const before=Number(p.lives);p.lives=Math.max(0,Math.min(3,before+delta));if(delta<0&&p.lives<before){p.lifeHistory=Array.isArray(p.lifeHistory)?p.lifeHistory:[];p.lifeHistory.push({gym:state.currentGym,region:state.currentRegion,remaining:p.lives,at:new Date().toISOString()});}if(p.lives===0){p.inTeam=false;p.outGym=p.outGym||state.currentGym;if(before>0)newlyUnusableId=p.id;}else if(before===0&&delta>0){p.outGym=null;}save();}

function resetModal(){selectedDex=null;$('poke-species-search').value='';$('poke-nickname').value='';$('poke-region').value=state.currentRegion;$('poke-lives').value='3';$('poke-level').value='';$('poke-image').value='';$('poke-team').checked=false;$('poke-champion').checked=false;$('species-results').innerHTML='';$('species-results').classList.remove('open');$('species-note').textContent='Escribe al menos 2 letras y selecciona un resultado.';renderSelectedSpecies();}
function openEdit(id=null){
  editingId=id;resetModal();const p=id?state.pokemon.find(x=>x.id===id):null;$('poke-modal-title').textContent=p?'Editar Pokémon':'Añadir Pokémon';$('delete-poke').style.display=p?'inline-flex':'none';
  if(p){selectedDex={id:p.dexId||null,slug:p.slug||String(p.species).toLowerCase(),species:p.species,types:p.types||[],stats:p.stats||{},autoImage:p.autoImage||p.image||'',fallbackImage:p.fallbackImage||''};$('poke-species-search').value=p.species;$('poke-nickname').value=p.nickname||'';$('poke-region').value=p.region;$('poke-lives').value=String(p.lives??3);$('poke-level').value=p.level||'';$('poke-image').value=p.customImage||'';$('poke-team').checked=!!p.inTeam;$('poke-champion').checked=!!p.champion;$('species-note').textContent='Especie guardada. Puedes cambiarla buscando otra.';renderSelectedSpecies();}
  const modal=$('modal-pokemon');
  if(typeof modal.showModal==='function'){ if(!modal.open) modal.showModal(); } else { modal.classList.add('open'); }
  setTimeout(()=>$('poke-species-search').focus(),50);
}
function closeEdit(){const modal=$('modal-pokemon'); if(typeof modal.close==='function' && modal.open){modal.close();} else {modal.classList.remove('open');} editingId=null;selectedDex=null;}
function persistFromModal(){
  if(!selectedDex?.species){alert('Selecciona una especie de la búsqueda.');return;}
  const data={species:selectedDex.species,slug:selectedDex.slug,dexId:selectedDex.id,types:selectedDex.types||[],stats:selectedDex.stats||{},autoImage:selectedDex.autoImage||'',fallbackImage:selectedDex.fallbackImage||'',customImage:$('poke-image').value.trim(),nickname:$('poke-nickname').value.trim(),region:$('poke-region').value,level:$('poke-level').value.trim(),lives:Number($('poke-lives').value),inTeam:$('poke-team').checked,champion:$('poke-champion').checked};if(data.lives===0)data.inTeam=false;
  data.image=data.customImage||data.autoImage||data.fallbackImage||'';
  if(data.inTeam){const otherTeam=state.pokemon.filter(p=>p.region===data.region&&p.inTeam&&p.id!==editingId);if(otherTeam.length>=6){alert('Esa región ya tiene 6 Pokémon en el equipo actual.');return;}}
  if(editingId){const target=state.pokemon.find(p=>p.id===editingId);if(target)Object.assign(target,data);}else state.pokemon.push({id:uid(),...data});closeEdit();save();
}
function migrateOldData(){
  let changed=false;state.pokemon.forEach(p=>{if(p.lives==null){p.lives=3;changed=true;}if(!p.types)p.types=[];if(!p.stats)p.stats={};if(p.image&&!p.customImage&&!p.autoImage){p.customImage=p.image;changed=true;}});if(changed)FXStorage.set(KEY,state);
}

document.addEventListener('DOMContentLoaded',()=>{
  migrateOldData();render();loadPokemonIndex();
  // Modal robusto: funciona tanto alojado en GitHub Pages como abriendo index.html localmente.
  document.addEventListener('click',e=>{
    const addBtn=e.target.closest('#add-pokemon, #add-pokemon-secondary, .empty-team-slot');
    if(addBtn && !addBtn.classList.contains('empty-team-slot')){ e.preventDefault(); openEdit(); }
  });
  const modal=$('modal-pokemon');
  modal.addEventListener('click',e=>{ if(e.target===modal) closeEdit(); });
  $('add-pokemon').onclick=()=>openEdit();$('add-pokemon-secondary').onclick=()=>openEdit();$('close-poke').onclick=closeEdit;$('cancel-poke').onclick=closeEdit;$('save-poke').onclick=persistFromModal;
  $('delete-poke').onclick=()=>{if(!editingId)return;if(confirm('¿Eliminar este Pokémon del tracker?')){state.pokemon=state.pokemon.filter(p=>p.id!==editingId);closeEdit();save();}};
  $('poke-search').oninput=renderList;$('filter-region').onchange=renderList;
  $('current-region').onchange=e=>{state.currentRegion=e.target.value;save();};$('gym-number').onchange=e=>{state.currentGym=Math.max(1,Math.min(8,Number(e.target.value)||1));save();};
  $('overlay-popout').onclick=()=>window.open('overlay/','FXCobbleOverlay','width=1200,height=360');
  $('poke-species-search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(renderSpeciesSuggestions,80);});
  $('poke-species-search').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();const first=$('species-results').querySelector('[data-species]');if(first)selectSpecies(first.dataset.species);}});
  $('restore-auto-image').onclick=()=>{$('poke-image').value='';};
  document.addEventListener('click',e=>{if(!e.target.closest('.species-search-wrap'))$('species-results').classList.remove('open');});
});
