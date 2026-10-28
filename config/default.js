module.exports = {
  // Timezone default (WITA - UTC+8)
  timezone: 'Asia/Makassar',

  // Palet Warna Resmi Laporan (Presisi dengan Skema Python v5)
  colors: {
    dark: '#0D3B2E',
    mid: '#1A6B45',
    light: '#C8E6D4',
    xlight: '#F2FAF5',
    accent: '#27AE60',
    warn: '#E67E22',
    danger: '#C0392B',
    info: '#2471A3',
    gray: '#95A5A6',
    lgray: '#ECF0F1',
    dgray: '#5D6D7E',
    white: '#FFFFFF',
    black: '#1C1C1C',
    solo: '#6C3483' // Warna khusus Standalone Events
  },

  // Konfigurasi Puppeteer PDF Output
  pdf: {
    format: 'A4',
    printBackground: true,
    margin: {
      top: '18mm',
      right: '15mm',
      bottom: '18mm',
      left: '15mm'
    }
  },

  // Konfigurasi Default Fetching API
  defaults: {
    pageSize: 200,
    patrolLimit: 50,
    baseUrl: 'https://gcda.pamdas.org'
  }
};