const KEY='cobblemon.state';
const POKE_LIST_URL='https://pokeapi.co/api/v2/pokemon?limit=1302&offset=0';
const POKE_DETAIL_URL='https://pokeapi.co/api/v2/pokemon/';
const defaultState={currentRegion:'Hoenn',currentGym:1,pokemon:[],usedByRegion:{Kanto:[],Johto:[],Hoenn:[]},regionSettings:{Kanto:{maxLives:3},Johto:{maxLives:3},Hoenn:{maxLives:3}},imageOverrides:{}};
let state=FXStorage.get(KEY,defaultState);
if(!Array.isArray(state.pokemon)) state.pokemon=[];
const REGIONS=['Kanto','Johto','Hoenn'];
if(!state.usedByRegion) state.usedByRegion={Kanto:[],Johto:[],Hoenn:[]};
if(!state.regionSettings) state.regionSettings={Kanto:{maxLives:3},Johto:{maxLives:3},Hoenn:{maxLives:3}};
if(!state.imageOverrides) state.imageOverrides={};
let editingId=null;
let pokemonIndex=[];
let selectedDex=null;
let searchTimer=null;
let statsOpenId=null;
let statsContext='team';

const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
const titleCase=s=>String(s||'').split('-').map(x=>x?x[0].toUpperCase()+x.slice(1):'').join(' ');
const uid=()=>crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const currentMons=()=>state.pokemon.filter(p=>p.region===state.currentRegion);
const teamMons=()=>currentMons().filter(p=>p.inTeam).slice(0,6);
const save=()=>{FXStorage.set(KEY,state);render();};
const slugify=s=>String(s||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[♀]/g,'-f').replace(/[♂]/g,'-m').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const maxLives=r=>Math.max(1,Number(state.regionSettings?.[r]?.maxLives)||3);
const hearts=(n,max=3,id=null)=>Array.from({length:max},(_,i)=>id?`<button type="button" class="heart heart-btn ${i<Number(n)?'':'off'}" data-heart-id="${esc(id)}" data-heart-value="${i+1}" title="${i<Number(n)?`Quitar vida ${i+1}`:`Restaurar hasta ${i+1} ${i===0?'vida':'vidas'}`}" aria-label="Cambiar a ${i<Number(n)?i:i+1} vidas">♥</button>`:`<span class="heart ${i<Number(n)?'':'off'}">♥</span>`).join('');
const regionBefore=(a,b)=>REGIONS.indexOf(a)>=0&&REGIONS.indexOf(b)>=0&&REGIONS.indexOf(a)<REGIONS.indexOf(b);
const usedInPriorRegion=(slug,region)=>REGIONS.find(r=>regionBefore(r,region)&&(state.usedByRegion?.[r]||[]).includes(slug));
const addUsed=(region,slug)=>{if(!region||!slug)return;state.usedByRegion[region]=Array.isArray(state.usedByRegion[region])?state.usedByRegion[region]:[];if(!state.usedByRegion[region].includes(slug))state.usedByRegion[region].push(slug);};
const statLabel={hp:'HP',attack:'ATQ',defense:'DEF','special-attack':'AT.ESP','special-defense':'DEF.ESP',speed:'VEL'};

