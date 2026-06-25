/**
 * Client API MoveBissau — gère JWT, refresh, et requêtes.
 */
const API = '/api';

class ApiClient {
  constructor() {
    this.accessToken = localStorage.getItem('mb_access');
    this.refreshToken = localStorage.getItem('mb_refresh');
  }

  setTokens(access, refresh) {
    this.accessToken = access;
    this.refreshToken = refresh;
    localStorage.setItem('mb_access', access);
    localStorage.setItem('mb_refresh', refresh);
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('mb_access');
    localStorage.removeItem('mb_refresh');
    localStorage.removeItem('mb_user');
  }

  get isAuthenticated() { return !!this.accessToken; }

  getUser() {
    try { return JSON.parse(localStorage.getItem('mb_user')); }
    catch { return null; }
  }

  setUser(user) {
    localStorage.setItem('mb_user', JSON.stringify(user));
  }

  async request(path, opts = {}) {
    const headers = { 'Content-Type': 'application/json', ...opts.headers };
    if (this.accessToken) headers['Authorization'] = `Bearer ${this.accessToken}`;

    let res = await fetch(`${API}${path}`, { ...opts, headers });

    if (res.status === 401 && this.refreshToken) {
      const ok = await this._refresh();
      if (ok) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
        res = await fetch(`${API}${path}`, { ...opts, headers });
      }
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.detail || `Erreur ${res.status}`);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  async _refresh() {
    try {
      const res = await fetch(`${API}/auth/token/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: this.refreshToken }),
      });
      if (res.ok) {
        const d = await res.json();
        this.setTokens(d.access, d.refresh || this.refreshToken);
        return true;
      }
    } catch {}
    this.clearTokens();
    return false;
  }

  get(path) { return this.request(path); }
  post(path, data) { return this.request(path, { method: 'POST', body: JSON.stringify(data) }); }
  patch(path, data) { return this.request(path, { method: 'PATCH', body: JSON.stringify(data) }); }
  del(path) { return this.request(path, { method: 'DELETE' }); }
}

export const api = new ApiClient();
export default api;
