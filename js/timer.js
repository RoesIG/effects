window.FXTimer = (() => {
  let total=300, initial=300, id=null;
  const display=()=>{
    const el=document.getElementById('timer-display'); if(!el)return;
    const m=String(Math.floor(total/60)).padStart(2,'0'); const s=String(total%60).padStart(2,'0'); el.textContent=`${m}:${s}`;
  };
  function setMinutes(min){ initial=Math.max(1,Math.floor(min))*60; total=initial; FXStorage.set('timer.minutes',initial/60); display(); }
  function toggle(btn){
    if(id){clearInterval(id);id=null;btn.textContent='Iniciar';return;}
    btn.textContent='Pausar';
    id=setInterval(()=>{ if(total>0){total--;display();} else {clearInterval(id);id=null;btn.textContent='Iniciar';window.FXUI.toast('Tiempo terminado','El temporizador llegó a cero.');}},1000);
  }
  function reset(btn){if(id)clearInterval(id);id=null;total=initial;btn.textContent='Iniciar';display();}
  function init(){
    const input=document.getElementById('timer-minutes'); if(!input)return;
    const stored=FXStorage.get('timer.minutes',5); input.value=stored; setMinutes(stored);
    const start=document.getElementById('timer-start');
    document.getElementById('timer-set').onclick=()=>setMinutes(Number(input.value)||5);
    start.onclick=()=>toggle(start); document.getElementById('timer-reset').onclick=()=>reset(start);
  }
  return {init};
})();