function cobbledexRender(id){return id?`https://cobbledex.b-cdn.net/3dmons/previews/large/${id}.webp`:'';}
function fallbackArtwork(d){return d?.sprites?.other?.['official-artwork']?.front_default || d?.sprites?.other?.home?.front_default || d?.sprites?.front_default || '';}
function imageCandidates(p){
  const slug=p.slug||slugify(p.species);
  const override=state.imageOverrides?.[slug]||'';
  return [...new Set([override,p.customImage,p.image,p.autoImage,p.fallbackImage,...(p.imageCandidates||[])].filter(Boolean))];
}
function getImage(p){return imageCandidates(p)[0]||'';}
window.fxImgFallback=function(img){try{const arr=JSON.parse(decodeURIComponent(img.dataset.candidates||'%5B%5D'));let i=Number(img.dataset.idx||0)+1;if(i<arr.length){img.dataset.idx=String(i);img.src=arr[i];return;}img.replaceWith(Object.assign(document.createElement('div'),{className:'poke-placeholder',textContent:'PKM'}));}catch{img.style.display='none';}};
function pokemonImg(p,cls=''){const arr=imageCandidates(p);if(!arr.length)return `<div class="poke-placeholder ${cls}">PKM</div>`;return `<img class="${cls}" src="${esc(arr[0])}" alt="${esc(p.species)}" data-idx="0" data-candidates="${esc(encodeURIComponent(JSON.stringify(arr)))}" onerror="window.fxImgFallback(this)">`;}
function typePills(types=[]){return types.map(t=>`<span class="type-pill type-${esc(t)}">${esc(titleCase(t))}</span>`).join('');}
function statsInline(stats={}){const ordered=['hp','attack','defense','special-attack','special-defense','speed'];return ordered.filter(k=>stats[k]!=null).map(k=>`<span><b>${statLabel[k]}</b><strong>${stats[k]}</strong></span>`).join('');}
const STAT_ORDER=['hp','attack','defense','special-attack','special-defense','speed'];
function statBars(stats={}){return STAT_ORDER.map(k=>{const raw=Number(stats?.[k]);const value=Number.isFinite(raw)?raw:0;const pct=Math.max(0,Math.min(100,(value/255)*100));return `<div class="base-stat-row"><div class="base-stat-label"><span>${statLabel[k]}</span><strong>${value||'—'}</strong></div><div class="base-stat-track"><span style="width:${value?Math.max(3,pct):0}%"></span></div></div>`;}).join('');}
function hasStats(p){return STAT_ORDER.some(k=>Number.isFinite(Number(p?.stats?.[k])));}

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
  const candidates=[cobbledexRender(d.id),d?.sprites?.other?.['official-artwork']?.front_default,d?.sprites?.other?.home?.front_default,d?.sprites?.front_default].filter(Boolean);const data={id:d.id,slug:d.name,species:titleCase(d.name),types:d.types.sort((a,b)=>a.slot-b.slot).map(x=>x.type.name),stats:Object.fromEntries(d.stats.map(x=>[x.stat.name,x.base_stat])),autoImage:candidates[0]||'',fallbackImage:candidates[1]||candidates[2]||'',imageCandidates:candidates};
  FXStorage.set(cacheKey,data);return data;
}

function renderSpeciesSuggestions(){
  const q=$('poke-species-search').value.trim().toLowerCase();const box=$('species-results');
  if(q.length<2){box.classList.remove('open');box.innerHTML='';return;}
  let matches=pokemonIndex.filter(p=>p.name.includes(q));
  matches.sort((a,b)=>(a.name.startsWith(q)?-1:1)-(b.name.startsWith(q)?-1:1)||a.name.length-b.name.length);
  matches=matches.slice(0,8);
  if(!matches.length){box.innerHTML='<button type="button" class="species-result muted-result">Sin coincidencias cargadas</button>';box.classList.add('open');return;}
  box.innerHTML=matches.map(p=>{const blocked=usedInPriorRegion(p.name,$('poke-region').value||state.currentRegion);return `<button type="button" class="species-result ${blocked?'blocked-result':''}" data-species="${esc(p.name)}"><span>#${String(p.id).padStart(4,'0')}</span><strong>${esc(titleCase(p.name))}${blocked?` <em>USADO · ${esc(blocked.toUpperCase())}</em>`:''}</strong></button>`;}).join('');box.classList.add('open');
  box.querySelectorAll('[data-species]').forEach(b=>b.onclick=()=>selectSpecies(b.dataset.species));
}
async function selectSpecies(name){
  $('species-results').classList.remove('open');$('species-note').textContent='Cargando ficha…';$('selected-species').classList.add('loading');
  try{selectedDex=await fetchDexPokemon(name);$('poke-species-search').value=selectedDex.species;renderSelectedSpecies();const blocked=usedInPriorRegion(selectedDex.slug,$('poke-region').value||state.currentRegion);$('species-note').textContent=blocked?`No disponible: ya fue utilizado en ${blocked}.`:'Ficha automática cargada.';}
  catch(e){selectedDex=null;$('species-note').textContent='No pude cargar esa especie. Comprueba la conexión o prueba otro nombre.';renderSelectedSpecies();}
  $('selected-species').classList.remove('loading');
}
function renderSelectedSpecies(){
  const box=$('selected-species');
  if(!selectedDex){box.innerHTML='<div class="selected-visual"><span>PKM</span></div><div><strong>Sin especie seleccionada</strong><small>Los stats y tipos aparecerán aquí.</small></div>';return;}
  const tmp={species:selectedDex.species,slug:selectedDex.slug,autoImage:selectedDex.autoImage,fallbackImage:selectedDex.fallbackImage,imageCandidates:selectedDex.imageCandidates||[]};
  box.innerHTML=`<div class="selected-visual">${pokemonImg(tmp)}</div><div class="selected-info"><div class="dex-heading"><strong>${esc(selectedDex.species)}</strong><span>#${String(selectedDex.id).padStart(4,'0')}</span></div><div class="type-row">${typePills(selectedDex.types)}</div><div class="mini-stats">${statsInline(selectedDex.stats)}</div></div>`;
}

