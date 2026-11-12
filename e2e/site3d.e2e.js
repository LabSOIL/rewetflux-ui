import { test, expect } from '@playwright/test';
import { MAP_CONTAINER, PANELS, SITE_3D, TILE_URL, WINDOW_SIZES } from './selectors.js';
import { TILE_COLOUR, flatTile, openSite, overlaps } from './support.js';

const open3D = async page => {
    await page.locator(PANELS.card).getByRole('radio', { name: '3D' }).click();
    await page.locator(SITE_3D.hint).waitFor();
};

const boxesOf = async (page, selectors) => {
    const out = {};
    for (const [name, selector] of Object.entries(selectors)) {
        const box = await page.locator(selector).first().boundingBox();
        if (box && box.width > 0 && box.height > 0) out[name] = box;
    }
    return out;
};

for (const size of WINDOW_SIZES.slice(0, 2)) {
    test(`the 3D view's panels do not overlap at ${size.width}x${size.height}, with the cross-section on`, async ({ browser }) => {
        const page = await openSite(browser, size);
        await open3D(page);
        await page.locator(SITE_3D.card).getByText('Cross-section').click();
        await page.locator(SITE_3D.profile).waitFor();
        const boxes = await boxesOf(page, {
            rail: PANELS.rail,
            bottomBar: PANELS.bottomBar,
            logos: PANELS.logos,
            card: SITE_3D.card,
            hint: SITE_3D.hint,
            profile: SITE_3D.profile,
            nav: SITE_3D.nav,
        });
        expect(Object.keys(boxes)).toHaveLength(7);
        expect(overlaps(boxes)).toEqual([]);
        await page.close();
    });
}

test('the 3D view draws the scene over the map and hands back to the map', async ({ browser }) => {
    const page = await openSite(browser, WINDOW_SIZES[0]);
    await open3D(page);
    const canvas = await page.locator(SITE_3D.canvas).boundingBox();
    const map = await page.locator(MAP_CONTAINER).boundingBox();
    for (const side of ['x', 'y', 'width', 'height']) expect(Math.abs(canvas[side] - map[side]), side).toBeLessThan(1);
    await expect(page.locator(MAP_CONTAINER)).toHaveCSS('opacity', '0');

    await page.locator(SITE_3D.card).getByRole('radio', { name: '2D' }).click();
    await page.locator(SITE_3D.root).waitFor({ state: 'detached' });
    await expect(page.locator(MAP_CONTAINER)).toHaveCSS('opacity', '1');
    await page.close();
});

const scrollOutTo2D = async page => {
    const map = await page.locator(MAP_CONTAINER).boundingBox();
    await page.mouse.move(map.x + map.width / 2, map.y + map.height / 2);
    for (let i = 0; i < 12 && (await page.locator(SITE_3D.root).count()); i++) {
        await page.mouse.wheel(0, 100);
        await page.waitForTimeout(150);
    }
    await page.locator(SITE_3D.root).waitFor({ state: 'detached' });
    await expect(page.locator(MAP_CONTAINER)).toHaveCSS('opacity', '1');
};

test('the site opens in 3D, and zooming out hands it to the map', async ({ browser }) => {
    const page = await browser.newPage({ viewport: WINDOW_SIZES[0] });
    await page.route(TILE_URL, route => route.fulfill({ contentType: 'image/png', body: flatTile(TILE_COLOUR) }));
    await page.goto('/');
    await page.locator(SITE_3D.hint).waitFor();
    await expect(page.locator(MAP_CONTAINER)).toHaveCSS('opacity', '0');
    await scrollOutTo2D(page);
    await page.close();
});

test('scrolling in on the site carries the map on into 3D, and scrolling out hands it back', async ({ browser }) => {
    const page = await openSite(browser, WINDOW_SIZES[0]);
    const map = await page.locator(MAP_CONTAINER).boundingBox();
    await page.mouse.move(map.x + map.width / 2, map.y + map.height / 2);
    for (let i = 0; i < 4 && !(await page.locator(SITE_3D.root).count()); i++) {
        await page.mouse.wheel(0, -100);
        await page.waitForTimeout(400);
    }
    await page.locator(SITE_3D.hint).waitFor();
    await expect(page.locator(MAP_CONTAINER)).toHaveCSS('opacity', '0');
    await scrollOutTo2D(page);
    await page.close();
});

test('right-dragging up on the map tilts it into 3D', async ({ browser }) => {
    const page = await openSite(browser, WINDOW_SIZES[0]);
    const map = await page.locator(MAP_CONTAINER).boundingBox();
    await page.mouse.move(map.x + map.width / 2, map.y + map.height / 2);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(map.x + map.width / 2, map.y + map.height / 2 - 80, { steps: 8 });
    await page.mouse.up({ button: 'right' });
    await page.locator(SITE_3D.hint).waitFor();
    await page.close();
});
