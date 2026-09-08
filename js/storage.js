window.FXStorage = (() => {
  // Se mantiene el prefijo v2 a propósito para que todas las versiones V3
  // sigan leyendo los datos existentes del usuario sin migración manual.
  const prefix = 'fxtools.v2.';

  const get = (key, fallback) => {
    try {
      const raw = localStorage.getItem(prefix + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  };

  const set = (key, value) => {
    localStorage.setItem(prefix + key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent('fx-storage-change', { detail: { key, value } }));
  };

  const remove = key => {
    localStorage.removeItem(prefix + key);
    window.dispatchEvent(new CustomEvent('fx-storage-change', { detail: { key, removed: true } }));
  };

  const all = () => Object.keys(localStorage)
    .filter(k => k.startsWith(prefix))
    .reduce((acc, k) => {
      const key = k.slice(prefix.length);
      acc[key] = get(key, null);
      return acc;
    }, {});

  const estimateBytes = () => {
    try {
      return Object.keys(localStorage)
        .filter(k => k.startsWith(prefix))
        .reduce((sum, k) => sum + (k.length + String(localStorage.getItem(k) || '').length) * 2, 0);
    } catch {
      return 0;
    }
  };

  const exportJSON = () => JSON.stringify({
    app: 'FX Tools',
    version: 3,
    storagePrefix: prefix,
    exportedAt: new Date().toISOString(),
    data: all()
  }, null, 2);

  const importJSON = text => {
    const parsed = JSON.parse(text);
    const data = parsed?.data ?? parsed;
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Archivo no válido');
    Object.entries(data).forEach(([k, v]) => set(k, v));
    return Object.keys(data).length;
  };

  return { prefix, get, set, remove, all, estimateBytes, exportJSON, importJSON };
})();
