const { httpsRequest } = require('./httpClient');

class SupabaseClient {
  constructor() {
    this._url = '';
    this._anonKey = '';
  }

  configure(url, anonKey) {
    this._url = url.replace(/\/$/, '');
    this._anonKey = anonKey;
  }

  get isConfigured() {
    return Boolean(this._url && this._anonKey);
  }

  _headers(prefer) {
    const h = {
      apikey: this._anonKey,
      Authorization: `Bearer ${this._anonKey}`,
      'Content-Type': 'application/json',
    };
    if (prefer) h.Prefer = prefer;
    return h;
  }

  /** Get user row by discord_id (or null). */
  async getUser(discordId) {
    if (!this.isConfigured) return null;
    const res = await httpsRequest(
      `${this._url}/rest/v1/users?discord_id=eq.${encodeURIComponent(discordId)}&select=*`,
      { headers: this._headers() },
    );
    console.log(`Supabase GET user: status=${res.status}, body=${res.body?.slice(0, 300)}`);
    if (res.status !== 200 || !Array.isArray(res.json)) return null;
    return res.json[0] || null;
  }
  async upsertUser(discordId, discordName) {
    if (!this.isConfigured) return null;
    const res = await httpsRequest(`${this._url}/rest/v1/users`, {
      method: 'POST',
      headers: this._headers('resolution=merge-duplicates,return=representation'),
      body: JSON.stringify({ discord_id: discordId, discord_name: discordName || null }),
    });
    console.log(`Supabase UPSERT user: status=${res.status}, body=${res.body?.slice(0, 300)}`);
    if (res.status !== 200 && res.status !== 201) return null;
    return Array.isArray(res.json) ? res.json[0] : res.json;
  }

  /** Update local_name for a user (fails silently if column doesn’t exist). */
  async updateLocalName(discordId, name) {
    if (!this.isConfigured) return;
    try {
      await httpsRequest(
        `${this._url}/rest/v1/users?discord_id=eq.${encodeURIComponent(discordId)}`,
        {
          method: 'PATCH',
          headers: this._headers('return=minimal'),
          body: JSON.stringify({ local_name: name }),
        },
      );
    } catch { /* ignore — column may not exist */ }
  }
}

module.exports = new SupabaseClient();