function renderTeam(){
  const wrap=$('team-grid'),mons=teamMons();wrap.innerHTML='';$('team-count').textContent=`${mons.length} / 6`;
  mons.forEach(p=>{
    const card=document.createElement('div');card.className=`poke-card selected ${Number(p.lives)===0?'dead':''}`;
    card.innerHTML=`<div class="poke-card-head"><button type="button" class="team-name-button" data-stats="${p.id}" title="Ver stats base"><div class="poke-name">${esc(p.nickname||p.species)}</div><div class="poke-species">${esc(p.species)}${p.level?` · Nv. ${esc(p.level)}`:''}</div></button><button class="more-btn" data-edit="${p.id}" title="Editar">•••</button></div><button type="button" class="poke-visual stats-visual-button" data-stats="${p.id}" title="Ver stats base">${pokemonImg(p)}</button><div class="type-row compact">${typePills(p.types)}</div><div class="lives-row"><div class="lives clickable-lives">${hearts(p.lives,maxLives(p.region),p.id)}</div><span class="life-label ${Number(p.lives)===0?'out':''}">${Number(p.lives)===0?'INUTILIZABLE':`${p.lives}/${maxLives(p.region)}`}</span></div><div class="heart-hint">Nombre o imagen: stats · corazones: vidas</div>`;
    wrap.appendChild(card);
  });
  for(let i=mons.length;i<6;i++){const slot=document.createElement('button');slot.className='empty-team-slot';slot.innerHTML='<span>+</span><small>Añadir al equipo</small>';slot.onclick=()=>openEdit();wrap.appendChild(slot);}
  wrap.querySelectorAll('[data-heart-id]').forEach(b=>b.onclick=()=>setLifeFromHeart(b.dataset.heartId,Number(b.dataset.heartValue)));
  wrap.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openEdit(b.dataset.edit));
  wrap.querySelectorAll('[data-stats]').forEach(b=>b.onclick=()=>openStats(b.dataset.stats,'team'));
}

