window.FXTimer = (() => {
  let totalMs=300000, initialMs=300000, running=false, endAt=0, raf=0;

  const clamp=(v,min,max)=>Math.min(max,Math.max(min,Number(v)||0));
  const fmt=ms=>{
    const total=Math.max(0,Math.ceil(ms/1000));
    const h=Math.floor(total/3600), m=Math.floor((total%3600)/60), s=total%60;
    return h>0?`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  };
  const display=()=>{const el=document.getElementById('timer-display');if(el)el.textContent=fmt(totalMs);};
  const saveDuration=()=>FXStorage.set('timer.durationMs',initialMs);
  function syncInputs(){
    const sec=Math.floor(initialMs/1000);const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;
    const eh=document.getElementById('timer-hours'),em=document.getElementById('timer-minutes'),es=document.getElementById('timer-seconds');
    if(eh)eh.value=h;if(em)em.value=m;if(es)es.value=s;
  }
  function setDuration(h,m,s){
    h=clamp(h,0,23);m=clamp(m,0,59);s=clamp(s,0,59);
    initialMs=(h*3600+m*60+s)*1000;if(initialMs<1000)initialMs=1000;totalMs=initialMs;stop(false);saveDuration();syncInputs();display();
  }
  function tick(){
    if(!running)return;totalMs=Math.max(0,endAt-Date.now());display();
    if(totalMs<=0){running=false;cancelAnimationFrame(raf);const b=document.getElementById('timer-start');if(b)b.textContent='Iniciar';window.FXUI?.toast('Tiempo terminado','El temporizador llegó a cero.');return;}
    raf=requestAnimationFrame(tick);
  }
  function start(){
    if(running)return;running=true;endAt=Date.now()+totalMs;const b=document.getElementById('timer-start');if(b)b.textContent='Pausar';tick();window.FXApp?.markUsed?.('timer');
  }
  function pause(){if(!running)return;totalMs=Math.max(0,endAt-Date.now());running=false;cancelAnimationFrame(raf);const b=document.getElementById('timer-start');if(b)b.textContent='Iniciar';display();}
  function stop(resetText=true){if(running){totalMs=Math.max(0,endAt-Date.now());running=false;cancelAnimationFrame(raf);}if(resetText){const b=document.getElementById('timer-start');if(b)b.textContent='Iniciar';}}
  function reset(){stop();totalMs=initialMs;display();}
  function toggle(){running?pause():start();}
  function quick(min){setDuration(0,min,0);}
  function init(){
    if(!document.getElementById('timer-display'))return;
    initialMs=Math.max(1000,Number(FXStorage.get('timer.durationMs',Number(FXStorage.get('timer.minutes',5))*60000))||300000);totalMs=initialMs;syncInputs();display();
    document.getElementById('timer-set')?.addEventListener('click',()=>setDuration(document.getElementById('timer-hours')?.value,document.getElementById('timer-minutes')?.value,document.getElementById('timer-seconds')?.value));
    document.getElementById('timer-start')?.addEventListener('click',toggle);
    document.getElementById('timer-reset')?.addEventListener('click',reset);
    document.querySelectorAll('[data-timer-quick]').forEach(b=>b.addEventListener('click',()=>quick(Number(b.dataset.timerQuick)||5)));
  }
  return {init,start,pause,reset,setDuration};
})();
