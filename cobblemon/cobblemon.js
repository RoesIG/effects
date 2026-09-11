const KEY='cobblemon.state';
const POKE_LIST_URL='https://pokeapi.co/api/v2/pokemon?limit=1302&offset=0';
const POKE_DETAIL_URL='https://pokeapi.co/api/v2/pokemon/';
const POKE_SPECIES_URL='https://pokeapi.co/api/v2/pokemon-species/';
const REGIONS=['Kanto','Johto','Hoenn','Sinnoh'];
const STAT_ORDER=['hp','attack','defense','special-attack','special-defense','speed'];
const statLabel={hp:'HP',attack:'ATQ',defense:'DEF','special-attack':'AT.ESP','special-defense':'DEF.ESP',speed:'VEL'};
const TYPE_ORDER=['normal','fire','water','electric','grass','ice','fighting','poison','ground','flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy'];
const TYPE_EFFECT={
  normal:{rock:.5,ghost:0,steel:.5},
  fire:{fire:.5,water:.5,grass:2,ice:2,bug:2,rock:.5,dragon:.5,steel:2},
  water:{fire:2,water:.5,grass:.5,ground:2,rock:2,dragon:.5},
  electric:{water:2,electric:.5,grass:.5,ground:0,flying:2,dragon:.5},
  grass:{fire:.5,water:2,grass:.5,poison:.5,ground:2,flying:.5,bug:.5,rock:2,dragon:.5,steel:.5},
  ice:{fire:.5,water:.5,grass:2,ice:.5,ground:2,flying:2,dragon:2,steel:.5},
  fighting:{normal:2,ice:2,poison:.5,flying:.5,psychic:.5,bug:.5,rock:2,ghost:0,dark:2,steel:2,fairy:.5},
  poison:{grass:2,poison:.5,ground:.5,rock:.5,ghost:.5,steel:0,fairy:2},
  ground:{fire:2,electric:2,grass:.5,poison:2,flying:0,bug:.5,rock:2,steel:2},
  flying:{electric:.5,grass:2,fighting:2,bug:2,rock:.5,steel:.5},
  psychic:{fighting:2,poison:2,psychic:.5,dark:0,steel:.5},
  bug:{fire:.5,grass:2,fighting:.5,poison:.5,flying:.5,psychic:2,ghost:.5,dark:2,steel:.5,fairy:.5},
  rock:{fire:2,ice:2,fighting:.5,ground:.5,flying:2,bug:2,steel:.5},
  ghost:{normal:0,psychic:2,ghost:2,dark:.5},
  dragon:{dragon:2,steel:.5,fairy:0},
  dark:{fighting:.5,psychic:2,ghost:2,dark:.5,fairy:.5},
  steel:{fire:.5,water:.5,electric:.5,ice:2,rock:2,steel:.5,fairy:2},
  fairy:{fire:.5,fighting:2,poison:.5,dragon:2,dark:2,steel:.5}
};
const HOENN_RULES=[
  ['♥','3 vidas por Pokémon durante toda Hoenn; un KO durante la progresión consume 1.'],
  ['○','Fuera de la progresión, los KO no afectan las vidas.'],
  ['−','Entre 5 y 7 niveles por debajo del level cap.'],
  ['EV','EVs distribuidos por el jugador; IVs solo naturales por captura o crianza.'],
  ['⚡','Mega / Z / Dynamax / Tera a elección para sobrevivir.'],
  ['★','Legendarios de radar inutilizables salvo 1 elegido por el jugador.'],
  ['?','Eficacia de ataques oculta; debilidades e interfaz de ataques rival siguen visibles.'],
  ['+','Solo pociones de curación en combate; sin Revivir.'],
  ['×','Pokémon usados en Kanto y Johto quedan inutilizables para Hoenn.']
];

const defaultState={
  currentRegion:'Hoenn',
  currentGym:1,
  gymByRegion:{Kanto:1,Johto:1,Hoenn:1,Sinnoh:1},
  pokemon:[],
  usedByRegion:{Kanto:[],Johto:[],Hoenn:[],Sinnoh:[]},
  regionSettings:{Kanto:{maxLives:3},Johto:{maxLives:3},Hoenn:{maxLives:3},Sinnoh:{maxLives:3}},
  imageOverrides:{},
  imagePreferences:{},
  completedRegions:{},
  actionHistory:[]
};
let state=FXStorage.get(KEY,defaultState);
let editingId=null;
let pokemonIndex=[];
let selectedDex=null;
let searchTimer=null;
let statsOpenId=null;
let statsContext='team';
let newlyUnusableId=null;
let replaceSourceId=null;
let pendingUndo=null;
let undoTimer=null;
let imageReviewIssues=[];
let evolutionSourceId=null;
let evolutionLoading=false;

const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
const titleCase=s=>String(s||'').split('-').map(x=>x?x[0].toUpperCase()+x.slice(1):'').join(' ');
const uid=()=>crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const slugify=s=>String(s||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[♀]/g,'-f').replace(/[♂]/g,'-m').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const deepCopy=o=>JSON.parse(JSON.stringify(o));
const maxLives=r=>Math.max(1,Number(state.regionSettings?.[r]?.maxLives)||3);
const regionBefore=(a,b)=>REGIONS.indexOf(a)>=0&&REGIONS.indexOf(b)>=0&&REGIONS.indexOf(a)<REGIONS.indexOf(b);
const addUsed=(region,slug)=>{if(!region||!slug)return;state.usedByRegion[region]=Array.isArray(state.usedByRegion[region])?state.usedByRegion[region]:[];if(!state.usedByRegion[region].includes(slug))state.usedByRegion[region].push(slug);};
const usedInPriorRegion=(slug,region)=>REGIONS.find(r=>regionBefore(r,region)&&(state.usedByRegion?.[r]||[]).includes(slug));
const bst=p=>STAT_ORDER.reduce((sum,k)=>sum+(Number(p?.stats?.[k])||0),0);
const currentMons=()=>state.pokemon.filter(p=>p.region===state.currentRegion);
const teamMons=()=>currentMons().filter(p=>p.inTeam).sort((a,b)=>(Number.isFinite(Number(a.teamOrder))?Number(a.teamOrder):999)-(Number.isFinite(Number(b.teamOrder))?Number(b.teamOrder):999)||state.pokemon.indexOf(a)-state.pokemon.indexOf(b)).slice(0,6);

function persist(render=true){FXStorage.set(KEY,state);if(render)renderAll();}
function logAction(message,type='info',region=state.currentRegion){state.actionHistory=Array.isArray(state.actionHistory)?state.actionHistory:[];state.actionHistory.unshift({id:uid(),message,type,region,at:new Date().toISOString()});state.actionHistory=state.actionHistory.slice(0,30);}
function formatActionTime(iso){try{return new Date(iso).toLocaleString('es-CL',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});}catch{return '';}}
function showToast(title,text='',undo=null){const wrap=$('cobble-toast-wrap');if(!wrap)return;wrap.innerHTML='';const toast=document.createElement('div');toast.className='toast cobble-toast';toast.innerHTML=`<div class="toast-copy"><strong>${esc(title)}</strong>${text?`<span>${esc(text)}</span>`:''}</div>${undo?'<button class="btn small toast-undo" type="button">Deshacer</button>':''}`;wrap.appendChild(toast);if(undo){toast.querySelector('.toast-undo').onclick=()=>{undo();wrap.innerHTML='';};}setTimeout(()=>{if(toast.isConnected)toast.remove();},6500);}

