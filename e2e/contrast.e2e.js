import { test, expect } from '@playwright/test';
import { RAIL_POPUPS, WINDOW_SIZES } from './selectors.js';
import { TILE_COLOUR, measureContrast, openSite, withPopup } from './support.js';

test('visible text meets WCAG AA against its composed background', async ({ browser }) => {
    const page = await openSite(browser, WINDOW_SIZES[0]);
    const rows = await page.evaluate(measureContrast, TILE_COLOUR);
    for (const label of RAIL_POPUPS) {
        rows.push(...(await withPopup(page, label, () => page.evaluate(measureContrast, TILE_COLOUR))));
    }
    const failing = rows
        .filter(r => r.ratio < r.need)
        .map(r => `${r.ratio} < ${r.need} ${r.size}px ${JSON.stringify(r.text)} fg ${r.fg}`);
    expect([...new Set(failing)]).toEqual([]);
    expect(rows.length).toBeGreaterThan(0);
    await page.close();
});
