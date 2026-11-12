import { deflateSync } from 'node:zlib';
import { MAP_CONTAINER, PANELS, RAIL_BUTTONS, TILE_URL } from './selectors.js';

export const TILE_COLOUR = [232, 232, 232];

const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
});

function crc32(buf) {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), body.length + 4);
    return out;
}

/** A 256x256 PNG of one flat colour. */
export function flatTile([r, g, b]) {
    const size = 256;
    const header = Buffer.alloc(13);
    header.writeUInt32BE(size, 0);
    header.writeUInt32BE(size, 4);
    header.set([8, 2, 0, 0, 0], 8);
    const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array(size).fill([r, g, b]).flat())]);
    const raw = Buffer.concat(Array(size).fill(row));
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', header),
        chunk('IDAT', deflateSync(raw)),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}

/** Opens the site at `size` with every tile request answered by the flat tile. */
export async function openSite(browser, size) {
    const page = await browser.newPage({ viewport: size });
    const tile = flatTile(TILE_COLOUR);
    await page.route(TILE_URL, route => route.fulfill({ contentType: 'image/png', body: tile }));
    await page.goto('/?view=2d');
    await page.waitForSelector(MAP_CONTAINER);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector(PANELS.rail);
    // Measurements must not catch a colour or position part-way through a transition.
    await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' });
    return page;
}

/** Opens the rail popup behind `label`, runs `fn`, closes it again. */
export async function withPopup(page, label, fn) {
    const button = page.locator(RAIL_BUTTONS, { hasText: label }).first();
    await button.click();
    await page.locator(PANELS.popup).first().waitFor();
    try {
        return await fn();
    } finally {
        await button.click();
    }
}

/** The boxes of the visible, non-empty panels, keyed by name (and index when several). */
export async function panelBoxes(page) {
    const out = {};
    for (const [name, selector] of Object.entries(PANELS)) {
        const handles = await page.locator(selector).elementHandles();
        for (const [i, el] of handles.entries()) {
            if (!(await el.isVisible())) continue;
            const box = await el.boundingBox();
            if (box && box.width > 0 && box.height > 0) out[`${name}${i || ''}`] = box;
        }
    }
    return out;
}

const inside = (a, b) =>
    a.x >= b.x - 1 && a.y >= b.y - 1 && a.x + a.width <= b.x + b.width + 1 && a.y + a.height <= b.y + b.height + 1;

/** Pairs of different panels whose boxes overlap, one not wholly inside the other. */
export function overlaps(boxes) {
    const entries = Object.entries(boxes);
    const hits = [];
    for (const [i, [a, p]] of entries.entries()) {
        for (const [b, q] of entries.slice(i + 1)) {
            if (a.replace(/\d+$/, '') === b.replace(/\d+$/, '')) continue;
            const w = Math.min(p.x + p.width, q.x + q.width) - Math.max(p.x, q.x);
            const h = Math.min(p.y + p.height, q.y + q.height) - Math.max(p.y, q.y);
            if (w > 1 && h > 1 && !inside(p, q) && !inside(q, p)) hits.push(`${a} x ${b} (${w.toFixed(0)}x${h.toFixed(0)}px)`);
        }
    }
    return hits;
}

/** Runs in the page: the WCAG contrast of each visible text node against its composed background. */
export function measureContrast(tile) {
    const parse = c => {
        const m = c.match(/rgba?\(([^)]+)\)/);
        if (!m) return null;
        const p = m[1].split(',').map(Number);
        return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
    };
    const lum = ([r, g, b]) => {
        const f = v => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const over = (top, a, base) => top.map((v, i) => v * a + base[i] * (1 - a));
    const background = el => {
        const chain = [];
        for (let e = el; e && e.nodeType === 1; e = e.parentElement) chain.unshift(e);
        let bg = tile;
        for (const e of chain) {
            const cs = getComputedStyle(e);
            if (e.classList.contains('leaflet-container')) bg = tile;
            const c = parse(cs.backgroundColor);
            const op = parseFloat(cs.opacity);
            if (c && c[3] > 0) bg = over(c.slice(0, 3), c[3] * op, bg);
            else if (op < 1) bg = over(bg, op, tile);
        }
        return bg;
    };
    const out = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    while (walker.nextNode()) {
        const el = walker.currentNode.parentElement;
        const text = walker.currentNode.textContent.trim();
        if (!text || seen.has(el)) continue;
        seen.add(el);
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none') continue;
        let op = 1;
        for (let e = el; e; e = e.parentElement) op *= parseFloat(getComputedStyle(e).opacity);
        const fg0 = parse(cs.color);
        const bg = background(el);
        const fg = over(fg0.slice(0, 3), fg0[3] * op, bg);
        const [a, b] = [lum(fg), lum(bg)];
        const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        const size = parseFloat(cs.fontSize);
        const bold = parseInt(cs.fontWeight) >= 700;
        const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
        out.push({ text: text.slice(0, 28), ratio: Math.round(ratio * 100) / 100, need, size, fg: cs.color });
    }
    return out;
}
