window.FXUI = (()=>{
  const openModal=id=>{const el=document.getElementById(id);if(!el)return;el.classList.add('open');document.body.classList.add('modal-open');setTimeout(()=>el.querySelector('input:not([type=checkbox]),textarea,select')?.focus(),20);};
  const closeModal=id=>{document.getElementById(id)?.classList.remove('open');if(!document.querySelector('.modal-backdrop.open'))document.body.classList.remove('modal-open');};
  const toast=(title,text,action)=>{
    const wrap=document.querySelector('.toast-wrap');if(!wrap)return;
    const t=document.createElement('div');t.className='toast';t.innerHTML='<div><strong></strong><span></span></div>'+(action?'<button class="toast-action"></button>':'');
    t.querySelector('strong').textContent=title;t.querySelector('span').textContent=text||'';
    if(action){const b=t.querySelector('button');b.textContent=action.label;b.onclick=()=>{action.run?.();t.remove();};}
    wrap.appendChild(t);setTimeout(()=>t.remove(),4200);
  };
  return {openModal,closeModal,toast};
})();

window.FXApp = (()=>{
  const tools=[
    {id:'cobblemon',name:'Cobblemon',desc:'Equipo, vidas, regiones, stats y análisis.',icon:'◉',type:'link',href:'cobblemon/',group:'Especial'},
    {id:'roulette',name:'Ruleta',desc:'Opciones, presets, historial y modo sin repetición.',icon:'⟳',type:'section',target:'ruleta',group:'Azar'},
    {id:'teams',name:'Equipos',desc:'Grupos guardados y reparto aleatorio equilibrado.',icon:'⌘',type:'section',target:'equipos',group:'Organización'},
    {id:'coin',name:'Cara o cruz',desc:'Una decisión binaria al instante.',icon:'◐',type:'modal',target:'modal-coin',group:'Azar'},
    {id:'random',name:'Número aleatorio',desc:'Entero aleatorio dentro del rango que elijas.',icon:'⌗',type:'modal',target:'modal-random',group:'Azar'},
    {id:'timer',name:'Temporizador',desc:'Cuenta regresiva con horas, minutos y segundos.',icon:'◷',type:'modal',target:'modal-timer',group:'Tiempo'},
    {id:'stopwatch',name:'Cronómetro',desc:'Cronómetro preciso con vueltas guardadas.',icon:'◴',type:'modal',target:'modal-stopwatch',group:'Tiempo'},
    {id:'counters',name:'Contadores',desc:'Varios marcadores rápidos con nombre propio.',icon:'＋',type:'modal',target:'modal-counters',group:'Registro'},
    {id:'checklist',name:'Checklist',desc:'Lista rápida y persistente para objetivos.',icon:'✓',type:'modal',target:'modal-checklist',group:'Organización'},
    {id:'bracket',name:'Torneo',desc:'Cuadro eliminatorio interactivo de hasta 64 nombres.',icon:'◇',type:'modal',target:'modal-bracket',group:'Organización'},
    {id:'chat',name:'Chat de Twitch',desc:'Chat integrado con canal configurable.',icon:'◌',type:'section',target:'chat',group:'Integraciones'}
  ];
  const defaultFavorites=['cobblemon','roulette','teams','counters'];
  let favorites=[];let recent=[];

  const tool=id=>tools.find(t=>t.id===id);
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  function open(id){const t=tool(id);if(!t)return;if(t.type==='link'){location.href=t.href;return;}if(t.type==='modal'){FXUI.openModal(t.target);}else{document.getElementById(t.target)?.scrollIntoView({behavior:'smooth',block:'start'});}markUsed(id);}
  function markUsed(id){if(!tool(id))return;recent=[id,...recent.filter(x=>x!==id)].slice(0,6);FXStorage.set('app.recentTools',recent);renderRecent();}
  function toggleFavorite(id){favorites=favorites.includes(id)?favorites.filter(x=>x!==id):[...favorites,id];FXStorage.set('app.favorites',favorites);renderFavorites();renderLibrary();}
  function card(t,{small=false}={}){const fav=favorites.includes(t.id);return `<article class="tool-tile ${small?'small':''}" data-open-tool="${t.id}"><button class="favorite-btn ${fav?'active':''}" type="button" data-favorite="${t.id}" title="${fav?'Quitar de fijados':'Fijar herramienta'}">${fav?'★':'☆'}</button><div class="tool-symbol">${t.icon}</div><div class="tool-tile-copy"><strong>${esc(t.name)}</strong><p>${esc(t.desc)}</p></div><span class="tool-arrow">→</span></article>`;}
  function bindToolCards(root=document){root.querySelectorAll('[data-open-tool]').forEach(el=>{el.onclick=e=>{if(e.target.closest('[data-favorite]'))return;open(el.dataset.openTool);};});root.querySelectorAll('[data-favorite]').forEach(b=>{b.onclick=e=>{e.stopPropagation();toggleFavorite(b.dataset.favorite);};});}
  function renderFavorites(){const wrap=document.getElementById('favorite-tools');if(!wrap)return;const list=favorites.map(tool).filter(Boolean);wrap.innerHTML=list.length?list.map(t=>card(t,{small:true})).join(''):'<div class="empty-favorites">No hay herramientas fijadas. Usa ☆ en cualquier herramienta para añadirla aquí.</div>';bindToolCards(wrap);const count=document.getElementById('favorite-count');if(count)count.textContent=list.length;}
  function renderRecent(){const wrap=document.getElementById('recent-tools');if(!wrap)return;const list=recent.map(tool).filter(Boolean);wrap.innerHTML=list.length?list.map(t=>`<button class="recent-chip" type="button" data-open-tool="${t.id}"><span>${t.icon}</span>${esc(t.name)}</button>`).join(''):'<span class="empty-inline">Aún no has abierto ninguna herramienta.</span>';bindToolCards(wrap);}
  function renderLibrary(){const wrap=document.getElementById('tool-library');if(!wrap)return;wrap.innerHTML=tools.filter(t=>t.id!=='roulette'&&t.id!=='teams').map(t=>card(t)).join('');bindToolCards(wrap);}
  function renderCobbleStatus(){
    const state=FXStorage.get('cobblemon.state',null),box=document.getElementById('cobble-status');if(!box)return;
    if(!state){box.innerHTML='<span>Sin datos todavía</span><strong>Cobblemon listo para configurar</strong>';return;}
    const region=state.currentRegion||'Hoenn';const gym=Number(state.regionGyms?.[region]||state.currentGym||1);const mons=(state.pokemon||[]).filter(p=>p.region===region);const team=mons.filter(p=>p.inTeam&&Number(p.lives)>0).length;const out=mons.filter(p=>Number(p.lives)===0).length;
    box.innerHTML=`<div><span>Región actual</span><strong>${esc(region)} · Gimnasio ${gym}/8</strong></div><div class="cobble-status-metrics"><b>${team}<small>equipo</small></b><b>${mons.length}<small>registrados</small></b><b>${out}<small>fuera</small></b></div>`;
  }
  function renderStorage(){const b=FXStorage.estimateBytes();const kb=b/1024;const el=document.getElementById('storage-size');if(el)el.textContent=kb<1024?`${Math.max(1,Math.round(kb))} KB`:`${(kb/1024).toFixed(1)} MB`;}
  function setupCommand(){
    const input=document.getElementById('command-input'),list=document.getElementById('command-results');if(!input||!list)return;
    const render=()=>{const q=input.value.trim().toLowerCase();const found=tools.filter(t=>!q||`${t.name} ${t.desc} ${t.group}`.toLowerCase().includes(q)).slice(0,10);list.innerHTML=found.map((t,i)=>`<button type="button" class="command-item" data-command="${t.id}"><span class="command-icon">${t.icon}</span><span><strong>${esc(t.name)}</strong><small>${esc(t.group)} · ${esc(t.desc)}</small></span><kbd>${i===0?'↵':''}</kbd></button>`).join('')||'<div class="empty-box compact">No encontré una herramienta con ese nombre.</div>';list.querySelectorAll('[data-command]').forEach(b=>b.onclick=()=>{FXUI.closeModal('modal-command');open(b.dataset.command);});};
    input.addEventListener('input',render);input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();list.querySelector('[data-command]')?.click();}});render();
    document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();FXUI.openModal('modal-command');input.value='';render();setTimeout(()=>input.focus(),20);}if(e.key==='Escape'){document.querySelectorAll('.modal-backdrop.open').forEach(m=>FXUI.closeModal(m.id));closeFocus();}});
  }
  function focusPanel(id){const p=document.getElementById(id);if(!p)return;p.classList.add('panel-focus');document.body.classList.add('focus-open');p.querySelector('[data-focus]')?.setAttribute('aria-label','Cerrar modo enfoque');}
  function closeFocus(){const p=document.querySelector('.panel-focus');if(!p)return;p.classList.remove('panel-focus');document.body.classList.remove('focus-open');}
  return {tools,open,markUsed,toggleFavorite,renderFavorites,renderRecent,renderLibrary,renderCobbleStatus,renderStorage,setupCommand,focusPanel,closeFocus,bindToolCards,_load(){favorites=FXStorage.get('app.favorites',defaultFavorites);if(!Array.isArray(favorites))favorites=[...defaultFavorites];recent=FXStorage.get('app.recentTools',[]);if(!Array.isArray(recent))recent=[];}};
})();

