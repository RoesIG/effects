/* Manzana dorada: extrusión 3D ligera de la textura original, sin dependencias. */
(() => {
  'use strict';
  const wrapper = document.querySelector('.apple-control');
  const canvas = document.querySelector('#apple-canvas');
  if (!wrapper || !canvas || !canvas.getContext) return;
  const context = canvas.getContext('2d');
  if (!context) return;
  const spriteBytes = Uint8Array.from(atob('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHUoAv8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALJkEf9UJAn/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB1KAL/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAsmQR/7JkEf91KAL/VCQJ/3UoAv91KAL/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACyZBH/26IT//7/5v/bohP/VCQJ/7JkEf/sy0X/26IT/3UoAv91KAL/AAAAAAAAAAAAAAAAAAAAAAAAAACyZBH/26IT/+ruV//2+JL//v/m//7/5v/+/+b/9viS/+ruV//bohP/dSgC/3UoAv8AAAAAAAAAAAAAAAAAAAAAsmQR/9uiE//q7lf/6u5X/+ruV//q7lf/6u5X/+ruV//sy0X/6u5X/9uiE/91KAL/AAAAAAAAAAAAAAAAAAAAALJkEf/bohP/7MtF/+ruV//sy0X/6u5X/+zLRf/sy0X/7MtF/+ruV//sy0X/VBIJ/wAAAAAAAAAAAAAAAAAAAAB1KAL/26IT/9uiE//sy0X/7MtF/9uiE//bohP/7MtF/9uiE//q7lf/7MtF/1QSCf8AAAAAAAAAAAAAAAAAAAAAdSgC/9uiE//bohP/26IT/9uiE//bohP/7MtF/9uiE//bohP/6u5X/9uiE/9UEgn/AAAAAAAAAAAAAAAAAAAAAAAAAAB1KAL/26IT/9uiE//sy0X/26IT/9uiE//bohP/7MtF/9uiE/9UEgn/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdSgC/7JkEf/bohP/26IT/9uiE//sy0X/7MtF/9uiE/+yZBH/VBIJ/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABUEgn/smQR/9uiE/+yZBH/smQR/9uiE/+yZBH/VBIJ/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFQSCf91KAL/dSgC/3UoAv9UEgn/VBIJ/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=='), character => character.charCodeAt(0));
  let faces = [];
  let yaw = -0.33;
  let pitch = -0.10;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let side = 118;
  const thickness = 0.95;

  const shaded = (rgba, factor) => {
    return `rgb(${Math.round(rgba[0] * factor)}, ${Math.round(rgba[1] * factor)}, ${Math.round(rgba[2] * factor)})`;
  };
  const rotate = (p) => {
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const x = p[0] * cy + p[2] * sy;
    const z = p[2] * cy - p[0] * sy;
    return [x, p[1] * cp - z * sp, p[1] * sp + z * cp];
  };
  const quad = (coords, color, normal) => { faces.push({ coords, color, normal }); };

  function prepare() {
    const data = spriteBytes;
    const cols = 16, rows = 16;
    const pixelAt = (x, y) => {
      if (x < 0 || y < 0 || x >= cols || y >= rows) return null;
      const i = (y * cols + x) * 4;
      return data[i + 3] >= 80 ? [data[i],data[i+1],data[i+2]] : null;
    };
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const color = pixelAt(col, row);
        if (!color) continue;
        const x0 = col - cols / 2, x1 = x0 + 1;
        const y1 = rows / 2 - row, y0 = y1 - 1;
        const z = thickness;
        quad([[x0,y0,z],[x1,y0,z],[x1,y1,z],[x0,y1,z]], shaded(color,1), [0,0,1]);
        quad([[x1,y0,-z],[x0,y0,-z],[x0,y1,-z],[x1,y1,-z]],shaded(color,.66),[0,0,-1]);
        if (!pixelAt(col-1,row)) quad([[x0,y0,-z],[x0,y0,z],[x0,y1,z],[x0,y1,-z]],shaded(color,.62),[-1,0,0]);
        if (!pixelAt(col+1,row)) quad([[x1,y0,z],[x1,y0,-z],[x1,y1,-z],[x1,y1,z]],shaded(color,.82),[1,0,0]);
        if (!pixelAt(col,row+1)) quad([[x0,y0,z],[x0,y0,-z],[x1,y0,-z],[x1,y0,z]],shaded(color,.56),[0,-1,0]);
        if (!pixelAt(col,row-1)) quad([[x0,y1,-z],[x0,y1,z],[x1,y1,z],[x1,y1,-z]],shaded(color,.9),[0,1,0]);
      }
    }
    return faces.length > 0;
  }
  function render() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const box = canvas.getBoundingClientRect();
    side = Math.max(1, Math.round(box.width));
    const h = Math.max(1, Math.round(box.height));
    const width = Math.round(side*dpr), height=Math.round(h*dpr);
    if (canvas.width !== width || canvas.height !== height) { canvas.width=width; canvas.height=height; }
    context.setTransform(dpr,0,0,dpr,0,0);
    context.clearRect(0,0,side,h);
    const cameraDistance=30;
    const f=Math.min(side,h)*1.55;
    const project = (v) => {
      const k=f/(cameraDistance-v[2]);
      return [side/2+v[0]*k,h/2-v[1]*k];
    };
    const polygons=[];
    for(const face of faces) {
      if (rotate(face.normal)[2] <= .002) continue;
      const points=face.coords.map(rotate);
      polygons.push({ color:face.color, depth:points.reduce((sum,v)=>sum+v[2],0)/4, points:points.map(project) });
    }
    polygons.sort((a,b)=>a.depth-b.depth);
    context.lineWidth=.35;
    context.lineJoin='miter';
    for(const {points,color} of polygons) {
      context.fillStyle=color;
      context.strokeStyle=color;
      context.beginPath();
      context.moveTo(points[0][0],points[0][1]);
      for(let i=1;i<points.length;i++) context.lineTo(points[i][0],points[i][1]);
      context.closePath();
      context.fill();
      context.stroke();
    }
  }
  if (prepare()) {
    wrapper.classList.add('is-ready');
    render();
  }
  wrapper.addEventListener('pointerdown', event => {
    if (!wrapper.classList.contains('is-ready')) return;
    if (event.pointerType==='mouse' && event.button!==0) return;
    dragging = true;
    lastX = event.clientX; lastY = event.clientY;
    wrapper.classList.add('dragging');
    wrapper.focus({ preventScroll: true });
    wrapper.setPointerCapture(event.pointerId);
  });
  wrapper.addEventListener('pointermove', event => {
    if (!dragging) return;
    yaw += (event.clientX-lastX)*.014;
    pitch = Math.max(-1.2,Math.min(1.2,pitch+(event.clientY-lastY)*.014));
    lastX = event.clientX; lastY = event.clientY;
    render();
  });
  const endDrag = () => { dragging=false;wrapper.classList.remove('dragging'); };
  wrapper.addEventListener('pointerup', endDrag);
  wrapper.addEventListener('pointercancel', endDrag);
  wrapper.addEventListener('lostpointercapture', endDrag);
  wrapper.addEventListener('keydown',event=>{
    if (!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home'].includes(event.key)) return;
    event.preventDefault();
    if (event.key==='Home') {yaw=-.33;pitch=-.1;}
    if (event.key==='ArrowLeft') yaw-=.18;
    if (event.key==='ArrowRight') yaw+=.18;
    if (event.key==='ArrowUp') pitch=Math.max(-1.2,pitch-.18);
    if (event.key==='ArrowDown') pitch=Math.min(1.2,pitch+.18);
    if (faces.length) render();
  });
  if ('ResizeObserver' in window) new ResizeObserver(()=> {if (faces.length) render();}).observe(wrapper);
  else window.addEventListener('resize',()=>{if (faces.length) render();},{passive:true});
})();