function renderList(){
  const q=$('poke-search').value.trim().toLowerCase(),region=$('filter-region').value,list=$('pokemon-list');list.innerHTML='';
  const seriesCount=$('series-count'); if(seriesCount) seriesCount.textContent=String(state.pokemon.length);
  const mons=state.pokemon.filter(p=>(region==='all'||p.region===region)&&(!q||`${p.nickname||''} ${p.species||''}`.toLowerCase().includes(q)));
  mons.forEach(p=>{
    const row=document.createElement('div');row.className=`list-row ${Number(p.lives)===0?'row-dead':''}`;
    row.innerHTML=`<button type="button" class="list-mon list-mon-button" data-stats="${p.id}" title="Abrir stats base"><div class="list-thumb">${pokemonImg(p)}</div><div class="row-title"><strong>${esc(p.nickname||p.species)}</strong><span>${esc(p.species)} · ${esc(p.region)}${p.level?` · Nv. ${esc(p.level)}`:''}</span><div class="type-row tiny">${typePills(p.types)}</div></div></button><button type="button" class="list-stats list-stats-button" data-stats="${p.id}" title="Abrir stats base">${statsInline(p.stats)}</button><div class="list-lives clickable-lives">${hearts(p.lives,maxLives(p.region),p.id)}<small>${Number(p.lives)?'Activo':'Inutilizable'}</small></div><div class="list-flags">${p.inTeam?'<span class="badge live">Equipo</span>':''}${p.champion?'<span class="badge warn">🏆</span>':''}</div><div class="row-actions"><button class="btn small" data-team="${p.id}">${p.inTeam?'Quitar':'Equipo'}</button><button class="btn small" data-edit="${p.id}">Editar</button></div>`;
    list.appendChild(row);
  });
  if(!mons.length)list.innerHTML='<div class="empty">No hay Pokémon que coincidan con el filtro.</div>';
  list.querySelectorAll('[data-team]').forEach(b=>b.onclick=()=>toggleTeam(b.dataset.team));
  list.querySelectorAll('[data-heart-id]').forEach(b=>b.onclick=()=>setLifeFromHeart(b.dataset.heartId,Number(b.dataset.heartValue)));
  list.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openEdit(b.dataset.edit));
  list.querySelectorAll('[data-stats]').forEach(b=>b.onclick=()=>openStats(b.dataset.stats,'registry'));
}

function renderRegions(){
  $('region-cards').innerHTML=['Kanto','Johto','Hoenn'].map(r=>{
    const champs=state.pokemon.filter(p=>p.region===r&&p.champion).slice(0,6);
    const slots=Array.from({length:6},(_,i)=>{const p=champs[i];return p?`<div class="champion-mon"><div class="champion-img">${pokemonImg(p)}</div><b>${esc(p.nickname||p.species)}</b><small>${esc(p.species)}</small></div>`:`<div class="champion-mon empty-champ"><div class="champion-img">—</div><b>VACÍO</b><small>—</small></div>`;}).join('');
    const used=(state.usedByRegion?.[r]||[]).length;const outs=state.pokemon.filter(p=>p.region===r&&Number(p.lives)===0).length;return `<div class="region-card ${r===state.currentRegion?'current':''}"><div class="region-head"><div><strong>${r}</strong><p>${r===state.currentRegion?'REGIÓN ACTUAL':'HISTORIAL'} · ${used} utilizados · ${outs} inutilizables</p></div><span>🏆 ${champs.length}/6</span></div><div class="champion-grid">${slots}</div></div>`;
  }).join('');
}
function renderPreview(){
  $('preview-region').textContent=state.currentRegion.toUpperCase();$('preview-gym').textContent=`GIMNASIO ${state.currentGym}`;const mons=teamMons();
  $('preview-team').innerHTML=Array.from({length:6},(_,i)=>{const p=mons[i];return p?`<div class="preview-mon"><div class="dot">${pokemonImg(p)}</div><b>${esc(p.nickname||p.species)}</b><span>${'♥'.repeat(Number(p.lives))}${'♡'.repeat(Math.max(0,maxLives(p.region)-Number(p.lives)))}</span></div>`:`<div class="preview-mon"><div class="dot">—</div><b>VACÍO</b><span>${'♡'.repeat(maxLives(state.currentRegion))}</span></div>`;}).join('');
}
let newlyUnusableId=null;
function renderUnusable(){
  const mons=state.pokemon.filter(p=>Number(p.lives)===0);
  const count=$('unusable-count'), list=$('unusable-list');
  if(count) count.textContent=String(mons.length);
  if(!list) return;
  if(!mons.length){list.innerHTML='<div class="unusable-empty">Todavía no hay Pokémon inutilizables.</div>';return;}
  list.innerHTML=mons.map(p=>`<div class="unusable-card ${p.id===newlyUnusableId?'just-out':''}"><div class="unusable-visual">${pokemonImg(p)}</div><div class="unusable-info"><b>${esc(p.nickname||p.species)}</b><span>${esc(p.species)} · ${esc(p.region)}</span><small>♡♡♡ · INUTILIZABLE · ${esc(p.outRegion||p.region)}</small></div></div>`).join('');
  if(newlyUnusableId) setTimeout(()=>{newlyUnusableId=null;},900);
}

