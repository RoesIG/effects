window.FXUI = (() => {
  const openModal = id => { const modal=document.getElementById(id); if(modal) { modal.classList.add('open'); modal.querySelector('textarea,button')?.focus(); } };
  const closeModal = id => document.getElementById(id)?.classList.remove('open');
  const toast = (title,text) => {
    const wrap=document.querySelector('.toast-wrap');if(!wrap)return;
    const t=document.createElement('div');t.className='toast';
    const a=document.createElement('strong');a.textContent=title;
    const b=document.createElement('span');b.textContent=text;
    t.append(a,b);wrap.appendChild(t);setTimeout(()=>t.remove(),3400);
  };
  return {openModal,closeModal,toast};
})();

document.addEventListener('DOMContentLoaded', () => {
  // The unified chat is an independent, configurable pane. No embedded Twitch channel iframe.
  FXRoulette.init(); FXTeams.init(); FXTimer.init();

  const validStages=['roulette','coin','random','timer','teams'];
  const stageButtons=[...document.querySelectorAll('[data-stage]')];
  function activateStage(name, persist=true) {
    if(!validStages.includes(name))return;
    document.querySelectorAll('.tool-stage').forEach(panel=>{
      const active=panel.id===`stage-${name}`;
      panel.hidden=!active;panel.classList.toggle('is-current',active);
    });
    stageButtons.forEach(btn=>{
      const active=btn.dataset.stage===name;
      btn.classList.toggle('is-active',active && btn.classList.contains('stage-tab'));
      btn.classList.toggle('active-tool',active && btn.classList.contains('side-stage'));
      if(btn.getAttribute('role')==='tab')btn.setAttribute('aria-selected',active?'true':'false');
    });
    if(name==='roulette')FXRoulette.draw();
    if(persist)FXStorage.set('home.activeTool',name);
  }
  stageButtons.forEach(button=>button.addEventListener('click',()=>activateStage(button.dataset.stage)));
  document.querySelectorAll('.stage-tab').forEach((tab,index,tabs)=>tab.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();
    const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
    tabs[next].focus();activateStage(tabs[next].dataset.stage);
  }));
  activateStage(FXStorage.get('home.activeTool','roulette'),false);

  document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>FXUI.closeModal(button.closest('.modal-backdrop').id)));
  document.querySelectorAll('.modal-backdrop').forEach(modal=>modal.addEventListener('click',event=>{if(event.target===modal)FXUI.closeModal(modal.id)}));
  document.addEventListener('keydown',event=>{if(event.key==='Escape')document.querySelectorAll('.modal-backdrop.open').forEach(modal=>FXUI.closeModal(modal.id));});

  const opts=document.getElementById('roulette-options');
  document.getElementById('edit-roulette').onclick=()=>{opts.value=FXRoulette.getOptions().join(', ');FXUI.openModal('modal-roulette');};
  document.getElementById('save-roulette').onclick=()=>{try{FXRoulette.setOptions(opts.value.split(','));FXUI.closeModal('modal-roulette');FXUI.toast('Ruleta actualizada','Las opciones quedaron guardadas.');}catch(e){FXUI.toast('No se pudo guardar',e.message);}};

  // Result chosen once, before the visual animation begins.
  const coin=document.getElementById('coin');
  const coinStatus=document.getElementById('coin-status');
  const coinBtn=document.getElementById('coin-flip');
  coinBtn.onclick=()=>{
    if(coinBtn.disabled)return;
    const result=Math.random()<.5?'CARA':'CRUZ';
    coinBtn.disabled=true;coin.textContent='?';coinStatus.textContent='Lanzando…';
    coin.classList.remove('is-flipping');void coin.offsetWidth;coin.classList.add('is-flipping');
    setTimeout(()=>{coin.classList.remove('is-flipping');coin.textContent=result;coinStatus.textContent=result;coinBtn.disabled=false;},1320);
  };
  document.getElementById('random-generate').onclick=()=>{
    let min=Number(document.getElementById('random-min').value), max=Number(document.getElementById('random-max').value);
    if(!Number.isFinite(min)||!Number.isFinite(max)){FXUI.toast('Rango inválido','Introduce dos números válidos.');return;}
    if(min>max)[min,max]=[max,min];
    min=Math.ceil(min);max=Math.floor(max);
    if(!Number.isSafeInteger(min)||!Number.isSafeInteger(max)||min>max){FXUI.toast('Rango inválido','Utiliza números enteros dentro del rango permitido.');return;}
    const result=Math.floor(Math.random()*(max-min+1))+min;
    const target=document.getElementById('random-result');
    target.textContent=result.toLocaleString('es-ES');
    target.classList.remove('revealed');void target.offsetWidth;target.classList.add('revealed');
  };

  document.getElementById('export-data').onclick=()=>{
    const blob=new Blob([FXStorage.exportJSON()],{type:'application/json'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='fxtools-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
  };
  const fileInput=document.getElementById('import-data');
  document.querySelector('[for="import-data"]').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fileInput.click()}});
  fileInput.onchange=e=>{
    const f=e.target.files[0];if(!f)return;
    const r=new FileReader();
    r.onload=()=>{try{FXStorage.importJSON(r.result);FXUI.toast('Datos importados','Recarga la página para aplicar todos los cambios.');}catch(err){FXUI.toast('Archivo inválido',err.message);}fileInput.value='';};
    r.readAsText(f);
  };
});
