window.FXUI = (()=>{
  const openModal=id=>document.getElementById(id)?.classList.add('open');
  const closeModal=id=>document.getElementById(id)?.classList.remove('open');
  const toast=(title,text)=>{
    const wrap=document.querySelector('.toast-wrap');
    const t=document.createElement('div');t.className='toast';t.innerHTML=`<strong></strong><span></span>`;
    t.querySelector('strong').textContent=title;t.querySelector('span').textContent=text;wrap.appendChild(t);setTimeout(()=>t.remove(),3400);
  };
  return {openModal,closeModal,toast};
})();

document.addEventListener('DOMContentLoaded',()=>{
  const host=window.location.hostname || 'localhost';
  const settings=FXStorage.get('settings',{twitchChannel:'roesig'});
  const channel=(settings.twitchChannel||'roesig').toLowerCase().replace(/[^a-z0-9_]/g,'');
  document.getElementById('twitch-chat').src=`https://www.twitch.tv/embed/${channel}/chat?parent=${host}&darkpopout`;

  FXRoulette.init(); FXTeams.init(); FXTimer.init();

  document.querySelectorAll('[data-modal]').forEach(el=>el.addEventListener('click',()=>FXUI.openModal(el.dataset.modal)));
  document.querySelectorAll('[data-close]').forEach(el=>el.addEventListener('click',()=>FXUI.closeModal(el.closest('.modal-backdrop').id)));
  document.querySelectorAll('.modal-backdrop').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('open');}));

  const opts=document.getElementById('roulette-options');
  document.getElementById('edit-roulette').onclick=()=>{opts.value=FXRoulette.getOptions().join(', ');FXUI.openModal('modal-roulette');};
  document.getElementById('save-roulette').onclick=()=>{try{FXRoulette.setOptions(opts.value.split(','));FXUI.closeModal('modal-roulette');FXUI.toast('Ruleta actualizada','Las opciones quedaron guardadas.');}catch(e){FXUI.toast('No se pudo guardar',e.message);}};

  const coin=document.getElementById('coin');
  document.getElementById('coin-flip').onclick=()=>{
    coin.textContent='?'; coin.style.transition='transform 1.15s cubic-bezier(.2,.8,.2,1)'; coin.style.transform='rotateY(1440deg)';
    setTimeout(()=>{coin.style.transition='none';coin.style.transform='rotateY(0deg)';coin.textContent=Math.random()<.5?'CARA':'CRUZ';},1150);
  };
  document.getElementById('random-generate').onclick=()=>{
    let min=Number(document.getElementById('random-min').value), max=Number(document.getElementById('random-max').value);
    if(!Number.isFinite(min))min=1;if(!Number.isFinite(max))max=100;if(min>max)[min,max]=[max,min];
    document.getElementById('random-result').textContent=Math.floor(Math.random()*(max-min+1))+min;
  };

  document.getElementById('export-data').onclick=()=>{
    const blob=new Blob([FXStorage.exportJSON()],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='fxtools-backup.json';a.click();URL.revokeObjectURL(a.href);
  };
  document.getElementById('import-data').onchange=e=>{
    const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{FXStorage.importJSON(r.result);FXUI.toast('Datos importados','Recarga la página para aplicar todos los cambios.');}catch(err){FXUI.toast('Archivo inválido',err.message);}};r.readAsText(f);
  };
});
