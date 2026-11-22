// Dev-only: gate screenshots. Usage: NODE_PATH=<dir with playwright> node scripts/shots.mjs [outDir]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.env.RHUMB_URL || 'http://localhost:2374';
const out = process.argv[2] || new URL('../../review-shots/phase-3/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const pages = { home: '/', post: '/field-guide/' };
const browser = await chromium.launch();
for (const scheme of ['light', 'dark']) {
    for (const width of [375, 1440]) {
        const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, deviceScaleFactor: width === 375 ? 2 : 1 });
        for (const [name, path] of Object.entries(pages)) {
            const page = await ctx.newPage();
            await page.goto(base + path, { waitUntil: 'networkidle' });
            // Scroll through once so lazy images load before the full-page capture.
            await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } scrollTo(0, 0); });
            await page.waitForLoadState('networkidle');
            await page.screenshot({ path: `${out}/${name}-${scheme}-${width}.png`, fullPage: true });
            await page.close();
        }
        await ctx.close();
    }
}
await browser.close();
console.log('Saved to', out);
