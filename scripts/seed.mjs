// Dev-only: fills the local Ghost with Rhumb demo content. Never shipped (zip.sh is an allowlist).
// Usage: node scripts/seed.mjs   (reads ../../.local-admin for url/email/password)
// Destructive on purpose: deletes every post first, so only run it against the local demo database.
import { readFileSync } from 'node:fs';

const here = new URL('.', import.meta.url).pathname;
const cfg = Object.fromEntries(readFileSync(`${here}../../.local-admin`, 'utf8').trim().split('\n').map(l => l.split(/=(.*)/s).slice(0, 2)));
const origin = new URL(cfg.url).origin;
const api = `${origin}/ghost/api/admin`;
if (!/^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(origin + '/')) { throw new Error('seed.mjs only runs against localhost'); }

let cookie = '';
async function call(method, path, body, raw) {
    const res = await fetch(api + path, {
        method,
        headers: { Origin: origin, Cookie: cookie, ...(raw ? {} : { 'Content-Type': 'application/json' }) },
        body: raw ? body : body && JSON.stringify(body)
    });
    if (!res.ok) { throw new Error(`${method} ${path} -> ${res.status} ${(await res.text()).slice(0, 400)}`); }
    const set = res.headers.get('set-cookie');
    if (set) { cookie = set.split(';')[0]; }
    return res.status === 204 || res.headers.get('content-type')?.includes('json') === false ? null : res.json().catch(() => null);
}

async function upload(name, ext = 'jpg', type = 'image/jpeg') {
    const form = new FormData();
    form.append('file', new Blob([readFileSync(`${here}seed-images/${name}.${ext}`)], { type }), `${name}.${ext}`);
    return (await call('POST', '/images/upload/', form, true)).images[0].url;
}

async function uploadMedia(name, type) {
    const form = new FormData();
    form.append('file', new Blob([readFileSync(`${here}seed-media/${name}`)], { type }), name);
    return (await call('POST', '/media/upload/', form, true)).media[0].url;
}

// --- Lexical helpers -------------------------------------------------------
const el = { direction: 'ltr', format: '', indent: 0, version: 1 };
const t = (text, format = 0) => ({ type: 'extended-text', text, format, detail: 0, mode: 'normal', style: '', version: 1 });
const b = s => t(s, 1), i = s => t(s, 2), c = s => t(s, 16);
const a = (text, url) => ({ ...el, type: 'link', url, rel: null, target: null, title: null, children: [t(text)] });
const kids = xs => xs.map(x => (typeof x === 'string' ? t(x) : x));
const p = (...xs) => ({ ...el, type: 'paragraph', children: kids(xs) });
const h = (n, s) => ({ ...el, type: 'extended-heading', tag: `h${n}`, children: [t(s)] });
const quote = (...xs) => ({ ...el, type: 'extended-quote', children: kids(xs) });
const aside = (...xs) => ({ ...el, type: 'aside', children: kids(xs) });
const li = (xs, value) => ({ ...el, type: 'listitem', value, children: kids([].concat(xs)) });
const list = (tag, items) => ({ ...el, type: 'list', listType: tag === 'ol' ? 'number' : 'bullet', start: 1, tag, children: items.map((x, n) => (x.type === 'list' ? { ...el, type: 'listitem', value: n + 1, children: [x] } : li(x, n + 1))) });
const hr = () => ({ type: 'horizontalrule', version: 1 });
const card = (type, props) => ({ type, version: 1, ...props });
const doc = children => JSON.stringify({ root: { ...el, type: 'root', children } });

