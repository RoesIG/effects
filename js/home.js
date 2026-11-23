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
  document.getElementById('open-settings')?.addEventListener('click',()=>FXUI.openModal('modal-settings'));
  document.querySelectorAll('.modal-backdrop').forEach(modal=>modal.addEventListener('click',event=>{if(event.target===modal)FXUI.closeModal(modal.id)}));
  document.addEventListener('keydown',event=>{if(event.key==='Escape')document.querySelectorAll('.modal-backdrop.open').forEach(modal=>FXUI.closeModal(modal.id));});

  const opts=document.getElementById('roulette-options');
  document.getElementById('edit-roulette').onclick=()=>{opts.value=FXRoulette.getOptions().join(', ');FXUI.openModal('modal-roulette');};
  document.getElementById('save-roulette').onclick=()=>{try{FXRoulette.setOptions(opts.value.split(','));FXUI.closeModal('modal-roulette');FXUI.toast('Ruleta actualizada','Las opciones quedaron guardadas.');}catch(e){FXUI.toast('No se pudo guardar',e.message);}};

  // Physical-looking CSS-only coin. The random result is selected BEFORE the toss.
  // Front and back remain in 3D and can later accept user-designed Affinity textures.
  const coin=document.getElementById('coin');
  const coinStatus=document.getElementById('coin-status');
  const coinBtn=document.getElementById('coin-flip');
  const edge=coin?.querySelector('.fx-coin-edge');
  if(edge && !edge.children.length){
    for(let i=-11;i<=11;i+=2){
      const ring=document.createElement('i');
      ring.style.transform=`translateZ(${i}px)`;
      edge.appendChild(ring);
    }
  }
  // FX 4.5: independent, continuous spin + lift + wobble. Each throw keeps
  // the existing 3D faces, thickness and random result; the number of turns varies.
  const coinLift=coin?.closest('.fx-coin-lift');
  const coinTilt=coin?.closest('.fx-coin-tilt');
  coinBtn.onclick=()=>{
    if(coinBtn.disabled)return;
    const result=Math.random()<.5?'CARA':'CRUZ';
    const turns=5+Math.floor(Math.random()*3);
    const end=turns*360+(result==='CRUZ'?180:0);
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration=2200;
    coinBtn.disabled=true;
    coinStatus.textContent='Lanzando…';
    coin.style.transform='rotateY(0deg)';
    for(const el of [coinLift,coinTilt])el?.classList.remove('is-flipping');
    void coin?.offsetWidth;
    if(!reduced)for(const el of [coinLift,coinTilt])el?.classList.add('is-flipping');
    let finished=false;
    const finish=()=>{
      if(finished)return;
      finished=true;
      coin.style.transform=`rotateY(${end}deg)`;
      spin?.cancel();
      for(const el of [coinLift,coinTilt])el?.classList.remove('is-flipping');
      coinStatus.textContent=result;
      coinBtn.disabled=false;
    };
    const spin=reduced?null:coin.animate(
      [{transform:'rotateY(0deg)'},{transform:`rotateY(${end}deg)`}],
      {duration,easing:'cubic-bezier(.42,.05,.23,1)',fill:'forwards'}
    );
    if(spin)spin.finished.then(finish,finish);
    setTimeout(finish,reduced?20:duration+120);
  };

  // Experimental die v4.3: six CSS faces, each with a screen. The only final
  // result is on the front screen; range and random number logic are preserved.
  const dice=document.getElementById('fx-die');
  const dieLift=dice?.closest('.fx-die-lift');
  const dieSpinY=dice?.closest('.fx-die-spin-y');
  const dieScreen=document.getElementById('fx-die-screen');
  const diceButton=document.getElementById('random-generate');
  diceButton.onclick=()=>{
    let min=Number(document.getElementById('random-min').value),max=Number(document.getElementById('random-max').value);
    if(!Number.isFinite(min)||!Number.isFinite(max)){FXUI.toast('Rango inválido','Introduce dos números válidos.');return;}
    if(min>max)[min,max]=[max,min];
    min=Math.ceil(min);max=Math.floor(max);
    if(!Number.isSafeInteger(min)||!Number.isSafeInteger(max)||min>max){FXUI.toast('Rango inválido','Utiliza números enteros dentro del rango permitido.');return;}
    if(diceButton.disabled)return;
    const value=Math.floor(Math.random()*(max-min+1))+min;
    const display=value.toLocaleString('es-ES');
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    diceButton.disabled=true;
    dieScreen.textContent='···';
    document.getElementById('random-result').textContent='Generando número';
    for(const part of [dieLift,dieSpinY,dice]) part?.classList.remove('is-rolling');
    // Restart all three independent motion tracks in the same frame.
    void dice.offsetWidth;
    if(!reduced) for(const part of [dieLift,dieSpinY,dice]) part?.classList.add('is-rolling');
    setTimeout(()=>{
      for(const part of [dieLift,dieSpinY,dice]) part?.classList.remove('is-rolling');
      dieScreen.textContent=display;
      dice.style.setProperty('--fx-die-font',display.length>12?'1.15rem':display.length>9?'1.55rem':display.length>6?'2.05rem':display.length>4?'2.8rem':'clamp(2.2rem,4vw,4.3rem)');
      document.getElementById('random-result').textContent=display;
      diceButton.disabled=false;
    },reduced?20:1850);
  };

  document.getElementById('export-data').onclick=()=>{
    const blob=new Blob([FXStorage.exportJSON()],{type:'application/json'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='fxtools-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
  };
  const fileInput=document.getElementById('import-data');
  document.querySelectorAll('[for="import-data"]').forEach(label=>label.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fileInput.click()}}));
  fileInput.onchange=e=>{
    const f=e.target.files[0];if(!f)return;
    const r=new FileReader();
    r.onload=()=>{try{FXStorage.importJSON(r.result);FXUI.toast('Datos importados','Recarga la página para aplicar todos los cambios.');}catch(err){FXUI.toast('Archivo inválido',err.message);}fileInput.value='';};
    r.readAsText(f);
  };
});