function migrateOldData(){
  let changed=false;
  if(!state||typeof state!=='object'){state=deepCopy(defaultState);changed=true;}
  if(!Array.isArray(state.pokemon)){state.pokemon=[];changed=true;}
  if(!state.usedByRegion){state.usedByRegion={};changed=true;}
  if(!state.regionSettings){state.regionSettings={};changed=true;}
  if(!state.imageOverrides){state.imageOverrides={};changed=true;}
  if(!state.imagePreferences){state.imagePreferences={};changed=true;}
  if(!state.completedRegions){state.completedRegions={};changed=true;}
  if(!Array.isArray(state.actionHistory)){state.actionHistory=[];changed=true;}
  if(!state.gymByRegion){state.gymByRegion={};changed=true;}
  REGIONS.forEach(r=>{
    if(!Array.isArray(state.usedByRegion[r])){state.usedByRegion[r]=[];changed=true;}
    if(!state.regionSettings[r]){state.regionSettings[r]={maxLives:3};changed=true;}
    if(!Number.isFinite(Number(state.gymByRegion[r]))){state.gymByRegion[r]=r===state.currentRegion?(Number(state.currentGym)||1):1;changed=true;}
  });
  if(!REGIONS.includes(state.currentRegion)){state.currentRegion='Hoenn';changed=true;}
  state.currentGym=Math.max(1,Math.min(8,Number(state.gymByRegion[state.currentRegion]||state.currentGym)||1));
  state.gymByRegion[state.currentRegion]=state.currentGym;
  const orderByRegion={};
  state.pokemon.forEach((p,index)=>{
    if('outGym' in p){delete p.outGym;changed=true;}
    if(p.lives==null){p.lives=maxLives(p.region);changed=true;}
    if(!p.slug){p.slug=slugify(p.species);changed=true;}
    if(!Array.isArray(p.speciesHistory)||!p.speciesHistory.length){p.speciesHistory=[{slug:p.slug,species:p.species,at:null}];changed=true;}
    else{
      const clean=[];
      p.speciesHistory.forEach(entry=>{
        const slug=typeof entry==='string'?slugify(entry):slugify(entry?.slug||entry?.species);
        if(!slug)return;
        const species=typeof entry==='string'?titleCase(slug):(entry.species||titleCase(slug));
        if(!clean.some(x=>x.slug===slug))clean.push({slug,species,at:entry?.at||null});
      });
      if(!clean.some(x=>x.slug===p.slug))clean.push({slug:p.slug,species:p.species,at:null});
      if(JSON.stringify(clean)!==JSON.stringify(p.speciesHistory)){p.speciesHistory=clean;changed=true;}
    }
    p.speciesHistory.forEach(entry=>{const before=(state.usedByRegion?.[p.region]||[]).length;addUsed(p.region,entry.slug);if((state.usedByRegion?.[p.region]||[]).length!==before)changed=true;});
    if(!Array.isArray(p.types)){p.types=[];changed=true;}
    if(!p.stats||typeof p.stats!=='object'){p.stats={};changed=true;}
    if(p.image&&!p.customImage&&!p.autoImage){p.customImage=p.image;changed=true;}
    if(p.inTeam&&!Number.isFinite(Number(p.teamOrder))){orderByRegion[p.region]=(orderByRegion[p.region]||0)+1;p.teamOrder=orderByRegion[p.region];changed=true;}
    else if(p.inTeam){orderByRegion[p.region]=Math.max(orderByRegion[p.region]||0,Number(p.teamOrder));}
    const usedBefore=(state.usedByRegion?.[p.region]||[]).length;addUsed(p.region,p.slug);if((state.usedByRegion?.[p.region]||[]).length!==usedBefore)changed=true;
    if(p.customImage&&!state.imageOverrides[p.slug]){state.imageOverrides[p.slug]=p.customImage;changed=true;}
    if(Number(p.lives)===0&&p.inTeam){p.inTeam=false;changed=true;}
    p._legacyIndex=index;
  });
  state.pokemon.forEach(p=>{delete p._legacyIndex;});
  if(changed)FXStorage.set(KEY,state);
}

function normalizeTeamOrder(region){teamMonsForRegion(region).forEach((p,i)=>p.teamOrder=i+1);}
function teamMonsForRegion(region){return state.pokemon.filter(p=>p.region===region&&p.inTeam).sort((a,b)=>(Number(a.teamOrder)||999)-(Number(b.teamOrder)||999)||state.pokemon.indexOf(a)-state.pokemon.indexOf(b)).slice(0,6);}
function nextTeamOrder(region){const arr=teamMonsForRegion(region);return arr.length?Math.max(...arr.map(p=>Number(p.teamOrder)||0))+1:1;}

function cobbledexRender(id){return id?`https://cobbledex.b-cdn.net/3dmons/previews/large/${id}.webp`:'';}
function imageCandidates(p){
  const slug=p.slug||slugify(p.species);
  const override=state.imageOverrides?.[slug]||'';
  const preference=state.imagePreferences?.[slug]||'';
  return [...new Set([override,preference,p.customImage,p.image,p.autoImage,p.fallbackImage,...(p.imageCandidates||[])].filter(Boolean))];
}
window.fxImgFallback=function(img){try{const arr=JSON.parse(decodeURIComponent(img.dataset.candidates||'%5B%5D'));let i=Number(img.dataset.idx||0)+1;if(i<arr.length){img.dataset.idx=String(i);img.src=arr[i];return;}img.replaceWith(Object.assign(document.createElement('div'),{className:'poke-placeholder',textContent:'PKM'}));}catch{img.style.display='none';}};
function pokemonImg(p,cls=''){const arr=imageCandidates(p);if(!arr.length)return `<div class="poke-placeholder ${cls}">PKM</div>`;return `<img class="${cls}" src="${esc(arr[0])}" alt="${esc(p.species)}" data-idx="0" data-candidates="${esc(encodeURIComponent(JSON.stringify(arr)))}" onerror="window.fxImgFallback(this)">`;}
function typePills(types=[]){return types.map(t=>`<span class="type-pill type-${esc(t)}">${esc(titleCase(t))}</span>`).join('');}
function hearts(n,max=3,id=null){return Array.from({length:max},(_,i)=>id?`<button type="button" class="heart heart-btn ${i<Number(n)?'':'off'}" data-heart-id="${esc(id)}" data-heart-value="${i+1}" title="${i<Number(n)?`Quitar vida ${i+1}`:`Restaurar hasta ${i+1} ${i===0?'vida':'vidas'}`}" aria-label="Cambiar a ${i<Number(n)?i:i+1} vidas">♥</button>`:`<span class="heart ${i<Number(n)?'':'off'}">♥</span>`).join('');}
function statsInline(stats={}){return STAT_ORDER.filter(k=>stats[k]!=null).map(k=>`<span><b>${statLabel[k]}</b><strong>${stats[k]}</strong></span>`).join('');}
function statBars(stats={}){return STAT_ORDER.map(k=>{const raw=Number(stats?.[k]);const value=Number.isFinite(raw)?raw:0;const pct=Math.max(0,Math.min(100,(value/255)*100));return `<div class="base-stat-row"><div class="base-stat-label"><span>${statLabel[k]}</span><strong>${value||'—'}</strong></div><div class="base-stat-track"><span style="width:${value?Math.max(3,pct):0}%"></span></div></div>`;}).join('');}
function hasStats(p){return STAT_ORDER.some(k=>Number.isFinite(Number(p?.stats?.[k])));}
function typeDefenseData(types=[]){
  const mon={types:(types||[]).filter(Boolean)};
  const rows=TYPE_ORDER.map(type=>({type,mult:defensiveMultiplier(mon,type)}));
  return {
    weaknesses:rows.filter(x=>x.mult>1).sort((a,b)=>b.mult-a.mult||TYPE_ORDER.indexOf(a.type)-TYPE_ORDER.indexOf(b.type)),
    resistances:rows.filter(x=>x.mult>0&&x.mult<1).sort((a,b)=>a.mult-b.mult||TYPE_ORDER.indexOf(a.type)-TYPE_ORDER.indexOf(b.type)),
    immunities:rows.filter(x=>x.mult===0).sort((a,b)=>TYPE_ORDER.indexOf(a.type)-TYPE_ORDER.indexOf(b.type))
  };
}
function multLabel(n){if(n===0)return 'INMUNE';if(n===.25)return '×0.25';if(n===.5)return '×0.5';return `×${Number.isInteger(n)?n:String(n)}`;}
function defenseChips(items=[],kind='neutral'){return items.length?items.map(x=>`<span class="defense-chip ${kind} type-${esc(x.type)}"><b>${esc(titleCase(x.type))}</b><em>${esc(multLabel(x.mult))}</em></span>`).join(''):'<span class="defense-none">—</span>';}
function offensiveSuperEffective(types=[]){
  return (types||[]).filter(Boolean).map(type=>({
    type,
    targets:TYPE_ORDER.filter(target=>Number(TYPE_EFFECT?.[type]?.[target]??1)===2)
  }));
}
function typeOffensePanel(types=[]){
  const rows=offensiveSuperEffective(types);
  if(!rows.length)return `<div class="offense-empty">Tipos no disponibles todavía.</div>`;
  return `<div class="type-offense">${rows.map(row=>`<div class="offense-type-group"><div class="offense-type-head"><span class="type-pill type-${esc(row.type)}">${esc(titleCase(row.type))}</span><small>×2 CONTRA</small></div><div class="defense-chips">${row.targets.length?row.targets.map(target=>`<span class="defense-chip offense type-${esc(target)}"><b>${esc(titleCase(target))}</b><em>×2</em></span>`).join(''):'<span class="defense-none">—</span>'}</div></div>`).join('')}</div>`;
}
function typeDefensePanel(types=[],compact=false){
  const d=typeDefenseData(types);
  if(!(types||[]).length)return `<div class="type-defense ${compact?'compact':''}"><div class="defense-empty">Tipos no disponibles todavía.</div></div>`;
  return `<div class="type-defense ${compact?'compact':''}"><div class="defense-group weakness-group"><div class="defense-group-head"><strong>DEBILIDADES</strong><span>${d.weaknesses.length}</span></div><div class="defense-chips">${defenseChips(d.weaknesses,'weakness')}</div></div><div class="defense-group resistance-group"><div class="defense-group-head"><strong>RESISTE</strong><span>${d.resistances.length}</span></div><div class="defense-chips">${defenseChips(d.resistances,'resistance')}</div></div><div class="defense-group immunity-group"><div class="defense-group-head"><strong>INMUNIDADES</strong><span>${d.immunities.length}</span></div><div class="defense-chips">${defenseChips(d.immunities,'immunity')}</div></div></div>`;
}
function selectedExpandedStats(stats={},types=[]){const total=STAT_ORDER.reduce((sum,k)=>sum+(Number(stats?.[k])||0),0);const items=STAT_ORDER.map(k=>{const raw=Number(stats?.[k]);const value=Number.isFinite(raw)?raw:0;const pct=Math.max(0,Math.min(100,(value/255)*100));return `<div class="selected-stat-card"><div class="selected-stat-top"><span>${statLabel[k]}</span><strong>${value||'—'}</strong></div><div class="selected-stat-track"><span style="width:${value?Math.max(3,pct):0}%"></span></div></div>`;}).join('');return `<div class="selected-stats-expand"><div class="selected-stats-expand-head"><strong>STATS BASE</strong><span>Total ${total}</span></div><div class="selected-stats-grid">${items}</div><div class="selected-defense-wrap"><div class="selected-stats-expand-head defense-title"><strong>EFICACIA DEFENSIVA</strong><span>${(types||[]).map(titleCase).join(' / ')}</span></div>${typeDefensePanel(types,true)}</div></div>`;}

