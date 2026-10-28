const puppeteer = require('puppeteer');
const ejs = require('ejs');
const path = require('path');
const chromium = require('@sparticuz/chromium');

class PdfBuilder {
  static async createPDF(templateName, data) {
    const templatePath = path.join(__dirname, '../views/templates', `${templateName}.ejs`);

    const html = await ejs.renderFile(templatePath, data);

    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
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
        </div>`
    });

    await browser.close();
    return pdfBuffer;
  }
}

module.exports = PdfBuilder;