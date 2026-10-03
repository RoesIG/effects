window.FXStorage = (() => {
  const prefix = 'fxtools.v2.';
  const get = (key, fallback) => {
    try {
      const raw = localStorage.getItem(prefix + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  };
  const set = (key, value) => {
    localStorage.setItem(prefix + key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent('fx-storage-change', { detail: { key, value } }));
  };
  const remove = key => localStorage.removeItem(prefix + key);
  const all = () => Object.keys(localStorage)
    .filter(k => k.startsWith(prefix))
    .reduce((acc, k) => { acc[k.slice(prefix.length)] = get(k.slice(prefix.length), null); return acc; }, {});
  const exportJSON = () => JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), data: all() }, null, 2);
  const importJSON = text => {
    const parsed = JSON.parse(text);
    const data = parsed?.data ?? parsed;
    if (!data || typeof data !== 'object') throw new Error('Archivo no válido');
    Object.entries(data).forEach(([k,v]) => set(k,v));
  };
  return { get, set, remove, all, exportJSON, importJSON };
})();