document.addEventListener('DOMContentLoaded',()=>{
  FXApp._load();
  const settings=FXStorage.get('settings',{twitchChannel:'roesig',showChat:true,density:'comfortable'});
  document.body.dataset.density=settings.density||'comfortable';

  FXRoulette.init();FXTeams.init();FXTimer.init();FXStopwatch.init();FXCounters.init();FXChecklist.init();FXBracket.init();
  FXApp.renderFavorites();FXApp.renderRecent();FXApp.renderLibrary();FXApp.renderCobbleStatus();FXApp.renderStorage();FXApp.setupCommand();

  document.querySelectorAll('[data-modal]').forEach(el=>el.addEventListener('click',()=>{FXUI.openModal(el.dataset.modal);if(el.dataset.tool)FXApp.markUsed(el.dataset.tool);}));
  document.querySelectorAll('[data-close]').forEach(el=>el.addEventListener('click',()=>FXUI.closeModal(el.closest('.modal-backdrop').id)));
  document.querySelectorAll('.modal-backdrop').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)FXUI.closeModal(m.id);}));

  document.querySelectorAll('[data-focus]').forEach(btn=>btn.addEventListener('click',()=>{const panel=btn.closest('.panel');if(panel.classList.contains('panel-focus'))FXApp.closeFocus();else FXApp.focusPanel(panel.id);}));

  const host=window.location.hostname || 'localhost';
  const loadChat=()=>{const s=FXStorage.get('settings',settings);const channel=(s.twitchChannel||'roesig').toLowerCase().replace(/[^a-z0-9_]/g,'')||'roesig';const frame=document.getElementById('twitch-chat');if(frame&&s.showChat!==false)frame.src=`https://www.twitch.tv/embed/${channel}/chat?parent=${host}&darkpopout`;const panel=document.getElementById('chat');if(panel)panel.hidden=s.showChat===false;};
  loadChat();

  const opts=document.getElementById('roulette-options');
  document.getElementById('edit-roulette').onclick=()=>{const p=FXRoulette.getActive();opts.value=p.options.join('\n');document.getElementById('roulette-preset-name').value=p.name;FXUI.openModal('modal-roulette');};
  document.getElementById('save-roulette').onclick=()=>{try{FXRoulette.renameActive(document.getElementById('roulette-preset-name').value);FXRoulette.setOptions(opts.value.split(/[\n,]/));FXUI.closeModal('modal-roulette');FXUI.toast('Ruleta actualizada','Preset y opciones guardados.');}catch(e){FXUI.toast('No se pudo guardar',e.message);}};
  document.getElementById('roulette-new-preset').onclick=()=>{const p=FXRoulette.createPreset('Nueva ruleta');document.getElementById('roulette-preset-name').value=p.name;opts.value=p.options.join('\n');FXUI.toast('Preset creado','Puedes cambiar el nombre y las opciones.');};
  document.getElementById('roulette-delete-preset').onclick=()=>{try{FXRoulette.deleteActive();const p=FXRoulette.getActive();document.getElementById('roulette-preset-name').value=p.name;opts.value=p.options.join('\n');FXUI.toast('Preset eliminado',`Ahora usas ${p.name}.`);}catch(e){FXUI.toast('No se puede eliminar',e.message);}};

  const coin=document.getElementById('coin');
  document.getElementById('coin-flip').onclick=()=>{coin.textContent='?';coin.style.transition='transform .82s cubic-bezier(.2,.8,.2,1)';coin.style.transform='rotateY(1260deg)';setTimeout(()=>{coin.style.transition='none';coin.style.transform='rotateY(0deg)';const result=Math.random()<.5?'CARA':'CRUZ';coin.textContent=result;FXStorage.set('coin.last',result);FXApp.markUsed('coin');},820);};
  coin.textContent=FXStorage.get('coin.last','?');

  const randomHistory=FXStorage.get('random.history',[]);const renderRandomHistory=()=>{const el=document.getElementById('random-history');if(el)el.textContent=(FXStorage.get('random.history',[])||[]).slice(0,8).join(' · ')||'—';};renderRandomHistory();
  document.getElementById('random-generate').onclick=()=>{let min=Number(document.getElementById('random-min').value),max=Number(document.getElementById('random-max').value);if(!Number.isFinite(min))min=1;if(!Number.isFinite(max))max=100;if(min>max)[min,max]=[max,min];min=Math.ceil(min);max=Math.floor(max);const val=Math.floor(Math.random()*(max-min+1))+min;document.getElementById('random-result').textContent=val;const h=[val,...(FXStorage.get('random.history',[])||[])].slice(0,12);FXStorage.set('random.history',h);renderRandomHistory();FXApp.markUsed('random');};

  document.getElementById('open-command')?.addEventListener('click',()=>FXUI.openModal('modal-command'));

  document.getElementById('export-data').onclick=()=>{const blob=new Blob([FXStorage.exportJSON()],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`fx-tools-v3-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),50);FXUI.toast('Backup creado','Incluye herramientas, preferencias y Cobblemon.');};
  document.getElementById('import-data').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const count=FXStorage.importJSON(r.result);FXUI.toast('Datos importados',`${count} bloques restaurados. Recargando…`);setTimeout(()=>location.reload(),700);}catch(err){FXUI.toast('Archivo inválido',err.message);}};r.readAsText(f);};

  const sChannel=document.getElementById('settings-channel'),sChat=document.getElementById('settings-chat'),sDensity=document.getElementById('settings-density');
  if(sChannel)sChannel.value=settings.twitchChannel||'roesig';if(sChat)sChat.checked=settings.showChat!==false;if(sDensity)sDensity.value=settings.density||'comfortable';
  document.getElementById('save-settings')?.addEventListener('click',()=>{const next={...FXStorage.get('settings',{}),twitchChannel:(sChannel.value||'roesig').trim(),showChat:sChat.checked,density:sDensity.value};FXStorage.set('settings',next);document.body.dataset.density=next.density;FXUI.closeModal('modal-settings');loadChat();FXUI.toast('Preferencias guardadas','La interfaz ya usa tus nuevos ajustes.');});
  document.getElementById('open-settings')?.addEventListener('click',()=>FXUI.openModal('modal-settings'));

  window.addEventListener('fx-storage-change',()=>{FXApp.renderStorage();FXApp.renderCobbleStatus();});
});
