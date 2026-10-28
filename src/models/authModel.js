const axios = require('axios');

class AuthModel {
  static async login(baseUrl, username, password) {
    const cleanBaseUrl = baseUrl.replace(/\/$/, '');
    const errors = [];

    // METODE 1: EarthRanger Native Session/Token Auth (/api/v1.0/auth/login/)
    try {
      const res = await axios.post(`${cleanBaseUrl}/api/v1.0/auth/login/`, {
        username: username,
        password: password
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });

      const token = res.data?.token || res.data?.access_token || res.data?.data?.token;
      if (token) {
        console.log('[✔] Login berhasil via Native ER Auth Endpoint.');
        return token;
      }
    } catch (err) {
      const status = err.response?.status || 'No Response';
      const detail = JSON.stringify(err.response?.data || err.message);
      errors.push(`[Native Auth ${status}]: ${detail}`);
    }

    // METODE 2: OAuth2 Grant Password (/oauth2/token/)
    const clientIds = ['das_web_client', 'er_web_client', 'das_service_client'];
    for (const clientId of clientIds) {
      try {
        const data = new URLSearchParams({
          client_id: clientId,
          grant_type: 'password',
          username: username,
          password: password
        });

        const res = await axios.post(`${cleanBaseUrl}/oauth2/token/`, data, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 10000
        });

        if (res.data && res.data.access_token) {
          console.log(`[✔] Login berhasil via OAuth2 (${clientId}).`);
          return res.data.access_token;
        }
      } catch (err) {
        const status = err.response?.status || 'No Response';
        const detail = JSON.stringify(err.response?.data || err.message);
        errors.push(`[OAuth2 ${clientId} ${status}]: ${detail}`);
      }
    }

    // Print detail error di terminal untuk analisa
    console.error('\n[❌] DETAIL RESPONS ERROR DARI SERVER EARTHRANGER:');
    errors.forEach(e => console.error('  ->', e));
    console.error('');

    throw new Error('Login Gagal. Cek terminal Node.js kamu untuk melihat detail pesan error dari server EarthRanger.');
  }
}

module.exports = AuthModel;