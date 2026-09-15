window.FXRoulette = (() => {
  const defaults = ['Minecraft','Elegir mapa','Valorant','Descanso','CS2','Otro juego'];
  const palette = ['#20d8ff','#ff4ca6','#42e6a4','#8e55ff','#ffb52e','#2d7dff','#ee5d68','#8ad66b'];
  let options = FXStorage.get('roulette.options', defaults);
  let rotation = 0;
  let spinning = false;
  let canvas, ctx, resultEl;

  function draw() {
    if (!canvas) return;
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
  function spin() {
    if (spinning || options.length < 2) return;
    spinning=true; resultEl.textContent='GIRANDO…';
    const extra = 1800 + Math.floor(Math.random()*360);
    rotation += extra;
    canvas.style.transform=`rotate(${rotation}deg)`;
    setTimeout(() => {
      const normalized=((360-(rotation%360)+270)%360);
      const index=Math.floor(normalized/(360/options.length))%options.length;
      resultEl.textContent=options[index]; spinning=false;
      FXStorage.set('roulette.lastResult', options[index]);
    },4200);
  }
  function setOptions(newOptions) {
    const cleaned = newOptions.map(v=>v.trim()).filter(Boolean).slice(0,24);
    if (cleaned.length < 2) throw new Error('Necesitas al menos 2 opciones.');
    options=cleaned; FXStorage.set('roulette.options', options); draw();
  }
  function init() {
    canvas=document.getElementById('wheel');
    if (!canvas) return;
    ctx=canvas.getContext('2d'); resultEl=document.getElementById('roulette-result');
    resultEl.textContent=FXStorage.get('roulette.lastResult','---');
    draw(); document.getElementById('spin-btn').addEventListener('click',spin);
  }
  return { init, draw, spin, getOptions:()=>[...options], setOptions };
})();