async function loadPokemonIndex(){
  try{
    $('dex-status').textContent='Cargando';
    const cached=FXStorage.get('cobblemon.pokeindex',null);
    if(cached?.items?.length&&Date.now()-cached.time<1000*60*60*24*14){pokemonIndex=cached.items;$('dex-status').textContent='Listo';return;}
    const r=await fetch(POKE_LIST_URL);if(!r.ok)throw new Error('PokeAPI list');
    const j=await r.json();pokemonIndex=j.results.map((x,i)=>({name:x.name,id:Number((x.url.match(/pokemon\/(\d+)\/?$/)||[])[1])||i+1}));
    FXStorage.set('cobblemon.pokeindex',{time:Date.now(),items:pokemonIndex});$('dex-status').textContent='Listo';
  }catch(e){console.warn(e);$('dex-status').textContent='Offline';}
}
async function fetchDexPokemon(query){
  const slug=String(query).trim().toLowerCase().replace(/\s+/g,'-');if(!slug)return null;
  const cacheKey=`cobblemon.dex.${slug}`;const cached=FXStorage.get(cacheKey,null);if(cached)return cached;
  const r=await fetch(POKE_DETAIL_URL+encodeURIComponent(slug));if(!r.ok)throw new Error('No encontrado');
  const d=await r.json();
  const candidates=[cobbledexRender(d.id),d?.sprites?.other?.['official-artwork']?.front_default,d?.sprites?.other?.home?.front_default,d?.sprites?.front_default].filter(Boolean);
  const data={id:d.id,slug:d.name,species:titleCase(d.name),types:d.types.sort((a,b)=>a.slot-b.slot).map(x=>x.type.name),stats:Object.fromEntries(d.stats.map(x=>[x.stat.name,x.base_stat])),autoImage:candidates[0]||'',fallbackImage:candidates[1]||candidates[2]||'',imageCandidates:candidates};
  FXStorage.set(cacheKey,data);return data;
}
function speciesHistoryEntries(p){
  const raw=Array.isArray(p?.speciesHistory)?p.speciesHistory:[];
  const out=[];
  raw.forEach(entry=>{
    const slug=typeof entry==='string'?slugify(entry):slugify(entry?.slug||entry?.species);
    if(!slug||out.some(x=>x.slug===slug))return;
    out.push({slug,species:typeof entry==='string'?titleCase(slug):(entry.species||titleCase(slug)),at:entry?.at||null});
  });
  if(p?.slug&&!out.some(x=>x.slug===p.slug))out.push({slug:p.slug,species:p.species||titleCase(p.slug),at:null});
  return out;
}
function speciesHistoryHtml(p){
  const hist=speciesHistoryEntries(p);
  if(hist.length<=1)return '';
  return `<div class="species-path"><span>RECORRIDO DE ESPECIES</span><strong>${hist.map(x=>esc(x.species)).join(' <em>→</em> ')}</strong></div>`;
}
async function fetchDirectEvolutions(p){
  if(!p?.slug)return [];
  const cacheKey=`cobblemon.evolution.${p.slug}`;
  const cached=FXStorage.get(cacheKey,null);
  if(cached?.slugs&&Date.now()-Number(cached.time||0)<1000*60*60*24*30)return cached.slugs;
  let canonical=p.slug;
  try{
    const pr=await fetch(POKE_DETAIL_URL+encodeURIComponent(p.slug));
    if(pr.ok){const pd=await pr.json();canonical=pd?.species?.name||canonical;}
  }catch{}
  const sr=await fetch(POKE_SPECIES_URL+encodeURIComponent(canonical));
  if(!sr.ok)throw new Error('No se pudo consultar la especie');
  const species=await sr.json();
  const chainUrl=species?.evolution_chain?.url;
  if(!chainUrl){FXStorage.set(cacheKey,{time:Date.now(),slugs:[]});return [];}
  const cr=await fetch(chainUrl);if(!cr.ok)throw new Error('No se pudo consultar la evolución');
  const chain=(await cr.json())?.chain;
  function findNode(node){if(!node)return null;if(node?.species?.name===canonical)return node;for(const child of node.evolves_to||[]){const found=findNode(child);if(found)return found;}return null;}
  const node=findNode(chain);
  const slugs=[...new Set((node?.evolves_to||[]).map(x=>x?.species?.name).filter(Boolean))];
  FXStorage.set(cacheKey,{time:Date.now(),slugs});
  return slugs;
}
async function evolutionCards(p){
  const slugs=await fetchDirectEvolutions(p);
  const cards=[];
  for(const slug of slugs){
    try{cards.push(await fetchDexPokemon(slug));}catch{cards.push({slug,species:titleCase(slug),types:[],stats:{},imageCandidates:[]});}
  }
  return cards;
}

async function ensurePokemonStats(p){
  if(!p||hasStats(p)||!p.slug)return p;
  try{const d=await fetchDexPokemon(p.slug);p.dexId=p.dexId||d.id;p.types=(p.types&&p.types.length)?p.types:d.types;p.stats=d.stats||{};p.autoImage=p.autoImage||d.autoImage;p.fallbackImage=p.fallbackImage||d.fallbackImage;p.imageCandidates=(p.imageCandidates&&p.imageCandidates.length)?p.imageCandidates:d.imageCandidates;FXStorage.set(KEY,state);}catch(e){console.warn('No se pudieron cargar stats para',p.species,e);}return p;
}

function renderSpeciesSuggestions(){
  const q=$('poke-species-search').value.trim().toLowerCase(),box=$('species-results');
  if(q.length<2){box.classList.remove('open');box.innerHTML='';return;}
  let matches=pokemonIndex.filter(p=>p.name.includes(q));
  matches.sort((a,b)=>(a.name.startsWith(q)?-1:1)-(b.name.startsWith(q)?-1:1)||a.name.length-b.name.length);matches=matches.slice(0,8);
  if(!matches.length){box.innerHTML='<button type="button" class="species-result muted-result">Sin coincidencias cargadas</button>';box.classList.add('open');return;}
  box.innerHTML=matches.map(p=>{const blocked=usedInPriorRegion(p.name,$('poke-region').value||state.currentRegion);return `<button type="button" class="species-result ${blocked?'blocked-result':''}" data-species="${esc(p.name)}"><span>#${String(p.id).padStart(4,'0')}</span><strong>${esc(titleCase(p.name))}${blocked?` <em>USADO · ${esc(blocked.toUpperCase())}</em>`:''}</strong></button>`;}).join('');
  box.classList.add('open');box.querySelectorAll('[data-species]').forEach(b=>b.onclick=()=>selectSpecies(b.dataset.species));
}
async function selectSpecies(name){
  $('species-results').classList.remove('open');$('species-note').textContent='Cargando ficha…';$('selected-species').classList.add('loading');
  try{selectedDex=await fetchDexPokemon(name);$('poke-species-search').value=selectedDex.species;renderSelectedSpecies();const blocked=usedInPriorRegion(selectedDex.slug,$('poke-region').value||state.currentRegion);$('species-note').textContent=blocked?`No disponible: ya fue utilizado en ${blocked}.`:'Ficha automática cargada.';}catch(e){selectedDex=null;$('species-note').textContent='No pude cargar esa especie. Comprueba la conexión o prueba otro nombre.';renderSelectedSpecies();}
  $('selected-species').classList.remove('loading');
}
function renderSelectedSpecies(){
  const box=$('selected-species');box.classList.toggle('has-data',!!selectedDex);
  if(!selectedDex){box.innerHTML='<div class="selected-preview-main"><div class="selected-visual"><span>PKM</span></div><div><strong>Sin especie seleccionada</strong><small>Los stats y tipos aparecerán aquí.</small></div></div>';return;}
  const tmp={species:selectedDex.species,slug:selectedDex.slug,autoImage:selectedDex.autoImage,fallbackImage:selectedDex.fallbackImage,imageCandidates:selectedDex.imageCandidates||[]};
  box.innerHTML=`<div class="selected-preview-main"><div class="selected-visual">${pokemonImg(tmp)}</div><div class="selected-info"><div class="dex-heading"><strong>${esc(selectedDex.species)}</strong><span>#${String(selectedDex.id).padStart(4,'0')}</span></div><div class="type-row">${typePills(selectedDex.types)}</div><div class="mini-stats">${statsInline(selectedDex.stats)}</div><div class="stats-expand-hint">Pasa el mouse para ampliar stats</div></div></div>${selectedExpandedStats(selectedDex.stats,selectedDex.types)}`;
}

