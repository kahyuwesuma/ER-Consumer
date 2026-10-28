const fs = require('fs');
const ejs = require('ejs');
const path = require('path');
const puppeteer = require('puppeteer-core');

// Versi pack HARUS sama dengan versi paket @sparticuz/chromium-min yang terpasang
const CHROMIUM_PACK_URL =
  process.env.CHROMIUM_PACK_URL ||
  'https://github.com/Sparticuz/chromium/releases/download/v153.0.0/chromium-v153.0.0-pack.x64.tar';

// Lokasi Chrome/Edge untuk pengembangan lokal (bisa diatur lewat env CHROME_PATH)
const LOCAL_CHROME_PATHS = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

async function launchBrowser() {
  if (process.env.VERCEL) {
    // import() dinamis: paket ESM-only tidak bisa di-require dari CommonJS
    const { default: chromium } = await import('@sparticuz/chromium-min');
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(CHROMIUM_PACK_URL),
      headless: 'shell',
    });
  }

  const executablePath = LOCAL_CHROME_PATHS.find((p) => fs.existsSync(p));
  if (!executablePath) {
    throw new Error('Chrome/Edge tidak ditemukan. Set env CHROME_PATH ke lokasi chrome.exe.');
  }
  return puppeteer.launch({ executablePath, headless: true });
}

class PdfBuilder {
  static async createPDF(templateName, data) {
    const templatePath = path.join(__dirname, '../views/templates', `${templateName}.ejs`);
    const html = await ejs.renderFile(templatePath, data);

    let browser;
    try {
      browser = await launchBrowser();

      const page = await browser.newPage();
      // Semua aset sudah inline (foto base64), jadi tidak perlu menunggu jaringan idle
      await page.setContent(html, { waitUntil: 'load' });

      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '25mm', right: '20mm', bottom: '25mm', left: '20mm' },
        displayHeaderFooter: true,
        headerTemplate: `
          <div style="font-family: system-ui, -apple-system, sans-serif; font-size: 9px; color: #6b7280; width: 100%; display: flex; justify-content: space-between; padding: 0 20mm;">
            <span style="font-weight: 500;">EarthRanger Patrol Report</span>
            <span class="date"></span>
          </div>`,
        footerTemplate: `
          <div style="font-family: system-ui, -apple-system, sans-serif; font-size: 9px; color: #9ca3af; width: 100%; display: flex; justify-content: space-between; padding: 0 20mm;">
            <div>Halaman <span class="pageNumber"></span> dari <span class="totalPages"></span></div>
          </div>`,
      });

      return Buffer.from(pdf); // Puppeteer baru mengembalikan Uint8Array; Express butuh Buffer
    } finally {
      if (browser) await browser.close();
    }
  }
}

module.exports = PdfBuilder;