import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generatePDF() {
  console.log('🚀 Launching Chromium to generate KLAROS Algorithm & Architecture PDF...');

  const templatePath = path.join(__dirname, 'guide-template.html');
  const htmlContent = fs.readFileSync(templatePath, 'utf8');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.setContent(htmlContent, { waitUntil: 'networkidle' });

  const outputPath = path.join(__dirname, '..', 'KLAROS_SYSTEM_AND_ALGORITHM_GUIDE.pdf');

  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '16mm',
      bottom: '16mm',
      left: '14mm',
      right: '14mm',
    },
  });

  await browser.close();
  console.log(`✅ PDF successfully generated at: ${outputPath}`);
}

generatePDF().catch((err) => {
  console.error('❌ Failed to generate PDF:', err);
  process.exit(1);
});