function renderProgression(){
  const r=state.currentRegion,gym=state.currentGym,used=(state.usedByRegion?.[r]||[]).length,outs=state.pokemon.filter(p=>p.region===r&&Number(p.lives)===0).length,champs=state.pokemon.filter(p=>p.region===r&&p.champion).length,active=state.pokemon.filter(p=>p.region===r&&Number(p.lives)>0).length,done=state.completedRegions?.[r],next=REGIONS[REGIONS.indexOf(r)+1];
  const badge=$('progress-status-badge');badge.textContent=done?'FINALIZADA':'EN CURSO';badge.className=`badge ${done?'live':''}`;
  const pct=Math.max(0,Math.min(100,(gym/8)*100));
  $('progression-summary').innerHTML=`
    <div class="progress-main"><div><span class="progress-kicker">${esc(r.toUpperCase())}</span><strong>${done?'Región finalizada':`Gimnasio ${gym} de 8`}</strong><small>${done?`Guardada ${formatActionTime(done.at)}`:`${maxLives(r)} vidas máximas por Pokémon`}</small></div><div class="progress-actions">${done?`<button class="btn small" type="button" data-reopen-region="${esc(r)}">Reabrir</button>${next?`<button class="btn small primary" type="button" data-next-region="${esc(next)}">Ir a ${esc(next)}</button>`:''}`:`<button class="btn small primary" type="button" data-finalize-region="${esc(r)}">Finalizar región</button>`}</div></div>
    <div class="region-progress-track"><span style="width:${done?100:pct}%"></span></div>
    <div class="progress-metrics"><div><span>Utilizados</span><strong>${used}</strong></div><div><span>Activos</span><strong>${active}</strong></div><div><span>Inutilizables</span><strong>${outs}</strong></div><div><span>Campeones</span><strong>${champs}/6</strong></div></div>`;
}
function finalizeRegion(region){
  if(region!==state.currentRegion)return;
  if(!confirm(`¿Marcar ${region} como finalizada? El historial quedará guardado y podrás reabrirla si necesitas corregir algo.`))return;
  const champs=state.pokemon.filter(p=>p.region===region&&p.champion).map(p=>p.id);
  state.completedRegions[region]={at:new Date().toISOString(),gym:state.currentGym,used:[...(state.usedByRegion?.[region]||[])],championIds:champs,unusableIds:state.pokemon.filter(p=>p.region===region&&Number(p.lives)===0).map(p=>p.id)};
  logAction(`${region} marcada como finalizada`,'region',region);persist();showToast(`${region} finalizada`,'El historial quedó guardado.');
}
function reopenRegion(region){if(!state.completedRegions?.[region])return;if(!confirm(`¿Reabrir ${region}? No se borrará ningún Pokémon ni historial.`))return;delete state.completedRegions[region];logAction(`${region} reabierta`,'region',region);persist();}
function goToRegion(region){if(!REGIONS.includes(region))return;state.currentRegion=region;state.currentGym=Math.max(1,Math.min(8,Number(state.gymByRegion?.[region])||1));state.gymByRegion[region]=state.currentGym;logAction(`Región actual: ${region}`,'region',region);persist();}

function renderTeam(){
  const wrap=$('team-grid'),mons=teamMons();wrap.innerHTML='';$('team-count').textContent=`${mons.length} / 6`;
  mons.forEach((p,index)=>{
    const card=document.createElement('div');card.className=`poke-card selected ${Number(p.lives)===0?'dead':''}`;
    card.innerHTML=`<div class="poke-card-head"><button type="button" class="team-name-button" data-stats="${p.id}" title="Ver stats base"><div class="poke-name">${esc(p.nickname||p.species)}</div><div class="poke-species">${esc(p.species)}${p.level?` · Nv. ${esc(p.level)}`:''}</div></button><div class="team-head-actions"><button class="mini-icon-btn" type="button" data-team-move="${p.id}" data-dir="-1" ${index===0?'disabled':''} title="Mover a la izquierda">‹</button><button class="mini-icon-btn" type="button" data-team-move="${p.id}" data-dir="1" ${index===mons.length-1?'disabled':''} title="Mover a la derecha">›</button><button class="more-btn" data-edit="${p.id}" title="Editar">•••</button></div></div><button type="button" class="poke-visual stats-visual-button" data-stats="${p.id}" title="Ver stats base">${pokemonImg(p)}</button><div class="type-row compact">${typePills(p.types)}</div><div class="lives-row"><div class="lives clickable-lives">${hearts(p.lives,maxLives(p.region),p.id)}</div><span class="life-label ${Number(p.lives)===0?'out':''}">${Number(p.lives)===0?'INUTILIZABLE':`${p.lives}/${maxLives(p.region)}`}</span></div><div class="team-card-footer"><span>Nombre/imagen: stats · corazones: vidas</span><button class="team-replace-btn" type="button" data-replace="${p.id}">Cambiar</button></div>`;
    wrap.appendChild(card);
  });
  for(let i=mons.length;i<6;i++){const slot=document.createElement('button');slot.className='empty-team-slot';slot.innerHTML='<span>+</span><small>Añadir al equipo</small>';slot.onclick=()=>openEdit(null,true);wrap.appendChild(slot);}
  wrap.querySelectorAll('[data-heart-id]').forEach(b=>b.onclick=()=>setLifeFromHeart(b.dataset.heartId,Number(b.dataset.heartValue)));
  wrap.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openEdit(b.dataset.edit));
  wrap.querySelectorAll('[data-stats]').forEach(b=>b.onclick=()=>openStats(b.dataset.stats,'team'));
  wrap.querySelectorAll('[data-team-move]').forEach(b=>b.onclick=()=>moveTeam(b.dataset.teamMove,Number(b.dataset.dir)));
  wrap.querySelectorAll('[data-replace]').forEach(b=>b.onclick=()=>openReplace(b.dataset.replace));
}
function moveTeam(id,delta){const mons=teamMons();const i=mons.findIndex(p=>p.id===id);const j=i+delta;if(i<0||j<0||j>=mons.length)return;const a=mons[i],b=mons[j],ao=Number(a.teamOrder)||i+1,bo=Number(b.teamOrder)||j+1;a.teamOrder=bo;b.teamOrder=ao;persist();}
function toggleTeam(id){
  const p=state.pokemon.find(x=>x.id===id);if(!p)return;
  if(Number(p.lives)===0&&!p.inTeam){alert('Este Pokémon está inutilizable y no puede volver al equipo.');return;}
  if(!p.inTeam&&teamMonsForRegion(p.region).length>=6){alert('El equipo de esa región ya tiene 6 Pokémon.');return;}
  p.inTeam=!p.inTeam;if(p.inTeam)p.teamOrder=nextTeamOrder(p.region);normalizeTeamOrder(p.region);logAction(`${p.nickname||p.species} ${p.inTeam?'entró al':'salió del'} equipo`,'team',p.region);persist();
}

function openReplace(id){replaceSourceId=id;const p=state.pokemon.find(x=>x.id===id);if(!p)return;$('replace-search').value='';$('replace-description').textContent=`Reemplaza a ${p.nickname||p.species} por otro Pokémon disponible de ${p.region}.`;renderReplaceList();const modal=$('modal-replace');if(typeof modal.showModal==='function'){if(!modal.open)modal.showModal();}else modal.classList.add('open');setTimeout(()=>$('replace-search').focus(),50);}
function closeReplace(){const modal=$('modal-replace');if(typeof modal.close==='function'&&modal.open)modal.close();else modal.classList.remove('open');replaceSourceId=null;}
function renderReplaceList(){
  const src=state.pokemon.find(x=>x.id===replaceSourceId),list=$('replace-list');if(!src||!list)return;const q=$('replace-search').value.trim().toLowerCase();
  const candidates=state.pokemon.filter(p=>p.region===src.region&&!p.inTeam&&Number(p.lives)>0&&(!q||`${p.nickname||''} ${p.species}`.toLowerCase().includes(q)));
  list.innerHTML=candidates.length?candidates.map(p=>`<button class="replace-option" type="button" data-replace-with="${p.id}"><div class="replace-thumb">${pokemonImg(p)}</div><div><strong>${esc(p.nickname||p.species)}</strong><span>${esc(p.species)}</span><div class="type-row tiny">${typePills(p.types)}</div></div><small>${p.lives}/${maxLives(p.region)} ♥</small></button>`).join(''):'<div class="empty compact-empty">No hay Pokémon disponibles que coincidan.</div>';
  list.querySelectorAll('[data-replace-with]').forEach(b=>b.onclick=()=>replaceTeam(replaceSourceId,b.dataset.replaceWith));
}
function replaceTeam(oldId,newId){const oldP=state.pokemon.find(p=>p.id===oldId),newP=state.pokemon.find(p=>p.id===newId);if(!oldP||!newP||Number(newP.lives)===0)return;const order=Number(oldP.teamOrder)||1;oldP.inTeam=false;newP.inTeam=true;newP.teamOrder=order;normalizeTeamOrder(oldP.region);logAction(`${oldP.nickname||oldP.species} → ${newP.nickname||newP.species} en el equipo`,'team',oldP.region);closeReplace();persist();showToast('Equipo actualizado',`${newP.nickname||newP.species} ocupa ahora ese slot.`);}

