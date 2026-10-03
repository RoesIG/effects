(() => {
  const viewer = document.getElementById('legendViewer');
  if (!viewer) return;
  const img = document.getElementById('legendViewerImage');
  const name = document.getElementById('legendViewerName');
  const nickname = document.getElementById('legendViewerNickname');
  const close = viewer.querySelector('.legend-viewer-close');

  const open = (card) => {
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

  document.querySelectorAll('.legend-card').forEach(card => card.addEventListener('click', () => open(card)));
  close.addEventListener('click', hide);
  viewer.addEventListener('click', e => { if (e.target === viewer) hide(); });
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && viewer.classList.contains('open')) hide(); });
})();
