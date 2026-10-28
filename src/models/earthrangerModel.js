const axios = require('axios');

/** Menangani {data:{results,next}}, {results,next}, {data:[...]}, dan [...] */
function unwrap(body) {
  let d = body;
  if (d && !Array.isArray(d) && d.data !== undefined) d = d.data;
  if (Array.isArray(d)) return { results: d, next: null };
  return { results: Array.isArray(d?.results) ? d.results : [], next: d?.next || null };
}

class EarthRangerModel {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.client = axios.create({
      baseURL: `${this.baseUrl}/api/v1.0`,
      headers: { Authorization: `Bearer ${token}` },
      timeout: 60000,
    });
  }

  async getMe() {
    const res = await this.client.get('/user/me');
    return res.data?.data || res.data;
  }

  /** Ikuti `next` sampai habis atau mencapai `max` */
  async _paginate(path, params = {}, max = Infinity) {
    const out = [];
    const t0 = Date.now();
    let page = 1;
    let res = await this.client.get(path, { params });
    for (; ;) {
      const { results, next } = unwrap(res.data);
      out.push(...results);
      console.log(`[ER] ${path} hal.${page}: +${results.length} (total ${out.length}) ${Date.now() - t0}ms next=${next ? 'ya' : 'tidak'}`);
      if (!next || !results.length || out.length >= max) break;
      const u = new URL(next);
      res = await this.client.get(`${this.baseUrl}${u.pathname}${u.search}`);
      page++;
    }
    return out.slice(0, max);
  }

  getPatrols(params = {}, max = Infinity) {
    return this._paginate('/activity/patrols/', params, max);
  }

  getEvents(params = {}, max = Infinity) {
    return this._paginate('/activity/events/', params, max);
  }

  async getPatrolById(id) {
    const res = await this.client.get(`/activity/patrols/${id}`);
    return res.data?.data || res.data;
  }

  async getPhotoBase64(url) {
    if (!url) return null;
    try {
      const abs = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
      const sameOrigin = new URL(abs).origin === new URL(this.baseUrl).origin;
      // Token hanya dikirim ke server ER sendiri
      const res = sameOrigin
        ? await this.client.get(abs, { responseType: 'arraybuffer' })
        : await axios.get(abs, { responseType: 'arraybuffer', timeout: 60000 });
      const contentType = res.headers['content-type'] || 'image/jpeg';
      return `data:${contentType};base64,${Buffer.from(res.data).toString('base64')}`;
    } catch (e) {
      console.warn('[photo] gagal:', abs?.slice(0, 80), e.message);
      return null;
    }
  }
}

module.exports = EarthRangerModel;