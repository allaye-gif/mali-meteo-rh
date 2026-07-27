// ============ Client API ============
const API = {
  base: '/api',
  token: localStorage.getItem('mm_token') || null,

  setToken(t) {
    this.token = t;
    if (t) localStorage.setItem('mm_token', t);
    else localStorage.removeItem('mm_token');
  },

  async request(method, path, { body, isForm } = {}) {
    const headers = {};
    if (this.token) headers['Authorization'] = 'Bearer ' + this.token;
    const opts = { method, headers };
    if (body !== undefined) {
      if (isForm) {
        opts.body = body; // FormData : le navigateur fixe le Content-Type
      } else {
        headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
      }
    }
    const res = await fetch(this.base + path, opts);
    if (res.status === 401) {
      API.setToken(null);
      if (typeof onSessionExpiree === 'function') onSessionExpiree();
    }
    let data = null;
    const texte = await res.text();
    try { data = texte ? JSON.parse(texte) : null; } catch (e) { data = null; }
    if (!res.ok) {
      const err = new Error((data && data.error) || `Erreur ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data;
  },

  get(path) { return this.request('GET', path); },
  post(path, body, opts) { return this.request('POST', path, { body, ...opts }); },
  put(path, body, opts) { return this.request('PUT', path, { body, ...opts }); },
  del(path) { return this.request('DELETE', path); },

  // Téléchargement de fichier authentifié (blob) — utilisé pour la sauvegarde et l'impression
  async telechargerFichier(path, nomFichier) {
    const headers = {};
    if (this.token) headers['Authorization'] = 'Bearer ' + this.token;
    const res = await fetch(this.base + path, { headers });
    if (!res.ok) throw new Error('Échec du téléchargement.');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nomFichier;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }
};
