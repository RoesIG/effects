window.FXTeams = (() => {
  let presets=[];
  let activeId='';
  const uid=()=> 't_'+Math.random().toString(36).slice(2,9);

  function shuffle(items) {
    const a=[...items];
    for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
    return a;
  }

  function generate(players,count) {
    const shuffled=shuffle(players);
    const teams=Array.from({length:count},()=>[]);
    shuffled.forEach((p,i)=>teams[i%count].push(p));
    return teams;
  }

  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

  function render(teams) {
    const out=document.getElementById('teams-output'); if(!out)return;
    out.innerHTML='';
    teams.forEach((team,i)=>{
      const box=document.createElement('div'); box.className='team-box';
      box.innerHTML=`<div class="team-box-head"><h4>Equipo ${i+1}</h4><span>${team.length}</span></div><ul>${team.map(name=>`<li>${esc(name)}</li>`).join('')}</ul>`;
      out.appendChild(box);
    });
    FXStorage.set('teams.lastResult',teams);
  }

  function loadPresets(){
    const old=FXStorage.get('teams.players','Player1, Player2, Player3, Player4, Player5, Player6');
    const stored=FXStorage.get('teams.presets',null);
    presets=Array.isArray(stored)&&stored.length?stored:[{id:uid(),name:'Principal',players:old}];
    activeId=FXStorage.get('teams.activePreset',presets[0].id);
    if(!presets.some(p=>p.id===activeId))activeId=presets[0].id;
    FXStorage.set('teams.presets',presets);
  }

  function active(){return presets.find(p=>p.id===activeId)||presets[0]}
  function save(){FXStorage.set('teams.presets',presets);FXStorage.set('teams.activePreset',activeId);FXStorage.set('teams.players',active()?.players||'');}
  function renderPresetSelect(){
    const el=document.getElementById('team-preset-select');if(!el)return;
    el.innerHTML=presets.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');el.value=activeId;
  }
  function switchPreset(id){
    if(!presets.some(p=>p.id===id))return;activeId=id;save();renderPresetSelect();
    const input=document.getElementById('players-input');if(input)input.value=active().players||'';
  }
  function savePreset(name,players){
    const cleaned=(name||'Grupo').trim().slice(0,40)||'Grupo';
    const existing=presets.find(p=>p.id===activeId);
    if(existing){existing.name=cleaned;existing.players=players;}else{presets.push({id:uid(),name:cleaned,players});}
    save();renderPresetSelect();
  }
  function newPreset(){const p={id:uid(),name:'Nuevo grupo',players:''};presets.push(p);activeId=p.id;save();renderPresetSelect();const input=document.getElementById('players-input');if(input)input.value='';return p;}
  function deletePreset(){if(presets.length<=1)throw new Error('Debe quedar al menos un grupo.');const i=presets.findIndex(p=>p.id===activeId);presets.splice(i,1);activeId=presets[Math.max(0,i-1)].id;save();renderPresetSelect();const input=document.getElementById('players-input');if(input)input.value=active().players||'';}

  function init(){
    const input=document.getElementById('players-input'); if(!input)return;
    loadPresets();renderPresetSelect();input.value=active().players||'';
    let count=Math.min(8,Math.max(2,Number(FXStorage.get('teams.count',2))||2)); const countEl=document.getElementById('teams-count');
    const sync=()=>{countEl.textContent=count; FXStorage.set('teams.count',count);}; sync();
    document.getElementById('teams-minus').onclick=()=>{if(count>2){count--;sync();}};
    document.getElementById('teams-plus').onclick=()=>{if(count<8){count++;sync();}};
    document.getElementById('generate-teams').onclick=()=>{
      const players=input.value.split(/[,\n]/).map(x=>x.trim()).filter(Boolean);
      if(players.length<2){window.FXUI.toast('Faltan nombres','Escribe al menos 2 participantes.');return;}
      if(count>players.length){window.FXUI.toast('Demasiados equipos','No puede haber más equipos que participantes.');return;}
      active().players=input.value;save();render(generate(players,count));window.FXApp?.markUsed?.('teams');
    };
    document.getElementById('team-preset-select')?.addEventListener('change',e=>switchPreset(e.target.value));
    document.getElementById('team-new-preset')?.addEventListener('click',()=>{newPreset();window.FXUI.toast('Nuevo grupo','Escribe los participantes y guárdalo.');});
    document.getElementById('team-save-preset')?.addEventListener('click',()=>{
      const name=prompt('Nombre del grupo:',active().name||'Grupo');if(name===null)return;savePreset(name,input.value);window.FXUI.toast('Grupo guardado',name.trim()||'Grupo');
    });
    document.getElementById('team-delete-preset')?.addEventListener('click',()=>{try{deletePreset();window.FXUI.toast('Grupo eliminado','Se cargó el grupo anterior.');}catch(e){window.FXUI.toast('No se puede eliminar',e.message);}});
    const last=FXStorage.get('teams.lastResult',null);if(Array.isArray(last)&&last.length)render(last);
  }
  return {init,shuffle,generate};
})();