function filterPokemonForRegistry(){
  const q=$('poke-search').value.trim().toLowerCase(),region=$('filter-region').value,status=$('filter-status').value,sort=$('sort-pokemon').value;
  let mons=state.pokemon.filter(p=>(region==='all'||p.region===region)&&(!q||`${p.nickname||''} ${p.species||''}`.toLowerCase().includes(q)));
  mons=mons.filter(p=>{
    if(status==='all')return true;if(status==='team')return !!p.inTeam;if(status==='available')return Number(p.lives)>0&&!usedInPriorRegion(p.slug,state.currentRegion);if(status==='unusable')return Number(p.lives)===0;if(status==='champion')return !!p.champion;if(status==='previous')return regionBefore(p.region,state.currentRegion);return true;
  });
  if(sort==='name')mons.sort((a,b)=>(a.nickname||a.species).localeCompare(b.nickname||b.species,'es'));
  else if(sort==='region')mons.sort((a,b)=>REGIONS.indexOf(a.region)-REGIONS.indexOf(b.region)||(a.nickname||a.species).localeCompare(b.nickname||b.species,'es'));
  else if(sort==='bst')mons.sort((a,b)=>bst(b)-bst(a));
  else if(STAT_ORDER.includes(sort))mons.sort((a,b)=>(Number(b.stats?.[sort])||0)-(Number(a.stats?.[sort])||0));
  else if(sort==='lives')mons.sort((a,b)=>Number(b.lives)-Number(a.lives));
  return mons;
}
function renderList(){
  const list=$('pokemon-list');list.innerHTML='';const seriesCount=$('series-count');if(seriesCount)seriesCount.textContent=String(state.pokemon.length);const mons=filterPokemonForRegistry();
  mons.forEach(p=>{const row=document.createElement('div');row.className=`list-row ${Number(p.lives)===0?'row-dead':''}`;row.innerHTML=`<button type="button" class="list-mon list-mon-button" data-stats="${p.id}" title="Abrir stats base"><div class="list-thumb">${pokemonImg(p)}</div><div class="row-title"><strong>${esc(p.nickname||p.species)}</strong><span>${esc(p.species)} · ${esc(p.region)}${p.level?` · Nv. ${esc(p.level)}`:''}</span><div class="type-row tiny">${typePills(p.types)}</div></div></button><button type="button" class="list-stats list-stats-button" data-stats="${p.id}" title="Abrir stats base">${statsInline(p.stats)}</button><div class="list-lives clickable-lives">${hearts(p.lives,maxLives(p.region),p.id)}<small>${Number(p.lives)?'Activo':'Inutilizable'}</small></div><div class="list-flags">${p.inTeam?'<span class="badge live">Equipo</span>':''}${p.champion?'<span class="badge warn">🏆</span>':''}</div><div class="row-actions"><button class="btn small" data-team="${p.id}">${p.inTeam?'Quitar':'Equipo'}</button><button class="btn small" data-edit="${p.id}">Editar</button></div>`;list.appendChild(row);});
  if(!mons.length)list.innerHTML='<div class="empty">No hay Pokémon que coincidan con los filtros.</div>';
  list.querySelectorAll('[data-team]').forEach(b=>b.onclick=()=>toggleTeam(b.dataset.team));list.querySelectorAll('[data-heart-id]').forEach(b=>b.onclick=()=>setLifeFromHeart(b.dataset.heartId,Number(b.dataset.heartValue)));list.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openEdit(b.dataset.edit));list.querySelectorAll('[data-stats]').forEach(b=>b.onclick=()=>openStats(b.dataset.stats,'registry'));
}

function renderRegions(){
  $('region-cards').innerHTML=REGIONS.map(r=>{const champs=state.pokemon.filter(p=>p.region===r&&p.champion).slice(0,6);const slots=Array.from({length:6},(_,i)=>{const p=champs[i];return p?`<div class="champion-mon"><div class="champion-img">${pokemonImg(p)}</div><b>${esc(p.nickname||p.species)}</b><small>${esc(p.species)}</small></div>`:`<div class="champion-mon empty-champ"><div class="champion-img">—</div><b>VACÍO</b><small>—</small></div>`;}).join('');const used=(state.usedByRegion?.[r]||[]).length,outs=state.pokemon.filter(p=>p.region===r&&Number(p.lives)===0).length,done=!!state.completedRegions?.[r];return `<div class="region-card ${r===state.currentRegion?'current':''} ${done?'completed':''}"><div class="region-head"><div><strong>${r}</strong><p>${done?'FINALIZADA':r===state.currentRegion?'REGIÓN ACTUAL':'HISTORIAL'} · ${used} utilizados · ${outs} inutilizables</p></div><span>🏆 ${champs.length}/6</span></div><div class="champion-grid">${slots}</div></div>`;}).join('');
}
function renderPreview(){const mons=teamMons();$('preview-region').textContent=state.currentRegion.toUpperCase();$('preview-gym').textContent=`GIMNASIO ${state.currentGym}`;$('preview-team').innerHTML=Array.from({length:6},(_,i)=>{const p=mons[i];return p?`<div class="preview-mon"><div class="dot">${pokemonImg(p)}</div><b>${esc(p.nickname||p.species)}</b><span>${'♥'.repeat(Number(p.lives))}${'♡'.repeat(Math.max(0,maxLives(p.region)-Number(p.lives)))}</span></div>`:`<div class="preview-mon"><div class="dot">—</div><b>VACÍO</b><span>${'♡'.repeat(maxLives(state.currentRegion))}</span></div>`;}).join('');}
function renderUnusable(){const mons=state.pokemon.filter(p=>Number(p.lives)===0),count=$('unusable-count'),list=$('unusable-list');if(count)count.textContent=String(mons.length);if(!list)return;if(!mons.length){list.innerHTML='<div class="unusable-empty">Todavía no hay Pokémon inutilizables.</div>';return;}list.innerHTML=mons.map(p=>`<div class="unusable-card ${p.id===newlyUnusableId?'just-out':''}"><div class="unusable-visual">${pokemonImg(p)}</div><div class="unusable-info"><b>${esc(p.nickname||p.species)}</b><span>${esc(p.species)} · ${esc(p.region)}</span><small>${'♡'.repeat(maxLives(p.region))} · INUTILIZABLE · ${esc(p.outRegion||p.region)}</small></div></div>`).join('');if(newlyUnusableId)setTimeout(()=>{newlyUnusableId=null;},900);}

function defensiveMultiplier(mon,attackingType){return (mon.types||[]).reduce((m,defType)=>m*(TYPE_EFFECT[attackingType]?.[defType]??1),1);}
function renderTeamAnalysis(){
  const box=$('team-analysis'),mons=teamMons();if(!box)return;
  if(!mons.length){box.innerHTML='<div class="empty compact-empty">Añade Pokémon al equipo para ver el análisis.</div>';return;}
  const withStats=mons.filter(hasStats);const avg=k=>withStats.length?Math.round(withStats.reduce((s,p)=>s+(Number(p.stats?.[k])||0),0)/withStats.length):0;const avgBst=withStats.length?Math.round(withStats.reduce((s,p)=>s+bst(p),0)/withStats.length):0;
  const weaknesses=TYPE_ORDER.map(type=>{const details=mons.map(p=>defensiveMultiplier(p,type));return {type,count:details.filter(x=>x>1).length,severe:details.filter(x=>x>=4).length};}).filter(x=>x.count>=2).sort((a,b)=>b.count-a.count||b.severe-a.severe);
  const resistances=TYPE_ORDER.map(type=>{const details=mons.map(p=>defensiveMultiplier(p,type));return {type,count:details.filter(x=>x<1).length,immune:details.filter(x=>x===0).length};}).filter(x=>x.count>=3).sort((a,b)=>b.count-a.count||b.immune-a.immune).slice(0,6);
  const typeCounts={};mons.forEach(p=>(p.types||[]).forEach(t=>typeCounts[t]=(typeCounts[t]||0)+1));const repeated=Object.entries(typeCounts).filter(([,n])=>n>1).sort((a,b)=>b[1]-a[1]);
  box.innerHTML=`<div class="analysis-metrics"><div><span>VEL media</span><strong>${avg('speed')||'—'}</strong></div><div><span>BST medio</span><strong>${avgBst||'—'}</strong></div><div><span>HP medio</span><strong>${avg('hp')||'—'}</strong></div><div><span>Tipos únicos</span><strong>${Object.keys(typeCounts).length}</strong></div></div><div class="analysis-section"><div class="analysis-head"><strong>Debilidades repetidas</strong><span>${weaknesses.length?'Revisar antes de entrar':'Sin alertas grandes'}</span></div><div class="analysis-chips">${weaknesses.length?weaknesses.slice(0,8).map(x=>`<span class="analysis-chip weakness">${esc(titleCase(x.type))} · ${x.count}${x.severe?` <b>${x.severe}×4</b>`:''}</span>`).join(''):'<span class="analysis-empty">No hay un tipo que golpee supereficaz a 2 o más miembros.</span>'}</div></div><div class="analysis-section"><div class="analysis-head"><strong>Resistencias compartidas</strong><span>3 o más miembros</span></div><div class="analysis-chips">${resistances.length?resistances.map(x=>`<span class="analysis-chip resistance">${esc(titleCase(x.type))} · ${x.count}${x.immune?` <b>${x.immune} inm.</b>`:''}</span>`).join(''):'<span class="analysis-empty">Todavía no hay resistencias compartidas destacables.</span>'}</div></div><div class="analysis-section"><div class="analysis-head"><strong>Tipos repetidos</strong><span>Composición</span></div><div class="analysis-chips">${repeated.length?repeated.map(([t,n])=>`<span class="analysis-chip neutral">${esc(titleCase(t))} · ${n}</span>`).join(''):'<span class="analysis-empty">No repites tipos en el equipo actual.</span>'}</div></div>${withStats.length<mons.length?'<div class="hint">Hay Pokémon sin stats cargadas todavía. Al abrir su ficha se completarán automáticamente.</div>':''}`;
  mons.filter(p=>!hasStats(p)).forEach(p=>ensurePokemonStats(p).then(()=>{renderTeamAnalysis();renderList();}));
}
function renderRules(){const title=$('rules-title'),subtitle=$('rules-subtitle'),list=$('region-rules-list');if(!title||!list)return;title.textContent=`Reglas de ${state.currentRegion}`;if(state.currentRegion==='Hoenn'){subtitle.textContent='Consulta rápidamente las reglas de la región.';list.innerHTML=HOENN_RULES.map(([icon,text])=>`<div class="rule"><div class="rule-icon">${esc(icon)}</div><div>${esc(text)}</div></div>`).join('');}else{subtitle.textContent='Esta región aún no tiene reglas personalizadas guardadas.';list.innerHTML='<div class="empty compact-empty">Cuando definas las reglas de esta región, podemos integrarlas aquí sin cambiar el resto del tracker.</div>';}}

