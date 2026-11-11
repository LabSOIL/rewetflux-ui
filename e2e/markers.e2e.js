import { test, expect } from '@playwright/test';
import { MARKERS, MARKER_COVERS, PANELS, WINDOW_SIZES } from './selectors.js';
import { openSite } from './support.js';

const meets = (a, b) =>
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 0 &&
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 0;

// Boxes of the point markers (not the larger area outlines).
async function markerBoxes(page) {
    const boxes = [];
    for (const marker of await page.locator(MARKERS).all()) {
        const box = await marker.boundingBox();
        if (box && box.width < 60 && box.height < 60) boxes.push(box);
    }
    return boxes;
}

for (const size of WINDOW_SIZES) {
    test(`no position marker opens under a panel at ${size.width}x${size.height}`, async ({ browser }) => {
        const page = await openSite(browser, size);
        // The opening view settles once the markers have stopped moving.
        let previous = '';
        await expect
            .poll(async () => {
                const now = JSON.stringify(await markerBoxes(page));
                const settled = now !== '[]' && now === previous;
                previous = now;
                return settled;
            })
            .toBe(true);
        const boxes = await markerBoxes(page);
        const under = [];
        for (const name of MARKER_COVERS) {
            for (const panel of await page.locator(PANELS[name]).all()) {
                const box = await panel.boundingBox();
                if (!box) continue;
                for (const m of boxes) if (meets(m, box)) under.push(`marker at ${m.x.toFixed(0)},${m.y.toFixed(0)} under ${name}`);
            }
        }
        expect(under).toEqual([]);
        await page.close();
    });
}
