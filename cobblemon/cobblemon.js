const KEY='cobblemon.state';
const defaultState={currentRegion:'Hoenn',currentGym:1,regions:{Kanto:{champions:[]},Johto:{champions:[]},Hoenn:{champions:[]}},pokemon:[]};
let state=FXStorage.get(KEY,defaultState);
let editingId=null;

const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
const save=()=>{FXStorage.set(KEY,state);render();};
const uid=()=>crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const currentMons=()=>state.pokemon.filter(p=>p.region===state.currentRegion);
const teamMons=()=>currentMons().filter(p=>p.inTeam).slice(0,6);
function hearts(n){return [1,2,3].map(i=>`<span class="heart ${i<=n?'':'off'}">♥</span>`).join('');}

function renderTeam(){
  const wrap=document.getElementById('team-grid'); const mons=teamMons(); wrap.innerHTML='';
  mons.forEach(p=>{
    const card=document.createElement('div');card.className=`poke-card selected ${p.lives===0?'dead':''}`;
    card.innerHTML=`<div class="poke-top"><div><div class="poke-name">${esc(p.nickname||p.species)}</div><div class="poke-species">${esc(p.species)}${p.level?` · Nv. ${esc(p.level)}`:''}</div></div><span class="badge ${p.lives===0?'danger':'live'}">${p.lives===0?'Fuera':'Activo'}</span></div><div class="poke-visual">${p.image?`<img src="${esc(p.image)}" alt="${esc(p.species)}" onerror="this.outerHTML='<div class=&quot;poke-placeholder&quot;>PKM</div>'">`:'<div class="poke-placeholder">PKM</div>'}</div><div class="lives">${hearts(p.lives)}</div><div class="poke-actions"><button class="btn small danger" data-life="-1" data-id="${p.id}" ${p.lives===0?'disabled':''}>− vida</button><button class="btn small" data-edit="${p.id}">Editar</button></div>`;
    wrap.appendChild(card);
  });
  if(!mons.length)wrap.innerHTML='<div class="empty" style="grid-column:1/-1">Todavía no seleccionaste Pokémon para el equipo actual.</div>';
  wrap.querySelectorAll('[data-life]').forEach(b=>b.onclick=()=>changeLife(b.dataset.id,-1));
  wrap.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openEdit(b.dataset.edit));
}
function renderList(){
  const q=document.getElementById('poke-search').value.trim().toLowerCase();
  const region=document.getElementById('filter-region').value;
  const list=document.getElementById('pokemon-list');list.innerHTML='';
  const mons=state.pokemon.filter(p=>(region==='all'||p.region===region)&&(!q||`${p.nickname} ${p.species}`.toLowerCase().includes(q)));
  mons.forEach(p=>{
    const row=document.createElement('div');row.className='list-row';
    row.innerHTML=`<div class="row-title"><strong>${esc(p.nickname||p.species)}</strong><span>${esc(p.species)} · ${esc(p.region)}</span></div><div>${hearts(p.lives)}</div><div class="${p.lives?'status-active':'status-out'}">${p.lives?'Activo':'Inutilizable'}</div><div>${p.champion?'🏆 Campeón':'—'}</div><div style="display:flex;gap:5px"><button class="btn small" data-team="${p.id}">${p.inTeam?'Quitar':'Equipo'}</button><button class="btn small" data-edit="${p.id}">Editar</button></div>`;
    list.appendChild(row);
  });
  if(!mons.length)list.innerHTML='<div class="empty">No hay Pokémon que coincidan con el filtro.</div>';
  list.querySelectorAll('[data-team]').forEach(b=>b.onclick=()=>toggleTeam(b.dataset.team));
  list.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openEdit(b.dataset.edit));
}
function renderRegions(){
  document.getElementById('region-cards').innerHTML=['Kanto','Johto','Hoenn'].map(r=>{
    const champs=state.pokemon.filter(p=>p.region===r&&p.champion);
    return `<div class="region-card"><strong>${r}</strong><p>${r===state.currentRegion?'Región actual':'Historial guardado'}</p><div class="region-count">🏆 ${champs.length} campeones</div><div class="champion-list" style="margin-top:9px">${champs.slice(0,6).map(p=>`<span class="champ-chip">${esc(p.nickname||p.species)}</span>`).join('')||'<span class="panel-desc">Sin campeones cargados</span>'}</div></div>`;
  }).join('');
}
function renderPreview(){
  document.getElementById('preview-region').textContent=state.currentRegion.toUpperCase();
  document.getElementById('preview-gym').textContent=`GIMNASIO ${state.currentGym}`;
  const mons=teamMons();document.getElementById('preview-team').innerHTML=Array.from({length:6},(_,i)=>{const p=mons[i];return p?`<div class="preview-mon"><div class="dot">${p.image?`<img src="${esc(p.image)}" style="max-width:100%;max-height:100%;object-fit:contain">`:'PK'}</div><b>${esc(p.nickname||p.species)}</b><span>${'♥'.repeat(p.lives)}${'♡'.repeat(3-p.lives)}</span></div>`:`<div class="preview-mon"><div class="dot">—</div><b>VACÍO</b><span>♡♡♡</span></div>`;}).join('');
}
function render(){
  document.getElementById('current-region').value=state.currentRegion;document.getElementById('gym-number').value=state.currentGym;
  renderTeam();renderList();renderRegions();renderPreview();
}
function toggleTeam(id){const p=state.pokemon.find(x=>x.id===id);if(!p)return;if(!p.inTeam&&teamMons().length>=6){alert('El equipo actual ya tiene 6 Pokémon.');return;}p.inTeam=!p.inTeam;save();}
function changeLife(id,delta){const p=state.pokemon.find(x=>x.id===id);if(!p)return;p.lives=Math.max(0,Math.min(3,p.lives+delta));save();}
function openEdit(id=null){editingId=id;const p=id?state.pokemon.find(x=>x.id===id):null;document.getElementById('poke-modal-title').textContent=p?'Editar Pokémon':'Añadir Pokémon';
  const fields={species:p?.species||'',nickname:p?.nickname||'',region:p?.region||state.currentRegion,level:p?.level||'',image:p?.image||'',lives:p?.lives??3};Object.entries(fields).forEach(([k,v])=>document.getElementById(`poke-${k}`).value=v);
  document.getElementById('poke-team').checked=!!p?.inTeam;document.getElementById('poke-champion').checked=!!p?.champion;document.getElementById('delete-poke').style.display=p?'inline-flex':'none';document.getElementById('modal-pokemon').classList.add('open');}
