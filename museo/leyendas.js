(() => {
  const carousel = document.getElementById('legendCarousel');
  const viewer = document.getElementById('legendViewer');
  if (!carousel || !viewer) return;

  const cards = [...carousel.querySelectorAll('.legend-card')];
  const prev = document.querySelector('.legend-carousel-prev');
  const next = document.querySelector('.legend-carousel-next');
  const current = document.getElementById('legendCurrent');
  const dotsWrap = document.getElementById('legendDots');
  const img = document.getElementById('legendViewerImage');
  const name = document.getElementById('legendViewerName');
  const nickname = document.getElementById('legendViewerNickname');
  const close = viewer.querySelector('.legend-viewer-close');

  let activeIndex = 0;
  let raf = 0;
  let pointerDown = false;
  let dragStartX = 0;
  let dragStartScroll = 0;
  let dragged = false;

  const pad = n => String(n + 1).padStart(2, '0');

  const dots = cards.map((_, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'legend-carousel-dot' + (i === 0 ? ' is-active' : '');
    dot.setAttribute('aria-label', `Mostrar leyenda ${i + 1}`);
    dot.addEventListener('click', () => goTo(i));
    dotsWrap.appendChild(dot);
    return dot;
  });

  const setActive = index => {
    index = Math.max(0, Math.min(cards.length - 1, index));
    activeIndex = index;
    cards.forEach((card, i) => card.classList.toggle('is-active', i === index));
    dots.forEach((dot, i) => dot.classList.toggle('is-active', i === index));
    if (current) current.textContent = pad(index);
    if (prev) prev.disabled = index === 0;
    if (next) next.disabled = index === cards.length - 1;
  };

  const nearestCard = () => {
    const center = carousel.scrollLeft + carousel.clientWidth / 2;
    let best = 0;
    let distance = Infinity;
    cards.forEach((card, i) => {
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const d = Math.abs(cardCenter - center);
      if (d < distance) { distance = d; best = i; }
    });
    setActive(best);
  };

  const goTo = (index, behavior = 'smooth') => {
    const card = cards[Math.max(0, Math.min(cards.length - 1, index))];
    if (!card) return;
    const left = card.offsetLeft - (carousel.clientWidth - card.offsetWidth) / 2;
    carousel.scrollTo({ left, behavior });
    setActive(cards.indexOf(card));
  };

  const open = card => {
    name.textContent = card.dataset.name || '';
    nickname.textContent = `“${card.dataset.nickname || ''}”`;
    img.src = card.dataset.image || '';
    img.alt = `Retrato de ${card.dataset.name || 'leyenda'}`;
    viewer.classList.add('open');
    viewer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('viewer-open');
    close.focus();
  };

  const hide = () => {
    viewer.classList.remove('open');
    viewer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('viewer-open');
  };

  cards.forEach((card, i) => {
    card.addEventListener('click', e => {
      if (dragged) { e.preventDefault(); return; }
      if (i !== activeIndex) goTo(i);
      else open(card);
    });
  });

  prev?.addEventListener('click', () => goTo(activeIndex - 1));
  next?.addEventListener('click', () => goTo(activeIndex + 1));

  carousel.addEventListener('scroll', () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(nearestCard);
  }, { passive: true });

  carousel.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointerDown = true;
    dragged = false;
    dragStartX = e.clientX;
    dragStartScroll = carousel.scrollLeft;
    carousel.classList.add('is-dragging');
    carousel.setPointerCapture?.(e.pointerId);
  });

  carousel.addEventListener('pointermove', e => {
    if (!pointerDown) return;
    const dx = e.clientX - dragStartX;
    if (Math.abs(dx) > 6) dragged = true;
    carousel.scrollLeft = dragStartScroll - dx;
  });

  const endDrag = e => {
    if (!pointerDown) return;
    pointerDown = false;
    carousel.classList.remove('is-dragging');
    carousel.releasePointerCapture?.(e.pointerId);
    nearestCard();
    goTo(activeIndex);
    setTimeout(() => { dragged = false; }, 60);
  };

  carousel.addEventListener('pointerup', endDrag);
  carousel.addEventListener('pointercancel', endDrag);
  carousel.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(activeIndex - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(activeIndex + 1); }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(cards[activeIndex]); }
  });

  close.addEventListener('click', hide);
  viewer.addEventListener('click', e => { if (e.target === viewer) hide(); });
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && viewer.classList.contains('open')) hide(); });
  window.addEventListener('resize', () => goTo(activeIndex, 'auto'));

  requestAnimationFrame(() => goTo(0, 'auto'));
})();
