window.FXTimer = (() => {
  let total=300,initial=300,interval=null,deadline=0;
  const display=()=>{
    const el=document.getElementById('timer-display');if(!el)return;
    const m=String(Math.floor(total/60)).padStart(2,'0');
    const s=String(total%60).padStart(2,'0');el.textContent=`${m}:${s}`;
  };
  function stop(){if(interval!==null)clearInterval(interval);interval=null;document.getElementById('timer-ring')?.classList.remove('running');}
  function setMinutes(min){
    stop();
    const n=Math.min(999,Math.max(1,Math.floor(Number.isFinite(min)?min:5)));
    initial=n*60;total=initial;FXStorage.set('timer.minutes',n);
    document.getElementById('timer-start').textContent='Iniciar';
    document.getElementById('timer-minutes').value=n;
    display();
  }
  function tick(){
    // Wall-clock time avoids a fast or slow countdown after a background-tab pause.
    total=Math.max(0,Math.ceil((deadline-Date.now())/1000));display();
    if(total===0){stop();document.getElementById('timer-start').textContent='Iniciar';window.FXUI.toast('Tiempo terminado','El temporizador llegó a cero.');}
  }
  function toggle(btn){
    if(interval!==null){tick();if(interval!==null)stop();btn.textContent='Iniciar';return;}
    if(total<=0)total=initial;
    deadline=Date.now()+total*1000;btn.textContent='Pausar';
    document.getElementById('timer-ring')?.classList.add('running');
    interval=setInterval(tick,180);tick();
  }
  function reset(btn){stop();total=initial;btn.textContent='Iniciar';display();}
  function init(){
    const input=document.getElementById('timer-minutes');if(!input)return;
    const stored=FXStorage.get('timer.minutes',5);
    const start=document.getElementById('timer-start');
    setMinutes(Number(stored));
    document.getElementById('timer-set').onclick=()=>setMinutes(Number(input.value)||5);
    start.onclick=()=>toggle(start);
    document.getElementById('timer-reset').onclick=()=>reset(start);
  }
  return {init};
})();
