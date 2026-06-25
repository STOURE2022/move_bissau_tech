/**
 * Client API pour le dashboard admin MoveBissau.
 * Gère l'authentification JWT et les appels REST.
 */

const API_BASE = '/api';

class ApiClient {
  constructor() {
    this.accessToken = localStorage.getItem('access_token');
    this.refreshToken = localStorage.getItem('refresh_token');
  }

  /** Sauvegarde les tokens */
  setTokens(access, refresh) {
    this.accessToken = access;
    this.refreshToken = refresh;
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
  }

  /** Supprime les tokens */
  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }

  get isAuthenticated() {
    return !!this.accessToken;
  }

  /** Requête HTTP avec auth */
  async request(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    let response = await fetch(`${API_BASE}${path}`, { ...options, headers });

    // Si 401, tenter un refresh
    if (response.status === 401 && this.refreshToken) {
      const refreshed = await this._refresh();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
        response = await fetch(`${API_BASE}${path}`, { ...options, headers });
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || error.detail || `Erreur ${response.status}`);
    }

    if (response.status === 204) return null;
    return response.json();
  }

  async _refresh() {
    try {
      const response = await fetch(`${API_BASE}/auth/token/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: this.refreshToken }),
      });
      if (response.ok) {
        const data = await response.json();
        this.setTokens(data.access, data.refresh || this.refreshToken);
        return true;
      }
    } catch (_) {}
    this.clearTokens();
    return false;
  }

  // Raccourcis
  get(path) { return this.request(path); }
  post(path, data) { return this.request(path, { method: 'POST', body: JSON.stringify(data) }); }
  patch(path, data) { return this.request(path, { method: 'PATCH', body: JSON.stringify(data) }); }
  del(path) { return this.request(path, { method: 'DELETE' }); }
}

export const api = new ApiClient();
export default api;
