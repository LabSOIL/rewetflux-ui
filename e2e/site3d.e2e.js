import { test, expect } from '@playwright/test';
import { MAP_CONTAINER, PANELS, SITE_3D, WINDOW_SIZES } from './selectors.js';
import { openSite, overlaps } from './support.js';

const REDOX_LAYERS = 'Redox layers (3D)';

const open3D = async page => {
    await page.locator(PANELS.card).getByLabel(REDOX_LAYERS).check();
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

test('ticking the redox layers draws them in 3D over the map, and unticking them hands back to the map', async ({ browser }) => {
    const page = await openSite(browser, WINDOW_SIZES[0]);
    await open3D(page);
    const canvas = await page.locator(SITE_3D.canvas).boundingBox();
    const map = await page.locator(MAP_CONTAINER).boundingBox();
    for (const side of ['x', 'y', 'width', 'height']) expect(Math.abs(canvas[side] - map[side]), side).toBeLessThan(1);
    await expect(page.locator(MAP_CONTAINER)).toHaveCSS('opacity', '0');

    await page.locator(SITE_3D.card).getByLabel(REDOX_LAYERS).uncheck();
    await page.locator(SITE_3D.root).waitFor({ state: 'detached' });
    await expect(page.locator(MAP_CONTAINER)).toHaveCSS('opacity', '1');
    await page.close();
});

test('the site opens on the 2D map, on the aerial basemap', async ({ browser }) => {
    const page = await openSite(browser, WINDOW_SIZES[0]);
    await expect(page.locator(SITE_3D.root)).toHaveCount(0);
    await expect(page.locator(PANELS.card).getByLabel('Aerial')).toBeChecked();
    await page.close();
});

test('the rail\'s 3D layers button opens the 3D view and closes it again', async ({ browser }) => {
    const page = await openSite(browser, WINDOW_SIZES[0]);
    const button = page.locator(PANELS.rail).getByRole('button', { name: /3D layers/ });
    await button.click();
    await page.locator(SITE_3D.hint).waitFor();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await button.click();
    await page.locator(SITE_3D.root).waitFor({ state: 'detached' });
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await page.close();
});