function snapshotPokemon(p){return deepCopy(p);}
function setLife(id,value){
  const p=state.pokemon.find(x=>x.id===id);if(!p)return;const before=Number(p.lives),next=Math.max(0,Math.min(maxLives(p.region),Number(value)));if(next===before)return;const beforeSnapshot=snapshotPokemon(p);
  p.lives=next;if(next<before){p.lifeHistory=Array.isArray(p.lifeHistory)?p.lifeHistory:[];p.lifeHistory.push({region:p.region||state.currentRegion,remaining:p.lives,at:new Date().toISOString()});}
  if(p.lives===0){p.inTeam=false;p.outRegion=p.outRegion||p.region||state.currentRegion;if(before>0)newlyUnusableId=p.id;}else if(before===0&&next>0){p.outRegion=null;}
  normalizeTeamOrder(p.region);logAction(`${p.nickname||p.species}: ${before} → ${next} vidas`,'life',p.region);persist();
  pendingUndo={pokemonId:p.id,snapshot:beforeSnapshot};clearTimeout(undoTimer);showToast(`${p.nickname||p.species}: ${before} → ${next} vidas`,next===0?'Pasó a Pokémon inutilizables.':'Cambio guardado.',undoLastLife);undoTimer=setTimeout(()=>{pendingUndo=null;},6500);
}
function undoLastLife(){if(!pendingUndo)return;const target=state.pokemon.find(p=>p.id===pendingUndo.pokemonId);if(!target){pendingUndo=null;return;}const restored=deepCopy(pendingUndo.snapshot);Object.keys(target).forEach(k=>delete target[k]);Object.assign(target,restored);normalizeTeamOrder(target.region);logAction(`Deshecho cambio de vidas de ${target.nickname||target.species}`,'undo',target.region);pendingUndo=null;clearTimeout(undoTimer);persist();showToast('Cambio deshecho',`${target.nickname||target.species} volvió a ${target.lives} vidas.`);}
function setLifeFromHeart(id,heartValue){const p=state.pokemon.find(x=>x.id===id);if(!p)return;const current=Number(p.lives);setLife(id,current===heartValue?heartValue-1:heartValue);}

function statsNavMons(){return statsContext==='team'?teamMons():[];}
function renderStatsModal(){
  const p=state.pokemon.find(x=>x.id===statsOpenId),body=$('stats-modal-body'),nav=$('stats-modal-nav');if(!p||!body)return;
  const dex=p.dexId?`#${String(p.dexId).padStart(4,'0')}`:'';
  body.innerHTML=`<div class="stats-hero"><div class="stats-hero-visual">${pokemonImg(p)}</div><div class="stats-identity"><div class="stats-kicker">${esc(p.region)}${dex?` · ${dex}`:''}</div><h2>${esc(p.nickname||p.species)}</h2>${p.nickname?`<div class="stats-species-name">${esc(p.species)}</div>`:''}<div class="type-row stats-types">${typePills(p.types)}</div><div class="stats-life-summary"><span>${hearts(p.lives,maxLives(p.region))}</span><strong>${Number(p.lives)===0?'INUTILIZABLE':`${p.lives}/${maxLives(p.region)} vidas`}</strong></div>${speciesHistoryHtml(p)}<div class="stats-evolution-action"><div><strong>EVOLUCIÓN</strong><span>Mantiene apodo, vidas, región, equipo e historial.</span></div><button class="btn small primary" type="button" data-evolve-pokemon="${esc(p.id)}">Evolucionar</button></div></div></div><div class="base-stats-panel stats-sections"><details class="stats-section" open><summary><strong>STATS BASE</strong><span>Total ${bst(p)}</span><i>⌄</i></summary><div class="stats-section-content base-stats-list">${statBars(p.stats)}</div></details><details class="stats-section" open><summary><strong>EFICACIA DEFENSIVA</strong><span>${(p.types||[]).map(titleCase).join(' / ')}</span><i>⌄</i></summary><div class="stats-section-content">${typeDefensePanel(p.types)}</div></details><details class="stats-section offense-section"><summary><strong>EFICACIA OFENSIVA</strong><span>${(p.types||[]).map(titleCase).join(' / ')}</span><i>⌄</i></summary><div class="stats-section-content">${typeOffensePanel(p.types)}</div></details></div>`;
  body.querySelector('[data-evolve-pokemon]')?.addEventListener('click',()=>openEvolution(p.id));
  const mons=statsNavMons(),pos=mons.findIndex(x=>x.id===p.id);if(statsContext==='team'&&pos>=0&&mons.length>1){nav.hidden=false;$('stats-position').textContent=`${pos+1} / ${mons.length}`;}else nav.hidden=true;
}
async function openStats(id,context='team'){const p=state.pokemon.find(x=>x.id===id);if(!p)return;statsOpenId=id;statsContext=context;const modal=$('modal-stats');renderStatsModal();if(typeof modal.showModal==='function'){if(!modal.open)modal.showModal();}else modal.classList.add('open');if(!hasStats(p)){await ensurePokemonStats(p);renderStatsModal();renderList();renderTeamAnalysis();}}
function closeStats(){const modal=$('modal-stats');if(typeof modal.close==='function'&&modal.open)modal.close();else modal.classList.remove('open');statsOpenId=null;}
function moveStats(delta){const mons=statsNavMons();if(!mons.length)return;let i=mons.findIndex(x=>x.id===statsOpenId);if(i<0)i=0;i=(i+delta+mons.length)%mons.length;statsOpenId=mons[i].id;renderStatsModal();ensurePokemonStats(mons[i]).then(()=>{renderStatsModal();renderTeamAnalysis();});}

async function openEvolution(id){
  if(evolutionLoading)return;
  const p=state.pokemon.find(x=>x.id===id);if(!p)return;
  evolutionSourceId=id;
  const modal=$('modal-evolution'),list=$('evolution-list'),desc=$('evolution-description');
  desc.textContent=`${p.nickname||p.species} · ${p.species}`;
  list.innerHTML='<div class="evolution-loading">Consultando evoluciones…</div>';
  if(typeof modal.showModal==='function'){if(!modal.open)modal.showModal();}else modal.classList.add('open');
  evolutionLoading=true;
  try{
    const cards=await evolutionCards(p);
    if(!cards.length){list.innerHTML='<div class="evolution-empty"><strong>Sin evolución posterior</strong><span>Esta especie no tiene una evolución directa registrada.</span></div>';return;}
    list.innerHTML=cards.map(d=>{const blocked=usedInPriorRegion(d.slug,p.region);return `<button class="evolution-option ${blocked?'blocked':''}" type="button" data-evolution="${esc(d.slug)}" ${blocked?'disabled':''}><div class="evolution-visual">${pokemonImg({species:d.species,slug:d.slug,autoImage:d.autoImage,fallbackImage:d.fallbackImage,imageCandidates:d.imageCandidates||[]})}</div><div class="evolution-copy"><span>EVOLUCIONAR A</span><strong>${esc(d.species)}</strong><div class="type-row compact">${typePills(d.types||[])}</div>${hasStats(d)?`<small>BST ${bst(d)}</small>`:''}${blocked?`<em>USADO EN ${esc(blocked.toUpperCase())}</em>`:''}</div><div class="evolution-arrow">→</div></button>`;}).join('');
    list.querySelectorAll('[data-evolution]').forEach(btn=>btn.onclick=()=>evolvePokemon(id,btn.dataset.evolution));
  }catch(e){console.warn(e);list.innerHTML='<div class="evolution-empty"><strong>No pude cargar las evoluciones</strong><span>Comprueba la conexión e inténtalo otra vez.</span></div>';}
  finally{evolutionLoading=false;}
}
function closeEvolution(){const modal=$('modal-evolution');if(typeof modal.close==='function'&&modal.open)modal.close();else modal.classList.remove('open');evolutionSourceId=null;}
async function evolvePokemon(id,newSlug){
  if(evolutionLoading)return;
  const p=state.pokemon.find(x=>x.id===id);if(!p)return;
  const oldSnapshot=deepCopy(p),oldSpecies=p.species,oldSlug=p.slug,region=p.region;
  evolutionLoading=true;
  try{
    const d=await fetchDexPokemon(newSlug);
    const blocked=usedInPriorRegion(d.slug,region);if(blocked){alert(`${d.species} ya fue utilizado en ${blocked} y no está disponible en ${region}.`);return;}
    const usedBefore=(state.usedByRegion?.[region]||[]).includes(d.slug);
    const hist=speciesHistoryEntries(p);
    if(!hist.some(x=>x.slug===oldSlug))hist.push({slug:oldSlug,species:oldSpecies,at:null});
    hist.push({slug:d.slug,species:d.species,at:new Date().toISOString()});
    p.speciesHistory=hist.filter((x,i,a)=>a.findIndex(y=>y.slug===x.slug)===i);
    addUsed(region,oldSlug);addUsed(region,d.slug);
    p.species=d.species;p.slug=d.slug;p.dexId=d.id;p.types=d.types||[];p.stats=d.stats||{};p.autoImage=d.autoImage||'';p.fallbackImage=d.fallbackImage||'';p.imageCandidates=d.imageCandidates||[];p.customImage='';p.image=state.imageOverrides?.[d.slug]||d.autoImage||d.fallbackImage||'';
    logAction(`${oldSpecies} → ${d.species}`,'evolution',region);
    closeEvolution();persist();
    if(statsOpenId===id)renderStatsModal();
    showToast('Evolución registrada',`${oldSpecies} → ${d.species}`,()=>{
      const target=state.pokemon.find(x=>x.id===id);if(!target)return;
      Object.keys(target).forEach(k=>delete target[k]);Object.assign(target,deepCopy(oldSnapshot));
      if(!usedBefore){const inUse=state.pokemon.some(mon=>mon.id!==id&&mon.region===region&&(mon.slug===d.slug||speciesHistoryEntries(mon).some(x=>x.slug===d.slug)));if(!inUse)state.usedByRegion[region]=(state.usedByRegion[region]||[]).filter(x=>x!==d.slug);}
      logAction(`Deshecha evolución ${oldSpecies} → ${d.species}`,'undo',region);persist();if(statsOpenId===id)renderStatsModal();
    });
  }catch(e){console.warn(e);alert('No pude completar la evolución. Comprueba la conexión e inténtalo otra vez.');}
  finally{evolutionLoading=false;}
}

