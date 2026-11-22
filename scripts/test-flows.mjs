// Dev-only: exercises the Ghost features Rhumb supports and saves evidence screenshots.
// Needs: local Ghost with seed.mjs content, mailpit on 127.0.0.1:8025, playwright via NODE_PATH.
// Usage: NODE_PATH=<dir with playwright> node scripts/test-flows.mjs
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');

const here = new URL('.', import.meta.url).pathname;
const cfg = Object.fromEntries(readFileSync(`${here}../../.local-admin`, 'utf8').trim().split('\n').map(l => l.split(/=(.*)/s).slice(0, 2)));
const U = new URL(cfg.url).origin;
const MAIL = 'http://127.0.0.1:8025/api/v1';
const out = `${here}../../review-shots/phase-4`;
mkdirSync(out, { recursive: true });

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); if (!ok) { failed++; } };
const shot = (page, name, opts = {}) => page.screenshot({ path: `${out}/${name}.png`, ...opts });
const wait = ms => new Promise(r => setTimeout(r, ms));

let cookie = '';
async function admin(method, path, body) {
    const res = await fetch(`${U}/ghost/api/admin${path}`, { method, headers: { Origin: U, Cookie: cookie, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
    const set = res.headers.get('set-cookie');
    if (set) { cookie = set.split(';')[0]; }
    if (!res.ok) { throw new Error(`${method} ${path} -> ${res.status}`); }
    return res.json().catch(() => null);
}
const setLocale = locale => admin('PUT', '/settings/', { settings: [{ key: 'locale', value: locale }] });

const browser = await chromium.launch();
const anon = await browser.newContext({ viewport: { width: 1200, height: 900 } });
const page = await anon.newPage();

try {
    await admin('POST', '/session/', { username: cfg.email, password: cfg.password });
    await setLocale('en');
    await fetch(`${MAIL}/messages`, { method: 'DELETE' });

    // 1. Portal opens from the header -------------------------------------
    await page.goto(U, { waitUntil: 'networkidle' });
    await page.click('.site-actions [data-portal="signup"]');
    const portal = page.frameLocator('iframe[title="portal-popup"]');
    await portal.locator('input[type="email"]').waitFor({ timeout: 10000 });
    check('Portal: header "Subscribe" opens the signup popup', true);
    await shot(page, '01-portal-signup');
    await page.keyboard.press('Escape');
    await page.click('.site-actions [data-portal="signin"]');
    await portal.locator('input[type="email"]').waitFor({ timeout: 10000 });
    check('Portal: header "Sign in" opens the sign-in popup', true);
    await page.keyboard.press('Escape');

    // 2. Keyboard: skip link ----------------------------------------------
    await page.goto(U, { waitUntil: 'networkidle' });
    await page.keyboard.press('Tab');
    const skip = await page.evaluate(() => { const a = document.activeElement; const r = a.getBoundingClientRect(); return { cls: a.className, top: r.top, href: a.getAttribute('href') }; });
    check('Keyboard: first Tab lands on a visible skip link', skip.cls === 'skip-link' && skip.top >= 0 && skip.href === '#main', JSON.stringify(skip));
    await shot(page, '02-skip-link-focus', { clip: { x: 0, y: 0, width: 1200, height: 160 } });

    // 3. Gating as a visitor ----------------------------------------------
    await page.goto(`${U}/the-lighthouse-keepers-grammar/`, { waitUntil: 'networkidle' });
    let body = await page.textContent('.gh-content');
    check('Gating: members-only post hides the text from visitors', !body.includes('rhumb line crosses') && body.includes('This post is for subscribers only'));
    await shot(page, '03-gate-members-visitor');
    await page.goto(`${U}/what-the-pilot-book-leaves-out/`, { waitUntil: 'networkidle' });
    body = await page.textContent('.gh-content');
    check('Gating: paid post hides the text from visitors', !body.includes('rhumb line crosses') && body.includes('This post is for paying subscribers only'));
    await page.emulateMedia({ colorScheme: 'dark' });
    await shot(page, '04-gate-paid-visitor-dark');
    await page.emulateMedia({ colorScheme: 'light' });
    const btn = await page.evaluate(() => { const s = getComputedStyle(document.querySelector('.gh-post-upgrade-cta .gh-btn')); return `${s.color} on ${s.backgroundColor}`; });
    check('Gating: gate button uses the contrast colour on the accent', btn === 'rgb(255, 255, 255) on rgb(74, 96, 178)', btn);

    // 4. Subscribe form -> email -> member --------------------------------
    await page.goto(U, { waitUntil: 'networkidle' });
    const email = `rhumb-test-${Date.now()}@example.com`;
    await page.fill('#subscribe-email', email);
    await page.click('.subscribe button');
    await page.waitForFunction(() => /success|error/.test(document.querySelector('.subscribe form').className), null, { timeout: 15000 });
    const cls = await page.getAttribute('.subscribe form', 'class');
    check('Subscribe form: Ghost marks the form as success', cls.includes('success'), cls);
    check('Subscribe form: success message becomes visible', await page.isVisible('.message-success'));
    await page.locator('.subscribe').scrollIntoViewIfNeeded();
    await shot(page, '05-subscribe-success');
    await wait(1500);
    const list = await (await fetch(`${MAIL}/messages`)).json();
    const mail = list.messages.find(m => m.To[0].Address === email);
    check('Subscribe form: Ghost sent the confirmation email', !!mail, mail?.Subject);
    const text = (await (await fetch(`${MAIL}/message/${mail.ID}`)).json()).Text;
    await page.goto(text.match(/http:\/\/localhost:\d+\/members\/\?token=\S+/)[0], { waitUntil: 'networkidle' });
    const actions = (await page.textContent('.site-actions')).replace(/\s+/g, ' ').trim();
    check('Members: magic link signs in, header shows Account', actions === 'Account', actions);
    check('Members: subscribe form is hidden for members', (await page.locator('.subscribe').count()) === 0);
    await shot(page, '06-member-home');
    await page.click('.site-actions [data-portal="account"]');
    await portal.locator(`text=${email}`).first().waitFor({ timeout: 10000 });
    check('Portal: account popup shows the member and newsletter settings', true);
    await shot(page, '07-portal-account');
    await page.keyboard.press('Escape');

    // 5. Gating as a free member ------------------------------------------
    await page.goto(`${U}/the-lighthouse-keepers-grammar/`, { waitUntil: 'networkidle' });
    body = await page.textContent('.gh-content');
    check('Gating: members-only post is readable for a free member', body.includes('rhumb line crosses') && !body.includes('subscribers only'));
    await page.goto(`${U}/what-the-pilot-book-leaves-out/`, { waitUntil: 'networkidle' });
    body = await page.textContent('.gh-content');
    check('Gating: paid post offers a free member the upgrade', !body.includes('rhumb line crosses') && body.includes('Upgrade your account'));
    await shot(page, '08-gate-paid-free-member');

    // 6. Comments ----------------------------------------------------------
    await page.goto(`${U}/field-guide/`, { waitUntil: 'networkidle' });
    await page.locator('#ghost-comments-root').scrollIntoViewIfNeeded();
    const comments = page.frameLocator('iframe[title="comments-frame"]');
    await comments.locator('[data-testid="form-editor"]').click({ timeout: 15000 });
    // First-time commenters get Ghost's "Complete your profile" popup, in a frame of its own.
    await wait(2000);
    for (const frame of page.frames()) {
        if (await frame.locator('text=Complete your profile').count()) {
            await frame.locator('input').first().fill('Test Reader');
            await frame.locator('button:has-text("Save")').click();
            await wait(1500);
        }
    }
    const note = `Holding the heading. ${Date.now()}`;
    await comments.locator('[data-testid="editor"]').click();
    await page.keyboard.type(note);
    await comments.locator('[data-testid="submit-form-button"]').click();
    await comments.locator(`[data-testid="comment-elements"] >> text=${note}`).waitFor({ timeout: 15000 });
    check('Comments: a member can post a comment and it appears', true);
    await page.locator('#ghost-comments-root').scrollIntoViewIfNeeded();
    await shot(page, '09-comment-posted');

    // 7. Search ------------------------------------------------------------
    await page.goto(U, { waitUntil: 'networkidle' });
    await page.focus('.gh-search-icon');
    const ring = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
    check('Search: the button shows a focus ring despite Ghost\'s inline outline:none', ring === 'solid', ring);
    await page.keyboard.press('Enter');
    const search = page.frameLocator('iframe[title="portal-popup"], iframe[title*="earch"], #sodo-search-root iframe').first();
    await search.locator('input').first().fill('harbour');
    await search.locator('text=Notes from a harbour with no chart').first().waitFor({ timeout: 15000 });
    check('Search: typing "harbour" finds the matching post', true);
    await shot(page, '10-search-results');
    await page.keyboard.press('Escape');

    // 8. Locales -----------------------------------------------------------
    const expect = {
        nl: ['Ga naar de inhoud', 'Abonneren', 'Dit bericht is alleen voor abonnees', '% min leestijd'],
        fr: ['Aller au contenu', 'S\'abonner', 'Cet article est réservé aux abonnés', '% min de lecture'],
        de: ['Zum Inhalt springen', 'Abonnieren', 'Dieser Beitrag ist nur für Abonnenten', '% Min. Lesezeit'],
        es: ['Saltar al contenido', 'Suscribirse', 'Esta entrada es solo para suscriptores', '% min de lectura'],
        en: ['Skip to content', 'Subscribe', 'This post is for subscribers only', '% min read']
    };
    const visitor = await (await browser.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
    for (const [locale, [skipText, subscribe, gate, reading]] of Object.entries(expect)) {
        await setLocale(locale);
        await wait(800);
        await visitor.goto(U, { waitUntil: 'networkidle' });
        const lang = await visitor.getAttribute('html', 'lang');
        const home = await visitor.textContent('body');
        await visitor.goto(`${U}/the-lighthouse-keepers-grammar/`, { waitUntil: 'networkidle' });
        const gated = await visitor.textContent('main');
        await visitor.goto(`${U}/field-guide/`, { waitUntil: 'networkidle' });
        const meta = await visitor.textContent('.post-meta');
        const ok = lang === locale && home.includes(skipText) && home.includes(subscribe) && gated.includes(gate) && meta.includes(reading.replace('%', '6'));
        check(`i18n ${locale}: lang attribute, skip link, subscribe, gate and reading time`, ok, `lang=${lang} | ${meta.replace(/\s+/g, ' ').trim()}`);
        if (locale !== 'en') {
            await visitor.goto(`${U}/the-lighthouse-keepers-grammar/`, { waitUntil: 'networkidle' });
            await shot(visitor, `11-locale-${locale}`);
        }
    }
} catch (e) {
    check('Run completed without an exception', false, e.message.split('\n')[0]);
    await shot(page, '99-failure').catch(() => {});
} finally {
    await setLocale('en').catch(() => {});
    await browser.close();
}
console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