const run = async () => {
    await call('POST', '/session/', { username: cfg.email, password: cfg.password });

    const img = {};
    for (const n of ['chart-a', 'chart-b', 'chart-c', 'chart-d', 'chart-e', 'thumb']) { img[n] = await upload(n); }

    const audio = await uploadMedia('fog-signal.mp3', 'audio/mpeg');
    const video = await uploadMedia('swell.mp4', 'video/mp4');

    await call('PUT', '/settings/', { settings: [
        { key: 'title', value: 'Rhumb' },
        { key: 'description', value: 'Notes on wayfinding, slow travel and the craft of keeping a log.' },
        { key: 'accent_color', value: '#4A60B2' },
        { key: 'logo', value: await upload('rhumb-logo', 'svg', 'image/svg+xml') },
        { key: 'navigation', value: JSON.stringify([{ label: 'Writing', url: '/' }, { label: 'About', url: '/about/' }, { label: 'Charts', url: '/tag/charts/' }]) },
        { key: 'secondary_navigation', value: JSON.stringify([{ label: 'RSS', url: '/rss/' }, { label: 'Subscribe', url: '#/portal/signup' }]) },
        { key: 'comments_enabled', value: 'all' }
    ] });

    const old = await call('GET', '/posts/?limit=all&fields=id');
    for (const post of old.posts) { await call('DELETE', `/posts/${post.id}/`); }

    const day = n => new Date(Date.UTC(2026, 10, 20) - n * 86400000 * 9).toISOString();
    const short = (title, excerpt, tag, n, extra = {}) => ({
        title, custom_excerpt: excerpt, tags: [{ name: tag }], status: 'published', published_at: day(n),
        lexical: doc([
            p('A rhumb line crosses every meridian at the same angle. It is not the shortest way between two harbours, but it is the one you can actually steer: pick a bearing, hold it, and arrive.'),
            p('Most of what I know about writing I learned the same way. ', i('Hold a heading.'), ' Correct for drift when you can see land. Write the position in the log before you trust your memory of it.'),
            h(2, 'What the log is for'),
            p('The log is not a diary. It records what was true at a given hour, in a hand that someone else could read at night, in weather.')
        ]), ...extra
    });

    const posts = [
        {
            title: 'A field guide to the long way round', slug: 'field-guide', status: 'published', published_at: day(0), featured: false,
            custom_excerpt: 'Every kind of block a writer can put on a page, set in one place so the typography can be judged honestly.',
            feature_image: img['chart-a'], feature_image_alt: 'Abstract chart of contour lines in blue and sand', feature_image_caption: 'Soundings off the north shore, redrawn from memory.',
            tags: [{ name: 'Charts' }, { name: 'Craft' }],
            lexical: doc([
                p('A rhumb line, or loxodrome, is a path that crosses every meridian at the same angle. On a Mercator chart it is a straight line; on the globe it spirals towards the pole without ever arriving. Navigators loved it for one reason: ', b('you could steer it'), '. Set the compass, hold the heading, and the chart would agree with the sea.'),
                p('This post is long on purpose. It carries every kind of block the editor offers, from ', i('plain running text'), ' and ', a('ordinary links', 'https://ghost.org'), ' to inline ', c('code'), ', tables and footnotes, so that the page can be judged the way a reader meets it: all at once, and for a while.'),
                h(2, 'Dead reckoning'),
                p('Before satellites, position was an argument made from three numbers: heading, speed and time. You began from a known place, and every hour you advanced the pencil mark by what the ship must have done. The method is called dead reckoning, and its errors accumulate quietly — a quarter knot of current, a helmsman who favours one side — until a headland appears where no headland should be.'),
                p('The cure was never better guessing. It was a fix: a star at dusk, a sounding, the bearing of a lighthouse. Good navigators did not trust their reckoning less than bad ones. They simply checked it more often, and wrote down the difference.'),
                quote('The log is the only instrument aboard that gets more accurate the less you admire it.'),
                h(3, 'What goes in the log'),
                list('ul', [
                    'Time, to the minute, in one zone and never two',
                    ['Course steered, not course ', i('intended')],
                    'Speed through the water, and how it was measured',
                    list('ul', ['By the log line, in knots', 'By engine revolutions, as a last resort']),
                    'Anything that would explain a later surprise'
                ]),
                p('And the order in which a fix is taken matters as much as the fix itself:'),
                list('ol', [
                    'Identify the mark and say its name aloud',
                    'Take the bearing; note the time before you look down',
                    'Plot it at once, while the number is still warm',
                    'Compare with the reckoned position and record the set'
                ]),
                card('image', { src: img['chart-b'], width: 2000, height: 1250, alt: 'Contour chart in umber and cream', caption: 'A regular image sits in the text column.', cardWidth: 'regular' }),
                h(2, 'The chart is not the sea'),
                p('Mercator knew his projection lied about area. Greenland swells, Africa shrinks, and the poles run off the paper entirely. He kept the lie because it bought a single truth that sailors needed more: angles on the chart are angles on the water. Every map chooses which truth to keep.'),
                aside('Every map chooses which truth to keep.'),
                p('Typography makes the same bargain. A measure of sixty-five characters is not the widest a screen allows; it is the width at which the eye finds the next line without hunting. Leading, margin and size are all small distortions in the service of one thing held constant: the reader keeps their place.'),
                card('image', { src: img['chart-a'], width: 2000, height: 1250, alt: 'Contour chart in blue and sand', caption: 'A wide image breaks out of the column on larger screens.', cardWidth: 'wide' }),
                p('Wide and full images are the two places where the column gives way. They should feel like a deck opening onto weather: sudden, and then over.'),
                card('image', { src: img['chart-d'], width: 1600, height: 1200, alt: 'Contour chart in violet and clay', caption: 'A full-width image runs from edge to edge.', cardWidth: 'full' }),
                h(2, 'Instruments'),
                p('What follows is the rest of the chest: the tools an editor reaches for less often, each of which has to sit in the column without shouting.'),
                h(3, 'Code'),
                p('The great-circle distance is short to state. Press ', c('⌘K'), ' and the rest is arithmetic:'),
                card('codeblock', { language: 'js', caption: 'Haversine distance in nautical miles.', code: 'const R = 3440.065; // nautical miles\n\nfunction distance(a, b) {\n    const rad = d => (d * Math.PI) / 180;\n    const dLat = rad(b.lat - a.lat);\n    const dLon = rad(b.lon - a.lon);\n    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;\n    return 2 * R * Math.asin(Math.sqrt(h)); // a long line that has to scroll rather than wrap on a small screen\n}' }),
                h(3, 'Tables and footnotes'),
                card('markdown', { markdown: 'A passage plan is mostly a table.[^1] Figures should line up, so that a difference of one digit is a difference you can see.[^2]\n\n| Leg | Course | Distance | Time |\n|---|---:|---:|---:|\n| Harbour to Outer Buoy | 042° | 3.2 nm | 0h 38m |\n| Outer Buoy to Skerry Light | 087° | 18.6 nm | 3h 43m |\n| Skerry Light to Anchorage | 121° | 107.4 nm | 21h 29m |\n\n[^1]: Kept in pencil, because a plan that cannot be corrected is a superstition.\n[^2]: This is what tabular figures are for. Old-style figures belong in sentences; lining ones belong in columns.' }),
                h(3, 'Callouts and toggles'),
                card('callout', { calloutEmoji: '🧭', calloutText: '<b><strong>Variation changes.</strong></b> The difference between true and magnetic north drifts by a few minutes of arc each year. Check the date on the compass rose.', backgroundColor: 'grey' }),
                card('callout', { calloutEmoji: '', calloutText: 'An accent callout, for the one thing on the page that must not be missed.', backgroundColor: 'accent' }),
                card('toggle', { heading: '<span>Why not simply sail the great circle?</span>', content: '<p>Because the heading changes continuously. A great circle is shorter, but it asks the helmsman for a new course every few hours; a rhumb line asks for one.</p>' }),
                card('toggle', { heading: '<span>How far off is the rhumb line?</span>', content: '<p>Across an ocean, a few percent. Across a bay, nothing you could measure.</p>' }),
                h(3, 'Gallery'),
                card('gallery', { caption: 'Three sheets from the same survey.', images: [
                    { row: 0, src: img['chart-c'], width: 1600, height: 1600, fileName: 'chart-c.jpg', alt: 'Green chart' },
                    { row: 0, src: img['chart-d'], width: 1600, height: 1200, fileName: 'chart-d.jpg', alt: 'Violet chart' },
                    { row: 0, src: img['chart-e'], width: 1600, height: 1200, fileName: 'chart-e.jpg', alt: 'Ochre chart' }
                ] }),
                h(3, 'Bookmarks, buttons and files'),
                card('bookmark', { url: 'https://ghost.org/', caption: 'A bookmark card, with a caption.', metadata: { title: 'Ghost: The best open source blog and newsletter platform', description: 'Beautiful, modern publishing with email newsletters and paid subscriptions built-in. Used by Platformer, 404Media, Lever News, Tangle and thousands more.', author: 'Ghost', publisher: 'Ghost - The Professional Publishing Platform', icon: img.thumb, thumbnail: img['chart-e'] } }),
                card('button', { buttonText: 'Read the sailing directions', buttonUrl: 'https://ghost.org', alignment: 'center' }),
                card('file', { src: `${origin}/content/files/passage-plan.pdf`, fileTitle: 'Passage plan template', fileCaption: 'One page, pencil-friendly.', fileName: 'passage-plan.pdf', fileSize: 184320 }),
                h(3, 'Audio, video and embeds'),
                card('audio', { src: audio, title: 'Fog signal, Skerry Light', duration: 4, mimeType: 'audio/mpeg', thumbnailSrc: img.thumb }),
                card('video', { src: video, caption: 'Swell from the quarter, an hour before dusk.', fileName: 'swell.mp4', mimeType: 'video/mp4', width: 640, height: 480, duration: 3, thumbnailSrc: img['chart-d'], thumbnailWidth: 1600, thumbnailHeight: 1200, cardWidth: 'regular' }),
                card('embed', { url: 'https://example.com/embed', embedType: 'video', caption: 'An embedded frame keeps its aspect ratio.', metadata: {}, html: '<iframe width="200" height="113" srcdoc="<body style=\'margin:0;display:grid;place-items:center;height:100vh;background:#27455c;color:#fff;font:16px system-ui\'>Embedded video</body>" title="Embedded video" allowfullscreen></iframe>' }),
                h(3, 'Product, header, signup and call to action'),
                card('product', { productImageSrc: img['chart-c'], productImageWidth: 1600, productImageHeight: 1600, productImageAlt: 'Green chart', productTitle: '<span>Brass dividers, seven inch</span>', productDescription: '<p>One-handed, so the other can stay on the chart table when she rolls.</p>', productRatingEnabled: true, productStarRating: 4, productButtonEnabled: true, productButton: 'See the maker', productUrl: 'https://ghost.org' }),
                card('header', { version: 2, header: '<span>Hold a heading</span>', subheader: '<span>A header card, in the colours its author chose.</span>', buttonEnabled: true, buttonText: 'Start reading', buttonUrl: 'https://ghost.org', backgroundColor: '#27455c', textColor: '#FFFFFF', buttonColor: '#ffffff', buttonTextColor: '#000000', alignment: 'center', layout: 'wide', backgroundSize: 'cover', accentColor: '#b4532a' }),
                card('signup', { header: '<span>The log, by post</span>', subheader: '<span>One letter when there is something to report.</span>', disclaimer: '<span>No spam. Unsubscribe at any time.</span>', buttonText: 'Subscribe', buttonColor: 'accent', buttonTextColor: '#FFFFFF', backgroundColor: '#F0F0F0', textColor: '#000000', layout: 'wide', alignment: 'left', labels: [] }),
                card('call-to-action', { layout: 'minimal', alignment: 'left', textValue: '<p><span>A call-to-action card. The chandlery on the quay still sells paper charts, and will correct them to the latest notices while you wait.</span></p>', showButton: true, showDividers: true, buttonText: 'Visit the chandlery', buttonUrl: 'https://ghost.org', buttonColor: '#000000', buttonTextColor: '#ffffff', hasSponsorLabel: true, sponsorLabel: '<p><span>SPONSORED</span></p>', backgroundColor: 'grey', linkColor: 'text', visibility: { web: { nonMember: true, memberSegment: 'status:free,status:-free' }, email: { memberSegment: 'status:free,status:-free' } } }),
                hr(),
                h(2, 'Landfall'),
                p('The last hour of a passage is the most dangerous, because it is the first hour in days when you believe you know where you are. The lights come up in the order the pilot book promised; the depth shoals on schedule. This is when the careful navigator takes one more fix.'),
                h(3, 'Coming alongside'),
                p('Slow is the only speed at which a harbour makes sense. Everything worth knowing about it is written on the water, and you have to give yourself time to read.'),
                h(4, 'A closing note on headings'),
                p('Four levels of heading are more than most essays need. They are here so that the smallest of them can be told apart from bold text, and the largest from the title.'),
                p('Then the anchor goes down, the engine stops, and the log gets its last line: time, place, depth, and the word ', i('finished'), '.')
            ])
        },
        short('Hold a heading', 'On choosing one bearing and steering it, even when a shorter line exists.', 'Craft', 1),
        short('The quarter knot you cannot see', 'Small currents, long passages, and why errors compound in silence.', 'Charts', 2),
        short('Writing the position before you trust it', 'A log entry is a promise made to the person you will be at four in the morning.', 'Craft', 3),
        short('Notes from a harbour with no chart', 'What to do when the survey is a century old and the sandbar is not.', 'Charts', 4),
        short('On paper charts, and a very long title that is here to show how a headline wraps across two or even three lines', 'Pencil, dividers and the pleasure of being wrong in a way you can erase.', 'Charts', 5),
        short('Mercator’s honest lie', 'Every projection keeps one truth and sells the rest.', 'Craft', 6),
        short('The lighthouse keeper’s grammar', 'Flashes, occultations and the oldest punctuation at sea.', 'Charts', 7, { visibility: 'members' }),
        short('What the pilot book leaves out', 'A paid post: the passage notes that never made the official edition.', 'Craft', 8, { visibility: 'paid' })
    ];
    for (const post of posts) { await call('POST', '/posts/', { posts: [post] }); }

    const about = (await call('GET', '/pages/slug/about/?fields=id,updated_at').catch(() => null))?.pages?.[0];
    const page = { title: 'About', slug: 'about', status: 'published', lexical: doc([
        p('Rhumb is a notebook about wayfinding: at sea, on foot and on the page. It is written slowly and published when there is something to report.'),
        p('The name comes from the rhumb line, the course of constant bearing. It is rarely the shortest route. It is the one you can steer.')
    ]) };
    if (about) { await call('PUT', `/pages/${about.id}/`, { pages: [{ ...page, updated_at: about.updated_at }] }); } else { await call('POST', '/pages/', { pages: [page] }); }
    console.log(`Seeded ${posts.length} posts and the About page.`);
};
run().catch(e => { console.error(e.message); process.exit(1); });