function refreshLivesSelect(region){const sel=$('poke-lives');if(!sel)return;const max=maxLives(region),current=Math.min(max,Number(sel.value)||max);sel.innerHTML=Array.from({length:max+1},(_,i)=>{const v=max-i;return `<option value="${v}">${v===0?'0 · Inutilizable':`${v} ${v===1?'vida':'vidas'}`}</option>`;}).join('');sel.value=String(current);}
function resetModal(addToTeam=false){selectedDex=null;$('poke-species-search').value='';$('poke-nickname').value='';$('poke-region').value=state.currentRegion;refreshLivesSelect(state.currentRegion);$('poke-lives').value=String(maxLives(state.currentRegion));$('poke-level').value='';$('poke-image').value='';$('poke-team').checked=!!addToTeam;$('poke-champion').checked=false;$('species-results').innerHTML='';$('species-results').classList.remove('open');$('species-note').textContent='Escribe al menos 2 letras y selecciona un resultado.';renderSelectedSpecies();}
function openEdit(id=null,addToTeam=false){editingId=id;resetModal(addToTeam);const p=id?state.pokemon.find(x=>x.id===id):null;$('poke-modal-title').textContent=p?'Editar Pokémon':'Añadir Pokémon';$('delete-poke').style.display=p?'inline-flex':'none';if(p){selectedDex={id:p.dexId||null,slug:p.slug||String(p.species).toLowerCase(),species:p.species,types:p.types||[],stats:p.stats||{},autoImage:p.autoImage||p.image||'',fallbackImage:p.fallbackImage||'',imageCandidates:p.imageCandidates||[]};$('poke-species-search').value=p.species;$('poke-nickname').value=p.nickname||'';$('poke-region').value=p.region;refreshLivesSelect(p.region);$('poke-lives').value=String(p.lives??maxLives(p.region));$('poke-level').value=p.level||'';$('poke-image').value=p.customImage||'';$('poke-team').checked=!!p.inTeam;$('poke-champion').checked=!!p.champion;$('species-note').textContent='Especie guardada. Para registrar una evolución, usa Evolucionar desde la ficha de stats.';renderSelectedSpecies();}const modal=$('modal-pokemon');if(typeof modal.showModal==='function'){if(!modal.open)modal.showModal();}else modal.classList.add('open');setTimeout(()=>$('poke-species-search').focus(),50);}
function closeEdit(){const modal=$('modal-pokemon');if(typeof modal.close==='function'&&modal.open)modal.close();else modal.classList.remove('open');editingId=null;selectedDex=null;}
function persistFromModal(){
  if(!selectedDex?.species){alert('Selecciona una especie de la búsqueda.');return;}
  const data={species:selectedDex.species,slug:selectedDex.slug,dexId:selectedDex.id,types:selectedDex.types||[],stats:selectedDex.stats||{},autoImage:selectedDex.autoImage||'',fallbackImage:selectedDex.fallbackImage||'',imageCandidates:selectedDex.imageCandidates||[],customImage:$('poke-image').value.trim(),nickname:$('poke-nickname').value.trim(),region:$('poke-region').value,level:$('poke-level').value.trim(),lives:Number($('poke-lives').value),inTeam:$('poke-team').checked,champion:$('poke-champion').checked};if(data.lives===0)data.inTeam=false;data.image=data.customImage||data.autoImage||data.fallbackImage||'';
  const blockedRegion=usedInPriorRegion(data.slug,data.region);if(blockedRegion){alert(`Este Pokémon ya fue utilizado en ${blockedRegion} y no está disponible en ${data.region}.`);return;}
  if(data.customImage)state.imageOverrides[data.slug]=data.customImage;addUsed(data.region,data.slug);if(data.champion)addUsed(data.region,data.slug);
  if(data.inTeam){const otherTeam=teamMonsForRegion(data.region).filter(p=>p.id!==editingId);if(otherTeam.length>=6){alert('Esa región ya tiene 6 Pokémon en el equipo actual.');return;}}
  if(editingId){const target=state.pokemon.find(p=>p.id===editingId);if(target){const beforeLives=Number(target.lives),beforeTeam=!!target.inTeam,beforeSlug=target.slug,beforeSpecies=target.species,oldHistory=speciesHistoryEntries(target);Object.assign(target,data);if(beforeSlug!==data.slug){const corrected=oldHistory.map((entry,i)=>i===oldHistory.length-1&&entry.slug===beforeSlug?{slug:data.slug,species:data.species,at:entry.at}:entry);target.speciesHistory=corrected.filter((x,i,a)=>a.findIndex(y=>y.slug===x.slug)===i);logAction(`Especie corregida: ${beforeSpecies} → ${data.species}`,'edit',data.region);}else target.speciesHistory=oldHistory;if(data.inTeam&&!Number.isFinite(Number(target.teamOrder)))target.teamOrder=nextTeamOrder(data.region);if(beforeLives!==Number(data.lives))logAction(`${target.nickname||target.species}: ${beforeLives} → ${data.lives} vidas (edición)`,'life',data.region);if(beforeTeam!==!!data.inTeam)logAction(`${target.nickname||target.species} ${data.inTeam?'entró al':'salió del'} equipo`,'team',data.region);}}
  else{const created={id:uid(),...data,speciesHistory:[{slug:data.slug,species:data.species,at:new Date().toISOString()}]};if(created.inTeam)created.teamOrder=nextTeamOrder(created.region);state.pokemon.push(created);logAction(`${created.nickname||created.species} añadido a ${created.region}`,'add',created.region);}
  normalizeTeamOrder(data.region);closeEdit();persist();
}

function renderUsed(){const r=$('used-region')?.value||'Kanto',arr=[...(state.usedByRegion?.[r]||[])].sort();if($('used-count'))$('used-count').textContent=String(Object.values(state.usedByRegion||{}).flat().length);if($('used-summary'))$('used-summary').innerHTML=`<strong>${r}</strong><span>${arr.length} especies registradas</span>`;if($('used-chips'))$('used-chips').innerHTML=arr.length?arr.map(sl=>`<span class="used-chip">${esc(titleCase(sl))}<button data-remove-used="${esc(sl)}" title="Quitar">×</button></span>`).join(''):'<div class="empty compact-empty">No hay especies registradas en esta región.</div>';$('used-chips')?.querySelectorAll('[data-remove-used]').forEach(b=>b.onclick=()=>{state.usedByRegion[r]=state.usedByRegion[r].filter(x=>x!==b.dataset.removeUsed);persist();});}
async function importUsedList(){const r=$('used-region').value,raw=$('used-bulk').value,names=raw.split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean);if(!names.length)return;let added=0,unknown=[];for(const name of names){let slug=slugify(name);const exact=pokemonIndex.find(p=>p.name===slug)||pokemonIndex.find(p=>titleCase(p.name).toLowerCase()===name.toLowerCase());if(exact)slug=exact.name;else{try{const d=await fetchDexPokemon(slug);slug=d.slug;}catch{unknown.push(name);continue;}}const before=(state.usedByRegion[r]||[]).length;addUsed(r,slug);if((state.usedByRegion[r]||[]).length>before)added++;}$('used-bulk').value='';logAction(`${added} especies cargadas en utilizados de ${r}`,'used',r);persist();alert(`${added} Pokémon añadidos${unknown.length?`. No reconocidos: ${unknown.join(', ')}`:''}.`);}
function renderSettings(){const r=$('settings-region')?.value||state.currentRegion;if($('region-max-lives'))$('region-max-lives').value=String(maxLives(r));renderUsed();}
function renderHistory(){const arr=state.actionHistory||[];$('history-count').textContent=String(arr.length);$('action-history').innerHTML=arr.length?arr.slice(0,10).map(a=>`<div class="history-item history-${esc(a.type)}"><span class="history-dot"></span><div><strong>${esc(a.message)}</strong><small>${esc(a.region||'')} · ${esc(formatActionTime(a.at))}</small></div></div>`).join(''):'<div class="empty compact-empty">Todavía no hay actividad registrada.</div>';}

