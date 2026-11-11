import { test, expect } from '@playwright/test';
import { DEPTH_GAUGE, LOGO_IMAGES, PANELS, RAIL_POPUPS, WINDOW_SIZES } from './selectors.js';
import { openSite, overlaps, panelBoxes, withPopup } from './support.js';

for (const size of WINDOW_SIZES.slice(0, 2)) {
    const name = `${size.width}x${size.height}`;

    test(`no panels overlap at ${name}, closed and with each popup open`, async ({ browser }) => {
        const page = await openSite(browser, size);
        expect(overlaps(await panelBoxes(page))).toEqual([]);
        for (const label of RAIL_POPUPS) {
            await withPopup(page, label, async () => {
                expect(overlaps(await panelBoxes(page)), `${label} open`).toEqual([]);
            });
        }
        await page.close();
    });
}

test('the depth gauge sits inside the rail', async ({ browser }) => {
    const page = await openSite(browser, WINDOW_SIZES[0]);
    await page.locator(PANELS.rail + ' button', { hasText: 'Variable' }).first().click();
    const gauge = page.locator(DEPTH_GAUGE).first();
    await gauge.waitFor();
    const rail = await page.locator(PANELS.rail).boundingBox();
    const box = await gauge.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(rail.x - 1);
    expect(box.y).toBeGreaterThanOrEqual(rail.y - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(rail.x + rail.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(rail.y + rail.height + 1);
    await page.close();
});

test('every partner logo has a box', async ({ browser }) => {
    const page = await openSite(browser, WINDOW_SIZES[0]);
    const logos = page.locator(LOGO_IMAGES);
    expect(await logos.count()).toBe(3);
    for (const logo of await logos.all()) {
        const box = await logo.boundingBox();
        expect(box?.width, await logo.getAttribute('alt')).toBeGreaterThan(0);
        expect(box?.height, await logo.getAttribute('alt')).toBeGreaterThan(0);
    }
    await page.close();
});