function render(){
  $('current-region').value=state.currentRegion;$('gym-number').value=state.currentGym;renderTeam();renderList();renderRegions();renderPreview();renderUnusable();
}
function toggleTeam(id){const p=state.pokemon.find(x=>x.id===id);if(!p)return;if(Number(p.lives)===0&&!p.inTeam){alert('Este Pokémon está inutilizable y no puede volver al equipo.');return;}if(!p.inTeam&&state.pokemon.filter(x=>x.region===p.region&&x.inTeam).length>=6){alert('El equipo de esa región ya tiene 6 Pokémon.');return;}p.inTeam=!p.inTeam;save();}
function setLife(id,value){const p=state.pokemon.find(x=>x.id===id);if(!p)return;const before=Number(p.lives);const next=Math.max(0,Math.min(maxLives(p.region),Number(value)));if(next===before)return;p.lives=next;if(next<before){p.lifeHistory=Array.isArray(p.lifeHistory)?p.lifeHistory:[];p.lifeHistory.push({region:p.region||state.currentRegion,remaining:p.lives,at:new Date().toISOString()});}if(p.lives===0){p.inTeam=false;p.outRegion=p.outRegion||p.region||state.currentRegion;if(before>0)newlyUnusableId=p.id;}else if(before===0&&next>0){p.outRegion=null;}save();}
function setLifeFromHeart(id,heartValue){const p=state.pokemon.find(x=>x.id===id);if(!p)return;const current=Number(p.lives);setLife(id,current===heartValue?heartValue-1:heartValue);}
function changeLife(id,delta){const p=state.pokemon.find(x=>x.id===id);if(!p)return;setLife(id,Number(p.lives)+Number(delta));}

async function ensurePokemonStats(p){
  if(!p||hasStats(p)||!p.slug)return p;
  try{
    const d=await fetchDexPokemon(p.slug);
    p.dexId=p.dexId||d.id;p.types=(p.types&&p.types.length)?p.types:d.types;p.stats=d.stats||{};p.autoImage=p.autoImage||d.autoImage;p.fallbackImage=p.fallbackImage||d.fallbackImage;p.imageCandidates=(p.imageCandidates&&p.imageCandidates.length)?p.imageCandidates:d.imageCandidates;
    FXStorage.set(KEY,state);
  }catch(e){console.warn('No se pudieron cargar stats para',p.species,e);}
  return p;
}
function statsNavMons(){return statsContext==='team'?teamMons():[];}
function renderStatsModal(){
  const p=state.pokemon.find(x=>x.id===statsOpenId);const body=$('stats-modal-body'),nav=$('stats-modal-nav');if(!p||!body)return;
  const dex=p.dexId?`#${String(p.dexId).padStart(4,'0')}`:'';
  body.innerHTML=`<div class="stats-hero"><div class="stats-hero-visual">${pokemonImg(p)}</div><div class="stats-identity"><div class="stats-kicker">${esc(p.region)}${dex?` · ${dex}`:''}</div><h2>${esc(p.nickname||p.species)}</h2>${p.nickname?`<div class="stats-species-name">${esc(p.species)}</div>`:''}<div class="type-row stats-types">${typePills(p.types)}</div><div class="stats-life-summary"><span>${hearts(p.lives,maxLives(p.region))}</span><strong>${Number(p.lives)===0?'INUTILIZABLE':`${p.lives}/${maxLives(p.region)} vidas`}</strong></div></div></div><div class="base-stats-panel"><div class="base-stats-title"><strong>STATS BASE</strong><span>Total ${STAT_ORDER.reduce((sum,k)=>sum+(Number(p.stats?.[k])||0),0)}</span></div><div class="base-stats-list">${statBars(p.stats)}</div></div>`;
  const mons=statsNavMons();const pos=mons.findIndex(x=>x.id===p.id);if(statsContext==='team'&&pos>=0&&mons.length>1){nav.hidden=false;$('stats-position').textContent=`${pos+1} / ${mons.length}`;$('stats-prev').disabled=false;$('stats-next').disabled=false;}else{nav.hidden=true;}
}
async function openStats(id,context='team'){
  const p=state.pokemon.find(x=>x.id===id);if(!p)return;statsOpenId=id;statsContext=context;const modal=$('modal-stats');renderStatsModal();if(typeof modal.showModal==='function'){if(!modal.open)modal.showModal();}else modal.classList.add('open');
  if(!hasStats(p)){await ensurePokemonStats(p);renderStatsModal();renderList();}
}
function closeStats(){const modal=$('modal-stats');if(typeof modal.close==='function'&&modal.open)modal.close();else modal.classList.remove('open');statsOpenId=null;}
function moveStats(delta){const mons=statsNavMons();if(!mons.length)return;let i=mons.findIndex(x=>x.id===statsOpenId);if(i<0)i=0;i=(i+delta+mons.length)%mons.length;statsOpenId=mons[i].id;renderStatsModal();ensurePokemonStats(mons[i]).then(()=>renderStatsModal());}

