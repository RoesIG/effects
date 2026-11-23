window.FXRoulette = (() => {
  const defaults=['Minecraft','Elegir mapa','Valorant','Descanso','CS2','Otro juego'];
  // Color is functional here: it distinguishes adjacent wheel sections.
  const palette=['#c85187','#37303c','#e476a4','#594252','#a94175','#302c38','#d66594','#654459'];
  let options=FXStorage.get('roulette.options',defaults);
  if(!Array.isArray(options)||options.length<2)options=defaults;
  let rotation=0,spinning=false,canvas,ctx,resultEl;
  const duration=4200;
  function fitLabel(text,maxWidth) {
    const count=options.length;
    let size=count>=18?12:count>=12?14:count>=9?17:Math.max(17,Math.min(23,Math.floor(420/count)+9));
    while(size>12){ctx.font=`800 ${size}px system-ui`;if(ctx.measureText(text).width<=maxWidth)break;size--;}
    ctx.font=`800 ${size}px system-ui`;
    if(ctx.measureText(text).width<=maxWidth)return text;
    while(text.length>1&&ctx.measureText(text+'…').width>maxWidth)text=text.slice(0,-1);
    return text+'…';
  }
  function draw() {
    if(!canvas||!ctx)return;
    const w=canvas.width,h=canvas.height,r=Math.min(w,h)/2,cx=w/2,cy=h/2;
    ctx.clearRect(0,0,w,h);
    const slice=2*Math.PI/options.length;
    options.forEach((value,i)=>{
      const a=i*slice,mid=a+slice/2;
      ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,r-9,a,a+slice);ctx.closePath();
      ctx.fillStyle=palette[i%palette.length];ctx.fill();
      ctx.lineWidth=3;ctx.strokeStyle='#151018';ctx.stroke();
      ctx.save();ctx.translate(cx,cy);ctx.rotate(mid);
      const reversed=Math.cos(mid)<0;
      if(reversed)ctx.rotate(Math.PI);
      ctx.textAlign=reversed?'left':'right';ctx.textBaseline='middle';
      const text=fitLabel(String(value),r*(options.length>=12?.49:.67));
      const x=reversed?-(r-31):r-31;
      ctx.lineWidth=4;ctx.strokeStyle='#130f16a6';ctx.lineJoin='round';ctx.strokeText(text,x,0);
      ctx.fillStyle='#fff';ctx.fillText(text,x,0);
      ctx.restore();
    });
    ctx.beginPath();ctx.arc(cx,cy,r-9,0,2*Math.PI);ctx.lineWidth=9;ctx.strokeStyle='#f5deea50';ctx.stroke();
  }
  function spin() {
    if(spinning||options.length<2)return;
    spinning=true;
    const button=document.getElementById('spin-btn');button.disabled=true;
    resultEl.textContent='Girando…';
    // Uniformly select an index; rotate until that segment is under the top pointer.
    const targetIndex=Math.floor(Math.random()*options.length);
    const sector=360/options.length;
    const end=(270-(targetIndex+.5)*sector+3600)%360;
    const current=((rotation%360)+360)%360;
    const offset=(end-current+360)%360;
    rotation+=2160+offset;
    canvas.style.transform=`rotate(${rotation}deg)`;
    setTimeout(()=>{
      const result=options[targetIndex];resultEl.textContent=result;spinning=false;
      button.disabled=false;FXStorage.set('roulette.lastResult',result);
    },duration);
  }
  function setOptions(newOptions) {
    if(spinning)throw Error('Espera a que termine el giro.');
    const cleaned=newOptions.map(x=>String(x).trim()).filter(Boolean).slice(0,24);
    if(cleaned.length<2)throw Error('Necesitas al menos 2 opciones.');
    options=cleaned;FXStorage.set('roulette.options',options);draw();
  }
  function init(){
    canvas=document.getElementById('wheel');if(!canvas)return;
    ctx=canvas.getContext('2d');resultEl=document.getElementById('roulette-result');
    resultEl.textContent=FXStorage.get('roulette.lastResult','—');
    draw();document.getElementById('spin-btn').addEventListener('click',spin);
  }
  return {init,draw,spin,getOptions:()=>[...options],setOptions};
})();
