(() => {
  'use strict';
  const regions = {
    kanto: {name:'Kanto', index:'01', champs:[['Rocky','Rhyperior'],['Charizard','Charizard'],['Salamence','Salamence'],['Kuernos','Grimmsnarl'],['Palmas','Iron Hands'],['Tyranitar','Tyranitar']]},
    johto: {name:'Johto', index:'02', champs:[['Bombo','Snorlax'],['Piper','Aggron'],['Sher','Gallade'],['Plumo','Kommo-o'],['Mister','Mr. Mime'],['Saly','Tinkaton']]},
    hoenn: {name:'Hoenn', index:'03', champs:[['Kuzko','Dusknoir'],['Pincha(o)','Slowking'],['Kefla','Clefable'],['Chuwi','Ursaluna'],['Torch','Blaziken'],['Gon','Porygon-Z']]},
    sinnoh: {name:'Sinnoh', index:'04', champs:[['Paty Jr','Starmie'],['Balboa','Venusaur'],['Bertram','Garchomp'],['Swag','Swampert'],['Jorobao Jr','Blastoise'],['Devora','Gardevoir']]}
  };
  const qs = s => document.querySelector(s);
  const page = qs('#coinGallery');
  const tabs = [...document.querySelectorAll('.coin-region-tabs button')];
  const model = qs('#coinModel'), flipTarget = qs('#coinFlipTarget'), flipButton = qs('#coinFlip');
  const miniGrid = qs('#coinMiniGrid');
  let regionKey = 'kanto', selected = 0, reversed = false;

  // Real coin: two separated faces and a faceted cylindrical metal edge.
  // Starting slightly oblique makes its thickness visible even while resting.
  const REST_ANGLE = -12, REST_PITCH = -7;
  const DEGREES_PER_PIXEL = 1.12, PITCH_PER_PIXEL = .58;
  const DRAG_THRESHOLD = 5;
  const COAST_FRICTION = 4.7;  // Exponential friction per second.
  const MAX_SPIN_SPEED = 1050; // No wild or uncontrollable spins.
  let angle = REST_ANGLE, pitch = REST_PITCH;
  let activePointer = null, frameId = 0, lastTick = 0, motion = null;
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  // A ring of tangent metallic facets. Unlike shadows painted behind a flat
  // circle, these slices really connect the two faces in the 3D scene.
  const metalRim = document.createElement('span');
  metalRim.className = 'coin-metal-rim';
  metalRim.setAttribute('aria-hidden','true');
  const facets = 64;
  for (let i = 0; i < facets; i++) {
    const degrees = 360 * i / facets;
    const segment = document.createElement('span');
    segment.className = 'coin-rim-segment';
    segment.style.setProperty('--segment-angle', `${degrees}deg`);
    segment.style.setProperty('--segment-light', (0.12 + 0.65 * Math.max(0, Math.cos((degrees - 310) * Math.PI / 180))).toFixed(3));
    const surface = document.createElement('span');
    surface.className = 'coin-rim-facet';
    segment.append(surface);
    metalRim.append(segment);
  }
  model.prepend(metalRim);

  function updateFace() {
    // Which face points toward the viewer? The coin can stop at any angle.
    const facing = Math.cos(angle * Math.PI / 180);
    reversed = facing < 0;
    model.classList.toggle('is-reversed', reversed);
    flipTarget.setAttribute('aria-pressed', String(reversed));
    flipTarget.setAttribute('aria-label', 'Moneda de campeón. Arrastra para girarla libremente; pulsa Entrar para darle la vuelta');
    const label = Math.abs(facing) < .18 ? 'Canto · Moneda de colección' : reversed ? 'Cara B · Meme' : 'Cara A · Representativa';
    const faceText = qs('#coinFaceLabel');
    if (faceText.textContent !== label) faceText.textContent = label;
  }
  function renderPose() {
    model.style.setProperty('--coin-angle', `${angle.toFixed(3)}deg`);
    model.style.setProperty('--coin-pitch', `${pitch.toFixed(3)}deg`);
    updateFace();
  }
  function stopMotion() {
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0; lastTick = 0; motion = null;
  }
  function resetCoin() {
    stopMotion();
    activePointer = null;
    flipTarget.classList.remove('is-dragging');
    angle = REST_ANGLE;
    pitch = REST_PITCH;
    renderPose();
  }
  function advance(timestamp) {
    frameId = 0;
    if (!motion || activePointer) return;
    const dt = Math.min(.045, Math.max(0, (timestamp-lastTick)/1000 || 0));
    lastTick = timestamp;
    if (motion.type === 'coast') {
      const decay = Math.exp(-COAST_FRICTION*dt);
      // Integral of exponentially decaying angular speed makes motion
      // nearly frame-rate independent (60/120/144 Hz all feel similar).
      const factor = (1-decay) / COAST_FRICTION;
      angle += motion.yawVelocity * factor;
      pitch = clamp(pitch + motion.pitchVelocity * factor, -70, 70);
      motion.yawVelocity *= decay;
      motion.pitchVelocity *= decay;
      renderPose();
      if (Math.max(Math.abs(motion.yawVelocity),Math.abs(motion.pitchVelocity)) < 3) {
        motion = null;
        return;
      }
    } else if (motion.type === 'button') {
      const elapsed = timestamp - motion.start;
      const t = clamp(elapsed / motion.duration, 0, 1);
      // Very gradual start and end; no hard 180-degree jump.
      const eased = t*t*(3-2*t);
      angle = motion.fromAngle + (motion.toAngle-motion.fromAngle)*eased;
      pitch = motion.fromPitch + (REST_PITCH-motion.fromPitch)*eased;
      renderPose();
      if (t >= 1) {motion = null;return;}
    }
    frameId = requestAnimationFrame(advance);
  }
  function startCoast(yawVelocity,pitchVelocity) {
    stopMotion();
    if (reduceMotion?.matches) return;
    motion = {type:'coast', yawVelocity:clamp(yawVelocity,-MAX_SPIN_SPEED,MAX_SPIN_SPEED), pitchVelocity:clamp(pitchVelocity,-270,270)};
    if (Math.max(Math.abs(motion.yawVelocity),Math.abs(motion.pitchVelocity)) < 9) {motion=null;return;}
    lastTick = performance.now();
    frameId = requestAnimationFrame(advance);
  }
  function turnCoinSlowly() {
    stopMotion();
    if (reduceMotion?.matches) {
      angle += 180;
      pitch = REST_PITCH;
      renderPose();
      return;
    }
    motion = {type:'button', fromAngle:angle, toAngle:angle+180, fromPitch:pitch,
      start:performance.now(), duration:1350};
    lastTick = motion.start;
    frameId = requestAnimationFrame(advance);
  }
  const pad = n => String(n+1).padStart(2,'0');
  const slug = value => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const safeKey = key => Object.hasOwn(regions,key) ? key : 'kanto';
  // Files are optional. Existing visuals can be added later, without editing the code.
  // Example: museo/assets/campeones/kanto/rocky-meme.png
  function assignImage(slot, name, face) {
    const box = qs(`.coin-image-slot[data-slot="${slot}"]`);
    box.querySelector('img')?.remove();
    box.classList.remove('has-image');
    const basename = `assets/campeones/${regionKey}/${slug(name)}-${face}`;
    const candidates = ['png','webp','jpg','jpeg'].map(ext => `${basename}.${ext}`);
    let n = 0;
    const img = new Image();
    img.alt = `${face === 'meme' ? 'Cara meme' : 'Cara representativa'} de ${name}`;
    img.decoding = 'async';
    img.draggable = false;
    img.addEventListener('load',()=>{
      if (regionKey === img.dataset.region && regions[regionKey].champs[selected][0] === img.dataset.nick) {
        box.append(img); box.classList.add('has-image');
      }
    });
    img.addEventListener('error',()=>{ if (++n < candidates.length) img.src = candidates[n]; });
    img.dataset.region = regionKey; img.dataset.nick = name;
    img.src = candidates[0];
  }
  function updateSelected() {
    const r=regions[regionKey];
    const [name,species]=r.champs[selected];
    qs('#coinSerial').textContent=`${pad(selected)} / ${pad(r.champs.length-1)}`;
    qs('#coinName').textContent=name;
    qs('#coinSpecies').textContent=species;
    qs('#coinFaceNameA').textContent=name;
    qs('#coinFaceNameB').textContent=name;
    qs('#coinFaceRegionA').textContent=r.name.toUpperCase();
    qs('#coinFaceRegionB').textContent=r.name.toUpperCase();
    resetCoin();
    assignImage('seria',name,'seria');
    assignImage('meme',name,'meme');
    [...miniGrid.querySelectorAll('button')].forEach((b,i)=>{b.classList.toggle('is-selected',i===selected);b.setAttribute('aria-pressed',String(i===selected));});
    qs('#coinPrev').disabled=selected===0;
    qs('#coinNext').disabled=selected===r.champs.length-1;
  }
  function selectChampion(i) {
    selected=Math.max(0,Math.min(regions[regionKey].champs.length-1,i));
    updateSelected();
  }
  function renderRegion(key) {
    regionKey=safeKey(key);
    selected=0; reversed=false;
    const r=regions[regionKey];
    page.dataset.region=regionKey;
    qs('#coinRegionIndex').textContent=`REGIÓN ${r.index}`;
    qs('#coinRegionName').textContent=r.name;
    qs('#coinCollectionTitle').textContent=`Campeones de ${r.name}`;
    tabs.forEach(b=>{const on=b.dataset.region===regionKey;b.classList.toggle('is-active',on);b.setAttribute('aria-pressed',String(on));});
    miniGrid.replaceChildren();
    r.champs.forEach(([nick,species],i)=>{
      const button=document.createElement('button');
      button.className='coin-mini-item'; button.type='button'; button.title=`Seleccionar ${nick}`;
      button.innerHTML=`<span class="coin-mini-disc" aria-hidden="true"><span>✦</span><b>${pad(i)}</b></span>`;
      const nickEl=document.createElement('strong'); nickEl.textContent=nick;
      const speciesEl=document.createElement('small'); speciesEl.textContent=species;
      button.append(nickEl,speciesEl);
      // A ready-made representative image also appears on the miniature coin.
      const miniImg = new Image();
      miniImg.alt=''; miniImg.loading='lazy';
      let extensionIndex=0;
      const path=`assets/campeones/${regionKey}/${slug(nick)}-seria`;
      const ext=['png','webp','jpg','jpeg'];
      miniImg.addEventListener('error',()=>{if (++extensionIndex<ext.length) miniImg.src=`${path}.${ext[extensionIndex]}`;});
      miniImg.addEventListener('load',()=>{
        if (regionKey===miniImg.dataset.region && miniGrid.contains(button)){
          button.querySelector('.coin-mini-disc').append(miniImg);
          button.classList.add('has-mini-image');
        }
      });
      miniImg.dataset.region=regionKey;
      miniImg.src=`${path}.${ext[0]}`;
      button.addEventListener('click',()=>selectChampion(i));
      miniGrid.append(button);
    });
    updateSelected();
    try {history.replaceState(null,'',`${location.pathname}?region=${regionKey}`);}catch(e){}
  }
  // Drag with mouse, finger or stylus. Dragging vertically also tilts the
  // coin, exposing the true sidewall, not just a flat flip-card animation.
  flipTarget.addEventListener('pointerdown', event => {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    if (activePointer) return;
    stopMotion(); // Grab it mid-spin, as if catching a real coin.
    const now = performance.now();
    activePointer = {id:event.pointerId, x:event.clientX, y:event.clientY,
      startAngle:angle, startPitch:pitch, moved:false, samples:[{t:now,a:angle,p:pitch}]};
    flipTarget.setPointerCapture(event.pointerId);
  });
  flipTarget.addEventListener('pointermove', event => {
    const drag = activePointer;
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX-drag.x;
    const dy = event.clientY-drag.y;
    if (!drag.moved && Math.hypot(dx,dy) < DRAG_THRESHOLD) return;
    if (!drag.moved) {
      drag.moved = true;
      flipTarget.classList.add('is-dragging');
    }
    angle = drag.startAngle + dx * DEGREES_PER_PIXEL;
    pitch = clamp(drag.startPitch - dy * PITCH_PER_PIXEL,-70,70);
    renderPose();
    const now = performance.now();
    drag.samples.push({t:now,a:angle,p:pitch});
    drag.samples = drag.samples.filter(s=>now-s.t < 115);
  });
  function releaseDrag(event,cancelled=false) {
    const drag = activePointer;
    if (!drag || event.pointerId !== drag.id) return;
    activePointer = null;
    flipTarget.classList.remove('is-dragging');
    if (flipTarget.hasPointerCapture(event.pointerId)) flipTarget.releasePointerCapture(event.pointerId);
    if (!drag.moved || cancelled) return;
    // Use only the final short time-window, so a slow deliberate release
    // keeps the pose, while a flick imparts momentum. Never snap to a face.
    const now = performance.now();
    const history = drag.samples.filter(s=>now-s.t < 110);
    const first = history[0], last = history[history.length-1];
    if (!first || !last || first === last || now-last.t > 65) return;
    const duration = Math.max(24, last.t-first.t);
    startCoast(((last.a-first.a)/duration)*1000*.60, ((last.p-first.p)/duration)*1000*.32);
  }
  flipTarget.addEventListener('pointerup', event => releaseDrag(event));
  flipTarget.addEventListener('pointercancel', event => releaseDrag(event,true));
  flipTarget.addEventListener('lostpointercapture', event => {
    if (activePointer?.id === event.pointerId) releaseDrag(event,true);
  });
  tabs.forEach(t=>t.addEventListener('click',()=>renderRegion(t.dataset.region)));
  flipButton.addEventListener('click',turnCoinSlowly);
  // A pointer click does NOT flip instantly. The coin is meant to be
  // manipulated directly. Enter/Space remain accessible via native button click.
  flipTarget.addEventListener('click',event => {
    if (event.detail === 0) turnCoinSlowly();
  });
  qs('#coinPrev').addEventListener('click',()=>selectChampion(selected-1));
  qs('#coinNext').addEventListener('click',()=>selectChampion(selected+1));
  document.addEventListener('keydown',event=>{
    const active=document.activeElement;
    if (active && ['INPUT','TEXTAREA','SELECT'].includes(active.tagName)) return;
    if (event.key==='ArrowLeft'){event.preventDefault();selectChampion(selected-1);}
    if (event.key==='ArrowRight'){event.preventDefault();selectChampion(selected+1);}
  });
  // Deep link de revisión: ?region=kanto&campeon=tyranitar&cara=meme
  // No altera la navegación normal ni las demás monedas.
  let initial='kanto', championParam='', faceParam='';
  try {
    const params=new URLSearchParams(location.search);
    initial=params.get('region')||initial;
    championParam=params.get('campeon')||'';
    faceParam=params.get('cara')||'';
  } catch(e){}
  renderRegion(initial);
  if (championParam) {
    const champs=regions[regionKey].champs;
    const match=champs.findIndex(([nick])=>slug(nick)===slug(championParam));
    if (match!==-1) selectChampion(match);
  }
  if (faceParam==='meme') {
    angle=168;
    renderPose();
  }
})();