function exportCobblemon(){const blob=new Blob([JSON.stringify({app:'FX Tools Cobblemon',version:6,exportedAt:new Date().toISOString(),state},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`fx-tools-cobblemon-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
async function importCobblemonFile(file){try{const j=JSON.parse(await file.text()),incoming=j.state||j?.data?.['cobblemon.state']||j;if(!incoming||!Array.isArray(incoming.pokemon))throw new Error();if(!confirm('Esto reemplazará los datos actuales de Cobblemon. ¿Continuar?'))return;state=incoming;migrateOldData();persist();renderSettings();alert('Copia importada correctamente.');}catch{alert('No pude importar ese archivo.');}}

function checkImage(url,timeout=4500){return new Promise(resolve=>{if(!url){resolve(false);return;}const img=new Image(),timer=setTimeout(()=>{img.onload=img.onerror=null;resolve(false);},timeout);img.onload=()=>{clearTimeout(timer);resolve(true);};img.onerror=()=>{clearTimeout(timer);resolve(false);};img.src=url;});}
async function findWorkingImage(p){const arr=imageCandidates(p);for(let i=0;i<arr.length;i++){if(await checkImage(arr[i]))return {url:arr[i],index:i};}return null;}
async function reviewImages(){
  const btn=$('review-images'),status=$('image-review-status'),results=$('image-review-results'),mons=[...state.pokemon];if(!mons.length){status.textContent='Sin Pokémon registrados';results.innerHTML='';return;}btn.disabled=true;imageReviewIssues=[];let done=0;status.textContent=`Revisando 0/${mons.length}…`;results.innerHTML='';
  const checks=mons.map(async p=>{const working=await findWorkingImage(p);done++;status.textContent=`Revisando ${done}/${mons.length}…`;if(!working){imageReviewIssues.push({id:p.id,kind:'missing'});}else if(working.index>0){imageReviewIssues.push({id:p.id,kind:'fallback'});if(!state.imageOverrides?.[p.slug])state.imagePreferences[p.slug]=working.url;}});
  await Promise.all(checks);FXStorage.set(KEY,state);btn.disabled=false;const missing=imageReviewIssues.filter(x=>x.kind==='missing').length,fallback=imageReviewIssues.filter(x=>x.kind==='fallback').length;status.textContent=missing?`${missing} sin visual · ${fallback} con fallback`:fallback?`Todo carga · ${fallback} usan fallback`:'Todo correcto';results.innerHTML=imageReviewIssues.length?imageReviewIssues.map(issue=>{const p=state.pokemon.find(x=>x.id===issue.id);if(!p)return '';return `<button class="image-issue ${issue.kind}" type="button" data-image-edit="${p.id}"><strong>${esc(p.nickname||p.species)}</strong><span>${issue.kind==='missing'?'Sin visual disponible':'Se corrigió usando fallback'}</span></button>`;}).join(''):'<div class="image-review-ok">✓ Todos los Pokémon tienen una imagen válida.</div>';results.querySelectorAll('[data-image-edit]').forEach(b=>b.onclick=()=>openEdit(b.dataset.imageEdit));renderAll();}

function renderAll(){
  $('current-region').value=state.currentRegion;$('gym-number').value=state.currentGym;
  renderProgression();renderTeam();renderList();renderRegions();renderPreview();renderUnusable();renderTeamAnalysis();renderRules();renderUsed();renderHistory();
}

function wireEvents(){
  document.addEventListener('click',e=>{
    const addBtn=e.target.closest('#add-pokemon, #add-pokemon-secondary');if(addBtn){e.preventDefault();openEdit();return;}
    const finalize=e.target.closest('[data-finalize-region]');if(finalize){finalizeRegion(finalize.dataset.finalizeRegion);return;}
    const reopen=e.target.closest('[data-reopen-region]');if(reopen){reopenRegion(reopen.dataset.reopenRegion);return;}
    const next=e.target.closest('[data-next-region]');if(next){goToRegion(next.dataset.nextRegion);return;}
  });
  const modal=$('modal-pokemon');modal.addEventListener('click',e=>{if(e.target===modal)closeEdit();});
  const statsModal=$('modal-stats');statsModal.addEventListener('click',e=>{if(e.target===statsModal)closeStats();});
  const replaceModal=$('modal-replace');replaceModal.addEventListener('click',e=>{if(e.target===replaceModal)closeReplace();});
  const evolutionModal=$('modal-evolution');evolutionModal.addEventListener('click',e=>{if(e.target===evolutionModal)closeEvolution();});
  $('close-stats').onclick=closeStats;$('stats-prev').onclick=()=>moveStats(-1);$('stats-next').onclick=()=>moveStats(1);$('close-evolution').onclick=closeEvolution;
  $('add-pokemon').onclick=()=>openEdit();$('add-pokemon-secondary').onclick=()=>openEdit();$('close-poke').onclick=closeEdit;$('cancel-poke').onclick=closeEdit;$('save-poke').onclick=persistFromModal;
  $('close-replace').onclick=closeReplace;$('replace-search').oninput=renderReplaceList;
  $('delete-poke').onclick=()=>{if(!editingId)return;const p=state.pokemon.find(x=>x.id===editingId);if(confirm('¿Eliminar este Pokémon del tracker?')){if(p)logAction(`${p.nickname||p.species} eliminado del registro`,'delete',p.region);state.pokemon=state.pokemon.filter(p=>p.id!==editingId);closeEdit();persist();}};
  $('poke-search').oninput=renderList;$('filter-region').onchange=renderList;$('filter-status').onchange=renderList;$('sort-pokemon').onchange=renderList;
  $('current-region').onchange=e=>{state.currentRegion=e.target.value;state.currentGym=Math.max(1,Math.min(8,Number(state.gymByRegion?.[state.currentRegion])||1));state.gymByRegion[state.currentRegion]=state.currentGym;persist();};
  $('gym-number').onchange=e=>{state.currentGym=Math.max(1,Math.min(8,Number(e.target.value)||1));state.gymByRegion[state.currentRegion]=state.currentGym;persist();};
  $('overlay-popout').onclick=()=>window.open('overlay/','FXCobbleOverlay','width=1200,height=360');
  $('poke-species-search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(renderSpeciesSuggestions,80);});
  $('poke-species-search').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();const first=$('species-results').querySelector('[data-species]');if(first)selectSpecies(first.dataset.species);}});
  $('restore-auto-image').onclick=()=>{$('poke-image').value='';};
  document.addEventListener('click',e=>{if(!e.target.closest('.species-search-wrap'))$('species-results').classList.remove('open');});
  $('poke-region').onchange=e=>{refreshLivesSelect(e.target.value);if(selectedDex){const b=usedInPriorRegion(selectedDex.slug,e.target.value);$('species-note').textContent=b?`No disponible: ya fue utilizado en ${b}.`:'Ficha automática cargada.';}};
  $('used-region').onchange=renderUsed;$('add-used-list').onclick=importUsedList;$('clear-used-region').onclick=()=>{const r=$('used-region').value;if(confirm(`¿Vaciar la lista de ${r}?`)){state.usedByRegion[r]=[];logAction(`Lista de utilizados de ${r} vaciada`,'used',r);persist();}};
  $('settings-region').onchange=renderSettings;$('region-max-lives').onchange=e=>{const r=$('settings-region').value,max=Math.max(1,Math.min(9,Number(e.target.value)||3)),before=maxLives(r);state.regionSettings[r]={...(state.regionSettings[r]||{}),maxLives:max};state.pokemon.filter(p=>p.region===r).forEach(p=>p.lives=Math.min(Number(p.lives),max));if(before!==max)logAction(`${r}: máximo de vidas ${before} → ${max}`,'settings',r);persist();renderSettings();};
  $('export-cobblemon').onclick=exportCobblemon;$('import-cobblemon').onclick=()=>$('import-file').click();$('import-file').onchange=e=>{const f=e.target.files?.[0];if(f)importCobblemonFile(f);e.target.value='';};
  $('clear-history').onclick=()=>{if(confirm('¿Vaciar la actividad reciente?')){state.actionHistory=[];persist();}};
  $('review-images').onclick=reviewImages;
}

document.addEventListener('DOMContentLoaded',()=>{migrateOldData();renderAll();renderSettings();loadPokemonIndex();wireEvents();});