function resetModal(){selectedDex=null;$('poke-species-search').value='';$('poke-nickname').value='';$('poke-region').value=state.currentRegion;refreshLivesSelect(state.currentRegion);$('poke-lives').value=String(maxLives(state.currentRegion));$('poke-level').value='';$('poke-image').value='';$('poke-team').checked=false;$('poke-champion').checked=false;$('species-results').innerHTML='';$('species-results').classList.remove('open');$('species-note').textContent='Escribe al menos 2 letras y selecciona un resultado.';renderSelectedSpecies();}
function openEdit(id=null){
  editingId=id;resetModal();const p=id?state.pokemon.find(x=>x.id===id):null;$('poke-modal-title').textContent=p?'Editar Pokémon':'Añadir Pokémon';$('delete-poke').style.display=p?'inline-flex':'none';
  if(p){selectedDex={id:p.dexId||null,slug:p.slug||String(p.species).toLowerCase(),species:p.species,types:p.types||[],stats:p.stats||{},autoImage:p.autoImage||p.image||'',fallbackImage:p.fallbackImage||'',imageCandidates:p.imageCandidates||[]};$('poke-species-search').value=p.species;$('poke-nickname').value=p.nickname||'';$('poke-region').value=p.region;$('poke-lives').value=String(p.lives??3);$('poke-level').value=p.level||'';$('poke-image').value=p.customImage||'';$('poke-team').checked=!!p.inTeam;$('poke-champion').checked=!!p.champion;$('species-note').textContent='Especie guardada. Puedes cambiarla buscando otra.';renderSelectedSpecies();}
  const modal=$('modal-pokemon');
  if(typeof modal.showModal==='function'){ if(!modal.open) modal.showModal(); } else { modal.classList.add('open'); }
  setTimeout(()=>$('poke-species-search').focus(),50);
}
function closeEdit(){const modal=$('modal-pokemon'); if(typeof modal.close==='function' && modal.open){modal.close();} else {modal.classList.remove('open');} editingId=null;selectedDex=null;}
function persistFromModal(){
  if(!selectedDex?.species){alert('Selecciona una especie de la búsqueda.');return;}
  const data={species:selectedDex.species,slug:selectedDex.slug,dexId:selectedDex.id,types:selectedDex.types||[],stats:selectedDex.stats||{},autoImage:selectedDex.autoImage||'',fallbackImage:selectedDex.fallbackImage||'',imageCandidates:selectedDex.imageCandidates||[],customImage:$('poke-image').value.trim(),nickname:$('poke-nickname').value.trim(),region:$('poke-region').value,level:$('poke-level').value.trim(),lives:Number($('poke-lives').value),inTeam:$('poke-team').checked,champion:$('poke-champion').checked};if(data.lives===0)data.inTeam=false;
  data.image=data.customImage||data.autoImage||data.fallbackImage||'';
  const blockedRegion=usedInPriorRegion(data.slug,data.region);if(blockedRegion){alert(`Este Pokémon ya fue utilizado en ${blockedRegion} y no está disponible en ${data.region}.`);return;}
  if(data.customImage) state.imageOverrides[data.slug]=data.customImage;
  addUsed(data.region,data.slug);
  if(data.champion) addUsed(data.region,data.slug);
  if(data.inTeam){const otherTeam=state.pokemon.filter(p=>p.region===data.region&&p.inTeam&&p.id!==editingId);if(otherTeam.length>=6){alert('Esa región ya tiene 6 Pokémon en el equipo actual.');return;}}
  if(editingId){const target=state.pokemon.find(p=>p.id===editingId);if(target)Object.assign(target,data);}else state.pokemon.push({id:uid(),...data});closeEdit();save();
}
function migrateOldData(){let changed=false;REGIONS.forEach(r=>{if(!Array.isArray(state.usedByRegion[r])){state.usedByRegion[r]=[];changed=true;}if(!state.regionSettings[r]){state.regionSettings[r]={maxLives:3};changed=true;}});state.pokemon.forEach(p=>{if('outGym' in p){delete p.outGym;changed=true;}if(p.lives==null){p.lives=maxLives(p.region);changed=true;}if(!p.slug){p.slug=slugify(p.species);changed=true;}if(!p.types)p.types=[];if(!p.stats)p.stats={};if(p.image&&!p.customImage&&!p.autoImage){p.customImage=p.image;changed=true;}addUsed(p.region,p.slug);if(p.customImage&&!state.imageOverrides[p.slug])state.imageOverrides[p.slug]=p.customImage;});if(changed)FXStorage.set(KEY,state);}