function closeEdit(){document.getElementById('modal-pokemon').classList.remove('open');editingId=null;}
function persistFromModal(){
  const species=document.getElementById('poke-species').value.trim();if(!species){alert('Escribe la especie.');return;}
  const data={species,nickname:document.getElementById('poke-nickname').value.trim(),region:document.getElementById('poke-region').value,level:document.getElementById('poke-level').value.trim(),image:document.getElementById('poke-image').value.trim(),lives:Number(document.getElementById('poke-lives').value),inTeam:document.getElementById('poke-team').checked,champion:document.getElementById('poke-champion').checked};
  if(data.inTeam){const otherTeam=state.pokemon.filter(p=>p.region===data.region&&p.inTeam&&p.id!==editingId);if(otherTeam.length>=6){alert('Esa región ya tiene 6 Pokémon en el equipo actual.');return;}}
  if(editingId)Object.assign(state.pokemon.find(p=>p.id===editingId),data);else state.pokemon.push({id:uid(),...data});closeEdit();save();
}

document.addEventListener('DOMContentLoaded',()=>{
  render();
  document.getElementById('add-pokemon').onclick=()=>openEdit();document.getElementById('add-pokemon-secondary').onclick=()=>openEdit();document.getElementById('close-poke').onclick=closeEdit;document.getElementById('cancel-poke').onclick=closeEdit;document.getElementById('save-poke').onclick=persistFromModal;
  document.getElementById('delete-poke').onclick=()=>{if(!editingId)return;if(confirm('¿Eliminar este Pokémon del tracker?')){state.pokemon=state.pokemon.filter(p=>p.id!==editingId);closeEdit();save();}};
  document.getElementById('poke-search').oninput=renderList;document.getElementById('filter-region').onchange=renderList;
  document.getElementById('current-region').onchange=e=>{state.currentRegion=e.target.value;save();};document.getElementById('gym-number').onchange=e=>{state.currentGym=Math.max(1,Math.min(8,Number(e.target.value)||1));save();};
  document.getElementById('add-life-all').onclick=()=>{teamMons().forEach(p=>p.lives=Math.min(3,p.lives+1));save();};
  document.getElementById('overlay-popout').onclick=()=>window.open('overlay/','FXCobbleOverlay','width=1100,height=320');
  document.getElementById('reset-hoenn').onclick=()=>{if(confirm('Esto pondrá en 3 vidas a todos los Pokémon de Hoenn. ¿Continuar?')){state.pokemon.filter(p=>p.region==='Hoenn').forEach(p=>p.lives=3);save();}};
});
