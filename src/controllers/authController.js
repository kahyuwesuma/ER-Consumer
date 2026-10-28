const AuthModel = require('../models/authModel');

const SITES = {
  'https://gcda.pamdas.org': 'GCDA',
  'https://gcbs.pamdas.org': 'GCBS',
};

const NETWORK_CODES = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN'];

// Error koneksi/server mati, bukan kredensial salah
function isNetworkError(err) {
  const code = err.code || (err.cause && err.cause.code);
  return NETWORK_CODES.includes(code) || /fetch failed|timeout/i.test(err.message || '');
}

class AuthController {
  static renderLogin(req, res) {
    if (req.cookies.er_token) return res.redirect('/dashboard');
    res.render('login', { error: null });
  }

  static async login(req, res) {
    const { baseUrl, username, password } = req.body;
    const fail = (error) => res.status(401).render('login', { error, baseUrl });

    // Hanya gcda/gcbs yang diizinkan
    if (!SITES[baseUrl]) return fail('invalid_site');

    try {
      const token = await AuthModel.login(baseUrl, username, password);

      // Simpan credential sementara di cookie (1 hari)
      res.cookie('er_token', token, { httpOnly: true, maxAge: 86400000 });
      res.cookie('er_base_url', baseUrl, { httpOnly: true, maxAge: 86400000 });

      return res.redirect('/dashboard');
    } catch (err) {
      if (isNetworkError(err)) return fail('server_down');
    }

    // Ditolak di site terpilih: cek apakah kredensial valid di site satunya
    const other = Object.keys(SITES).find((u) => u !== baseUrl);
    try {
      await AuthModel.login(other, username, password);
      return fail('not_registered');
    } catch (err) {
      return fail('bad_credentials');
    }
  }

  static logout(req, res) {
    res.clearCookie('er_token');
    res.clearCookie('er_base_url');
    res.redirect('/login');
  }
}

module.exports = AuthController;