function refreshLivesSelect(region){const sel=$('poke-lives');if(!sel)return;const max=maxLives(region);const current=Math.min(max,Number(sel.value)||max);sel.innerHTML=Array.from({length:max+1},(_,i)=>{const v=max-i;return `<option value="${v}">${v===0?'0 · Inutilizable':`${v} ${v===1?'vida':'vidas'}`}</option>`}).join('');sel.value=String(current);}
function renderUsed(){const r=$('used-region')?.value||'Kanto';const arr=[...(state.usedByRegion?.[r]||[])].sort();if($('used-count'))$('used-count').textContent=String(Object.values(state.usedByRegion||{}).flat().length);if($('used-summary'))$('used-summary').innerHTML=`<strong>${r}</strong><span>${arr.length} especies registradas</span>`;if($('used-chips'))$('used-chips').innerHTML=arr.length?arr.map(sl=>`<span class="used-chip">${esc(titleCase(sl))}<button data-remove-used="${esc(sl)}" title="Quitar">×</button></span>`).join(''):'<div class="empty compact-empty">No hay especies registradas en esta región.</div>';document.querySelectorAll('[data-remove-used]').forEach(b=>b.onclick=()=>{state.usedByRegion[r]=state.usedByRegion[r].filter(x=>x!==b.dataset.removeUsed);save();renderUsed();});}
async function importUsedList(){const r=$('used-region').value;const raw=$('used-bulk').value;const names=raw.split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean);if(!names.length)return;let added=0,unknown=[];for(const name of names){let slug=slugify(name);const exact=pokemonIndex.find(p=>p.name===slug)||pokemonIndex.find(p=>titleCase(p.name).toLowerCase()===name.toLowerCase());if(exact)slug=exact.name;else{try{const d=await fetchDexPokemon(slug);slug=d.slug;}catch{unknown.push(name);continue;}}const before=(state.usedByRegion[r]||[]).length;addUsed(r,slug);if((state.usedByRegion[r]||[]).length>before)added++;}$('used-bulk').value='';save();renderUsed();alert(`${added} Pokémon añadidos${unknown.length?`. No reconocidos: ${unknown.join(', ')}`:''}.`);}
function renderSettings(){const r=$('settings-region')?.value||state.currentRegion;if($('region-max-lives'))$('region-max-lives').value=String(maxLives(r));renderUsed();}
function exportCobblemon(){const blob=new Blob([JSON.stringify({app:'FX Tools Cobblemon',version:4,exportedAt:new Date().toISOString(),state},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`fx-tools-cobblemon-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
async function importCobblemonFile(file){try{const j=JSON.parse(await file.text());const incoming=j.state||j?.data?.['cobblemon.state']||j;if(!incoming||!Array.isArray(incoming.pokemon))throw new Error();if(!confirm('Esto reemplazará los datos actuales de Cobblemon. ¿Continuar?'))return;state=incoming;if(!state.usedByRegion)state.usedByRegion={Kanto:[],Johto:[],Hoenn:[]};if(!state.regionSettings)state.regionSettings={Kanto:{maxLives:3},Johto:{maxLives:3},Hoenn:{maxLives:3}};if(!state.imageOverrides)state.imageOverrides={};migrateOldData();save();renderSettings();alert('Copia importada correctamente.');}catch{alert('No pude importar ese archivo.');}}
document.addEventListener('DOMContentLoaded',()=>{
  migrateOldData();render();loadPokemonIndex();
  // Modal robusto: funciona tanto alojado en GitHub Pages como abriendo index.html localmente.
  document.addEventListener('click',e=>{
    const addBtn=e.target.closest('#add-pokemon, #add-pokemon-secondary, .empty-team-slot');
    if(addBtn && !addBtn.classList.contains('empty-team-slot')){ e.preventDefault(); openEdit(); }
  });
  const modal=$('modal-pokemon');
  modal.addEventListener('click',e=>{ if(e.target===modal) closeEdit(); });
  const statsModal=$('modal-stats');
  statsModal.addEventListener('click',e=>{ if(e.target===statsModal) closeStats(); });
  $('close-stats').onclick=closeStats;$('stats-prev').onclick=()=>moveStats(-1);$('stats-next').onclick=()=>moveStats(1);
  $('add-pokemon').onclick=()=>openEdit();$('add-pokemon-secondary').onclick=()=>openEdit();$('close-poke').onclick=closeEdit;$('cancel-poke').onclick=closeEdit;$('save-poke').onclick=persistFromModal;
  $('delete-poke').onclick=()=>{if(!editingId)return;if(confirm('¿Eliminar este Pokémon del tracker?')){state.pokemon=state.pokemon.filter(p=>p.id!==editingId);closeEdit();save();}};
  $('poke-search').oninput=renderList;$('filter-region').onchange=renderList;
  $('current-region').onchange=e=>{state.currentRegion=e.target.value;save();};$('gym-number').onchange=e=>{state.currentGym=Math.max(1,Math.min(8,Number(e.target.value)||1));save();};
  $('overlay-popout').onclick=()=>window.open('overlay/','FXCobbleOverlay','width=1200,height=360');
  $('poke-species-search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(renderSpeciesSuggestions,80);});
  $('poke-species-search').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();const first=$('species-results').querySelector('[data-species]');if(first)selectSpecies(first.dataset.species);}});
  $('restore-auto-image').onclick=()=>{$('poke-image').value='';};
  document.addEventListener('click',e=>{if(!e.target.closest('.species-search-wrap'))$('species-results').classList.remove('open');});
  $('poke-region').onchange=e=>{refreshLivesSelect(e.target.value);if(selectedDex){const b=usedInPriorRegion(selectedDex.slug,e.target.value);$('species-note').textContent=b?`No disponible: ya fue utilizado en ${b}.`:'Ficha automática cargada.';}};
  $('used-region').onchange=renderUsed;$('add-used-list').onclick=importUsedList;$('clear-used-region').onclick=()=>{const r=$('used-region').value;if(confirm(`¿Vaciar la lista de ${r}?`)){state.usedByRegion[r]=[];save();renderUsed();}};
  $('settings-region').onchange=renderSettings;$('region-max-lives').onchange=e=>{const r=$('settings-region').value;const max=Math.max(1,Math.min(9,Number(e.target.value)||3));state.regionSettings[r]={...(state.regionSettings[r]||{}),maxLives:max};state.pokemon.filter(p=>p.region===r).forEach(p=>p.lives=Math.min(Number(p.lives),max));save();renderSettings();};
  $('export-cobblemon').onclick=exportCobblemon;$('import-cobblemon').onclick=()=>$('import-file').click();$('import-file').onchange=e=>{const f=e.target.files?.[0];if(f)importCobblemonFile(f);e.target.value='';};
  renderSettings();
});
