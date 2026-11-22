// Dev-only: renders the placeholder photos used by seed.mjs. Needs playwright (borrowed via NODE_PATH).
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const out = new URL('./seed-images/', import.meta.url).pathname;
const shots = [
    ['chart-a', 2000, 1250, '#27455c', '#c9b38a'], ['chart-b', 2000, 1250, '#5c3a27', '#e4d6bd'],
    ['chart-c', 1600, 1600, '#2f4a3a', '#d9cfa8'], ['chart-d', 1600, 1200, '#3b3550', '#d7c3b0'],
    ['chart-e', 1600, 1200, '#6b5a2e', '#e9e2cf'], ['thumb', 800, 800, '#1f2d3a', '#b89a6a']
];
const browser = await chromium.launch();
for (const [name, w, h, a, b] of shots) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.setContent(`<body style="margin:0;height:100vh;background:
        repeating-linear-gradient(115deg, transparent 0 78px, ${b}55 78px 80px),
        repeating-linear-gradient(25deg, transparent 0 118px, ${b}33 118px 120px),
        radial-gradient(circle at 30% 35%, ${b}, ${a} 70%)"></body>`);
    await page.screenshot({ path: `${out}${name}.jpg`, type: 'jpeg', quality: 72 });
    await page.close();
}
await browser.close();
