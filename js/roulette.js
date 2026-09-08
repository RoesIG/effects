window.FXRoulette = (() => {
  const defaults = ['Minecraft','Elegir mapa','Valorant','Descanso','CS2','Otro juego'];
  const palette = ['#159dff','#22d7ff','#46e3ad','#ffb84d','#ff6579','#8d7cff','#4f8fff','#f07bb2'];
  let presets = [];
  let activeId = '';
  let options = [];
  let history = [];
  let removeAfter = false;
  let rotation = 0;
  let spinning = false;
  let canvas, ctx, resultEl;

  const uid = () => 'r_' + Math.random().toString(36).slice(2,9);
  const active = () => presets.find(p => p.id === activeId) || presets[0];

  function loadState() {
    const stored = FXStorage.get('roulette.presets', null);
    if (Array.isArray(stored) && stored.length) {
      presets = stored.map(p => ({ id: String(p.id || uid()), name: String(p.name || 'Ruleta'), options: Array.isArray(p.options) ? p.options : defaults }));
    } else {
      const old = FXStorage.get('roulette.options', defaults);
      presets = [{ id: uid(), name: 'Principal', options: Array.isArray(old) && old.length >= 2 ? old : defaults }];
      FXStorage.set('roulette.presets', presets);
    }
    activeId = FXStorage.get('roulette.activePreset', presets[0].id);
    if (!presets.some(p => p.id === activeId)) activeId = presets[0].id;
    options = [...active().options];
    history = FXStorage.get('roulette.history', []);
    removeAfter = !!FXStorage.get('roulette.removeAfter', false);
  }

  function savePresets() {
    const p = active();
    if (p) p.options = [...options];
    FXStorage.set('roulette.presets', presets);
    FXStorage.set('roulette.activePreset', activeId);
    FXStorage.set('roulette.options', options); // compatibilidad con V2
  }

  function draw() {
    if (!canvas || !ctx || !options.length) return;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const c = canvas.width/2;
    const slice = Math.PI*2/options.length;
    options.forEach((label,i) => {
      const start = i*slice;
      ctx.beginPath(); ctx.moveTo(c,c); ctx.arc(c,c,c-5,start,start+slice); ctx.closePath();
      ctx.fillStyle = palette[i%palette.length]; ctx.fill();
      ctx.save(); ctx.translate(c,c); ctx.rotate(start+slice/2);
      ctx.fillStyle='#fff'; ctx.textAlign='right'; ctx.textBaseline='middle'; ctx.font='800 12px system-ui';
      const clipped = label.length > 18 ? label.slice(0,17)+'…' : label;
      ctx.fillText(clipped,c-24,0); ctx.restore();
    });
  }

  function renderPresetSelect() {
    const select = document.getElementById('roulette-preset-select');
    if (!select) return;
    select.innerHTML = presets.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
    select.value = activeId;
    const name = document.getElementById('roulette-preset-name');
    if (name) name.value = active()?.name || '';
  }

  function renderHistory() {
    const wrap = document.getElementById('roulette-history');
    if (!wrap) return;
    wrap.innerHTML = history.length
      ? history.slice(0,8).map((h,i)=>`<span class="history-pill"><b>${i+1}</b>${escapeHtml(h)}</span>`).join('')
      : '<span class="empty-inline">Todavía no hay resultados.</span>';
  }

  function escapeHtml(v='') {
    return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }

  function spin() {
    if (spinning || options.length < 2) return;
    spinning=true;
    resultEl.textContent='GIRANDO…';
    const extra = 1800 + Math.floor(Math.random()*360);
    rotation += extra;
    canvas.style.transform=`rotate(${rotation}deg)`;
    setTimeout(() => {
      const normalized=((360-(rotation%360)+270)%360);
      const index=Math.floor(normalized/(360/options.length))%options.length;
      const winner=options[index];
      resultEl.textContent=winner;
      history=[winner,...history].slice(0,12);
      FXStorage.set('roulette.lastResult', winner);
      FXStorage.set('roulette.history', history);
      renderHistory();
      if(removeAfter && options.length>2){
        options.splice(index,1);
        savePresets();
        draw();
        window.FXUI?.toast('Resultado retirado',`${winner} no volverá a salir en esta ruleta.`);
      }
      spinning=false;
      window.FXApp?.markUsed?.('roulette');
    },4200);
  }

  function setOptions(newOptions) {
    const cleaned = newOptions.map(v=>v.trim()).filter(Boolean).slice(0,40);
    if (cleaned.length < 2) throw new Error('Necesitas al menos 2 opciones.');
    options=cleaned;
    savePresets();
    rotation=0;
    if(canvas) canvas.style.transform='rotate(0deg)';
    draw();
  }

  function switchPreset(id){
    if(!presets.some(p=>p.id===id)) return;
    activeId=id;
    options=[...active().options];
    rotation=0;
    if(canvas) canvas.style.transform='rotate(0deg)';
    savePresets();
    renderPresetSelect();
    draw();
    const opts=document.getElementById('roulette-options');
    if(opts) opts.value=options.join('\n');
  }

  function createPreset(name='Nueva ruleta'){
    const p={id:uid(),name:name.trim()||'Nueva ruleta',options:[...defaults]};
    presets.push(p);activeId=p.id;options=[...p.options];savePresets();renderPresetSelect();draw();return p;
  }

  function renameActive(name){
    const p=active(); if(!p)return;
    p.name=(name||'Ruleta').trim().slice(0,40)||'Ruleta';savePresets();renderPresetSelect();
  }

  function deleteActive(){
    if(presets.length<=1) throw new Error('Debe quedar al menos una ruleta.');
    const idx=presets.findIndex(p=>p.id===activeId);
    presets.splice(idx,1);activeId=presets[Math.max(0,idx-1)].id;options=[...active().options];savePresets();renderPresetSelect();draw();
  }

  function init() {
    loadState();
    canvas=document.getElementById('wheel');
    if (!canvas) return;
    ctx=canvas.getContext('2d'); resultEl=document.getElementById('roulette-result');
    resultEl.textContent=FXStorage.get('roulette.lastResult','---');
    renderPresetSelect(); renderHistory(); draw();
    document.getElementById('spin-btn')?.addEventListener('click',spin);
    document.getElementById('roulette-preset-select')?.addEventListener('change',e=>switchPreset(e.target.value));
    const toggle=document.getElementById('roulette-remove-after');
    if(toggle){toggle.checked=removeAfter;toggle.addEventListener('change',()=>{removeAfter=toggle.checked;FXStorage.set('roulette.removeAfter',removeAfter);});}
  }

  return {
    init, draw, spin,
    getOptions:()=>[...options], setOptions,
    getPresets:()=>presets.map(p=>({...p,options:[...p.options]})),
    getActive:()=>({...active(),options:[...options]}),
    switchPreset, createPreset, renameActive, deleteActive
  };
})();
