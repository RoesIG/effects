window.FXStopwatch = (() => {
  const KEY='stopwatch.state';
  let state={elapsed:0,running:false,startedAt:0,laps:[]},raf=0;
  const nowElapsed=()=>state.elapsed+(state.running?Date.now()-state.startedAt:0);
  const fmt=ms=>{const t=Math.max(0,Math.floor(ms));const h=Math.floor(t/3600000),m=Math.floor((t%3600000)/60000),s=Math.floor((t%60000)/1000),cs=Math.floor((t%1000)/10);return `${h?String(h).padStart(2,'0')+':':''}${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;};
  const persist=()=>FXStorage.set(KEY,state);
  function render(){const el=document.getElementById('sw-display');if(el)el.textContent=fmt(nowElapsed());const b=document.getElementById('sw-start');if(b)b.textContent=state.running?'Pausar':'Iniciar';const laps=document.getElementById('sw-laps');if(laps)laps.innerHTML=state.laps.length?state.laps.map((x,i)=>`<div class="lap-row"><span>Vuelta ${state.laps.length-i}</span><strong>${fmt(x)}</strong></div>`).join(''):'<div class="empty-box compact">Todavía no hay vueltas.</div>';}
  function loop(){render();if(state.running)raf=requestAnimationFrame(loop);}
  function toggle(){if(state.running){state.elapsed=nowElapsed();state.running=false;state.startedAt=0;cancelAnimationFrame(raf);}else{state.running=true;state.startedAt=Date.now();raf=requestAnimationFrame(loop);window.FXApp?.markUsed?.('stopwatch');}persist();render();}
  function reset(){state={elapsed:0,running:false,startedAt:0,laps:[]};cancelAnimationFrame(raf);persist();render();}
  function lap(){if(!state.running&&nowElapsed()<=0)return;state.laps.unshift(nowElapsed());state.laps=state.laps.slice(0,20);persist();render();}
  function init(){const saved=FXStorage.get(KEY,null);if(saved&&typeof saved==='object')state={...state,...saved};render();if(state.running)raf=requestAnimationFrame(loop);document.getElementById('sw-start')?.addEventListener('click',toggle);document.getElementById('sw-reset')?.addEventListener('click',reset);document.getElementById('sw-lap')?.addEventListener('click',lap);}
  return {init,render};
})();

window.FXCounters = (() => {
  const KEY='counters.items';
  let items=[];
  const uid=()=> 'c_'+Math.random().toString(36).slice(2,9);
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const save=()=>FXStorage.set(KEY,items);
  function render(){const wrap=document.getElementById('counter-list');if(!wrap)return;wrap.innerHTML=items.length?items.map(x=>`<div class="counter-row" data-counter="${x.id}"><div class="counter-name"><strong>${esc(x.name)}</strong><button class="micro-btn" data-act="delete" title="Eliminar">×</button></div><div class="counter-controls"><button class="count-btn" data-act="minus">−</button><output>${Number(x.value)||0}</output><button class="count-btn" data-act="plus">+</button><button class="micro-btn reset" data-act="reset">0</button></div></div>`).join(''):'<div class="empty-box">Añade un contador para empezar.</div>';wrap.querySelectorAll('[data-counter]').forEach(row=>row.addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(!b)return;const x=items.find(i=>i.id===row.dataset.counter);if(!x)return;const a=b.dataset.act;if(a==='plus')x.value=(Number(x.value)||0)+1;if(a==='minus')x.value=(Number(x.value)||0)-1;if(a==='reset')x.value=0;if(a==='delete')items=items.filter(i=>i.id!==x.id);save();render();window.FXApp?.markUsed?.('counters');}));}
  function add(name){name=(name||'Contador').trim().slice(0,50);if(!name)return;items.push({id:uid(),name,value:0});save();render();}
  function init(){items=FXStorage.get(KEY,[]);if(!Array.isArray(items))items=[];render();const input=document.getElementById('counter-new-name');document.getElementById('counter-add')?.addEventListener('click',()=>{add(input?.value);if(input)input.value='';});input?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();add(input.value);input.value='';}});}
  return {init,render};
})();

window.FXChecklist = (() => {
  const KEY='checklist.items';
  let items=[];
  const uid=()=> 'k_'+Math.random().toString(36).slice(2,9);
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const save=()=>FXStorage.set(KEY,items);
  function render(){const wrap=document.getElementById('check-list');if(!wrap)return;const done=items.filter(x=>x.done).length;const meta=document.getElementById('check-progress');if(meta)meta.textContent=`${done} / ${items.length}`;wrap.innerHTML=items.length?items.map(x=>`<div class="check-row ${x.done?'done':''}" data-check="${x.id}"><label><input type="checkbox" ${x.done?'checked':''}><span>${esc(x.text)}</span></label><button class="micro-btn" data-delete title="Eliminar">×</button></div>`).join(''):'<div class="empty-box">Tu lista está vacía.</div>';wrap.querySelectorAll('[data-check]').forEach(row=>{const x=items.find(i=>i.id===row.dataset.check);row.querySelector('input')?.addEventListener('change',e=>{x.done=e.target.checked;save();render();window.FXApp?.markUsed?.('checklist');});row.querySelector('[data-delete]')?.addEventListener('click',()=>{items=items.filter(i=>i.id!==x.id);save();render();});});}
  function add(text){text=(text||'').trim().slice(0,120);if(!text)return;items.push({id:uid(),text,done:false});save();render();}
  function init(){items=FXStorage.get(KEY,[]);if(!Array.isArray(items))items=[];render();const input=document.getElementById('check-new');document.getElementById('check-add')?.addEventListener('click',()=>{add(input?.value);if(input)input.value='';});input?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();add(input.value);input.value='';}});document.getElementById('check-clear')?.addEventListener('click',()=>{items=items.filter(x=>!x.done);save();render();});}
  return {init,render};
})();

window.FXBracket = (() => {
  const KEY='bracket.state';
  let state={players:[],rounds:[],shuffle:true};
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
  const save=()=>FXStorage.set(KEY,state);
  const pow2=n=>{let p=1;while(p<n)p*=2;return p;};
  function autoResolve(){
    for(let r=0;r<state.rounds.length;r++){
      if(r>0){const prev=state.rounds[r-1];state.rounds[r].forEach((m,i)=>{const pa=prev[i*2],pb=prev[i*2+1];m.a=pa?.winner||null;m.b=pb?.winner||null;if(m.winner!==m.a&&m.winner!==m.b)m.winner=null;const ra=!!pa?.winner||(!pa?.a&&!pa?.b),rb=!!pb?.winner||(!pb?.a&&!pb?.b);if(ra&&rb&&!!m.a!==!!m.b)m.winner=m.a||m.b;});}
      state.rounds[r].forEach(m=>{if(r===0&&!!m.a!==!!m.b)m.winner=m.a||m.b;});
    }
  }
  function generate(players,doShuffle){
    let p=players.map(x=>x.trim()).filter(Boolean).slice(0,64);if(p.length<2)throw new Error('Necesitas al menos 2 participantes.');if(doShuffle)p=shuffle(p);const size=pow2(p.length);while(p.length<size)p.push(null);const rounds=[];let matches=size/2;rounds.push(Array.from({length:matches},(_,i)=>({a:p[i*2],b:p[i*2+1],winner:null})));while(matches>1){matches/=2;rounds.push(Array.from({length:matches},()=>({a:null,b:null,winner:null})));}state={players:p.filter(Boolean),rounds,shuffle:!!doShuffle};autoResolve();save();render();window.FXApp?.markUsed?.('bracket');}
  function pick(r,i,name){const m=state.rounds[r]?.[i];if(!m||!name||(name!==m.a&&name!==m.b))return;m.winner=name;autoResolve();save();render();}
  function render(){const wrap=document.getElementById('bracket-board');if(!wrap)return;if(!state.rounds?.length){wrap.innerHTML='<div class="empty-box">Genera un cuadro para verlo aquí.</div>';return;}const last=state.rounds.at(-1)?.[0]?.winner;wrap.innerHTML=`${last?`<div class="bracket-champion"><span>Ganador</span><strong>${esc(last)}</strong></div>`:''}<div class="bracket-scroll">${state.rounds.map((round,r)=>`<div class="bracket-round"><div class="bracket-round-title">${r===state.rounds.length-1?'Final':r===state.rounds.length-2?'Semifinal':`Ronda ${r+1}`}</div>${round.map((m,i)=>`<div class="bracket-match"><button ${!m.a?'disabled':''} class="bracket-player ${m.winner===m.a&&m.a?'winner':''}" data-r="${r}" data-i="${i}" data-name="${encodeURIComponent(m.a||'')}">${m.a?esc(m.a):'<span>—</span>'}</button><button ${!m.b?'disabled':''} class="bracket-player ${m.winner===m.b&&m.b?'winner':''}" data-r="${r}" data-i="${i}" data-name="${encodeURIComponent(m.b||'')}">${m.b?esc(m.b):'<span>—</span>'}</button></div>`).join('')}</div>`).join('')}</div>`;wrap.querySelectorAll('.bracket-player:not(:disabled)').forEach(b=>b.addEventListener('click',()=>pick(Number(b.dataset.r),Number(b.dataset.i),decodeURIComponent(b.dataset.name))));}
  function init(){const saved=FXStorage.get(KEY,null);if(saved?.rounds)state=saved;render();document.getElementById('bracket-generate')?.addEventListener('click',()=>{const raw=document.getElementById('bracket-players')?.value||'';const players=raw.split(/[,\n]/);const sh=!!document.getElementById('bracket-shuffle')?.checked;try{generate(players,sh);}catch(e){window.FXUI?.toast('No se pudo generar',e.message);}});if(state.players?.length){const ta=document.getElementById('bracket-players');if(ta)ta.value=state.players.join('\n');const sh=document.getElementById('bracket-shuffle');if(sh)sh.checked=state.shuffle!==false;}}
  return {init,render};
})();
