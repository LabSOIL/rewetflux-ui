import { test, expect } from '@playwright/test';
import { MAP_CONTAINER, PANELS, SITE_3D, WINDOW_SIZES } from './selectors.js';
import { openSite, overlaps } from './support.js';

const layersButton = page => page.locator(PANELS.rail).getByRole('button', { name: /3D layers/ });

const open3D = async page => {
    await layersButton(page).click();
    await page.locator(SITE_3D.open).waitFor();
};

const crossSectionButton = page => page.locator(PANELS.rail).getByRole('button', { name: /Cross-section/ });

const openCut = async page => {
    await open3D(page);
    await crossSectionButton(page).click();
    await page.locator(SITE_3D.profile).waitFor();
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
    test(`the 3D view's panels do not overlap at ${size.width}x${size.height}, with the cross-section shown`, async ({ browser }) => {
        const page = await openSite(browser, size);
        await openCut(page);
        const boxes = await boxesOf(page, {
            rail: PANELS.rail,
            bottomBar: PANELS.bottomBar,
            logos: PANELS.logos,
            basemap: PANELS.basemap,
            card: SITE_3D.card,
            profile: SITE_3D.profile,
            nav: PANELS.zoom,
        });
        expect(Object.keys(boxes)).toHaveLength(7);
        expect(overlaps(boxes)).toEqual([]);
        await page.close();
    });
}

// The handles are placed by the scene's frame loop, so a drag's last move lands a frame or two later.
const centreOf = async locator => {
    await locator.page().evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
    const box = await locator.boundingBox();
    return [box.x + box.width / 2, box.y + box.height / 2];
};

const dragBy = async (page, locator, [dx, dy]) => {
    const [x, y] = await centreOf(locator);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 8 });
    await page.mouse.up();
};

test('the cross-section is off as the 3D view opens and the rail turns it on, with nothing for it in the card', async ({ browser }) => {
    const page = await openSite(browser, WINDOW_SIZES[0]);
    await open3D(page);
    await expect(crossSectionButton(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator(SITE_3D.profile)).toHaveCount(0);
    await expect(page.locator(SITE_3D.cutMove).first()).toBeHidden();

    await crossSectionButton(page).click();
    await expect(crossSectionButton(page)).toHaveAttribute('aria-pressed', 'true');
    await page.locator(SITE_3D.profile).waitFor();
    await expect(page.locator(SITE_3D.cutMove).first()).toBeVisible();

    const card = page.locator(SITE_3D.card);
    for (const text of ['Cross-section', 'Cut the layers too', 'Follow the view', 'Direction']) {
        await expect(card.getByText(text, { exact: true })).toHaveCount(0);
    }
    await expect(card.getByRole('slider', { name: /Cut/ })).toHaveCount(0);
    await page.close();
});

test('the 3D card holds the legend alone, and the rail holds the layer spacing as a vertical slider', async ({ browser }) => {
    const page = await openSite(browser, WINDOW_SIZES[0]);
    await open3D(page);
    const card = page.locator(SITE_3D.card);
    await expect(card.locator('input')).toHaveCount(0);
    await expect(card.locator(PANELS.legend)).toHaveCount(1);
    const spacing = page.locator(PANELS.rail).getByRole('slider', { name: 'Layer spacing' });
    await expect(spacing).toHaveAttribute('aria-orientation', 'vertical');
    await expect(page.locator(PANELS.basemap)).toBeVisible();
    await page.close();
});

test('the cross-section moves by either of its move handles, which stay put under the pointer', async ({ browser }) => {
    const page = await openSite(browser, WINDOW_SIZES[0]);
    await openCut(page);
    const handles = page.locator(SITE_3D.cutMove);
    await expect(handles).toHaveCount(2);
    const handle = handles.first();
    await expect(handle).toHaveCSS('cursor', 'grab');
    await expect(handle).toHaveAttribute('aria-valuenow', '0');
    const resting = await handle.boundingBox();
    await page.mouse.move(...(await centreOf(handle)));
    expect(await handle.boundingBox()).toEqual(resting);

    await dragBy(page, handle, [0, -60]);
    const pushed = Number(await handle.getAttribute('aria-valuenow'));
    expect(pushed).toBeGreaterThan(0);
    await expect(handles.last()).toHaveAttribute('aria-valuenow', String(pushed));

    await handles.last().press('ArrowDown');
    await expect(handle).toHaveAttribute('aria-valuenow', String(pushed - 5));
    await page.close();
});

test('the cross-section turns by the handles at its ends, snapping to 15 degrees with Shift', async ({ browser }) => {
    const page = await openSite(browser, WINDOW_SIZES[0]);
    await openCut(page);
    const handles = page.locator(SITE_3D.cutTurn);
    await expect(handles).toHaveCount(2);
    const handle = handles.first();
    const opening = Number(await handle.getAttribute('aria-valuenow'));

    await dragBy(page, handle, [0, 80]);
    const turned = Number(await handle.getAttribute('aria-valuenow'));
    expect(turned).not.toBe(opening);
    await expect(handles.last()).toHaveAttribute('aria-valuenow', String(turned));

    await page.keyboard.down('Shift');
    await dragBy(page, handles.last(), [0, -50]);
    await page.keyboard.up('Shift');
    expect(Number(await handle.getAttribute('aria-valuenow')) % 15).toBe(0);

    const snapped = Number(await handle.getAttribute('aria-valuenow'));
    await handle.press('ArrowRight');
    await expect(handle).toHaveAttribute('aria-valuenow', String((snapped + 5) % 360));
    await page.close();
});

// The compass needle's turn and tilt, in radians, as its transform sets them.
const needleOf = async page => {
    const transform = await page.locator(`${PANELS.zoom} .view-controls-reset svg`).evaluate(el => el.style.transform);
    const [, tilt = '0'] = transform.match(/rotateX\(([-\d.e]+)rad\)/) ?? [];
    const [, turn = '0'] = transform.match(/rotateZ\(([-\d.e]+)rad\)/) ?? [];
    return { tilt: Number(tilt), turn: Number(turn) };
};

test('Reset view turns the 3D view back north up at its opening tilt, from the controls the map uses', async ({ browser }) => {
    const page = await openSite(browser, WINDOW_SIZES[0]);
    const inMap = await page.locator(PANELS.zoom).boundingBox();
    await open3D(page);
    expect(await page.locator(PANELS.zoom).boundingBox()).toEqual(inMap);
    const opening = await needleOf(page);

    await page.locator(SITE_3D.canvas).focus();
    for (let k = 0; k < 12; k++) await page.keyboard.press('Shift+ArrowLeft');
    for (let k = 0; k < 4; k++) await page.keyboard.press('Shift+ArrowUp');
    const turned = await needleOf(page);
    expect(Math.abs(turned.turn - opening.turn)).toBeGreaterThan(0.5);

    await page.locator(PANELS.zoom).getByRole('button', { name: 'Reset view' }).click();
    await expect.poll(async () => Math.abs((await needleOf(page)).turn), { timeout: 3000 }).toBeLessThan(0.01);
    expect(Math.abs((await needleOf(page)).tilt - opening.tilt)).toBeLessThan(0.05);
    await page.close();
});

test('the 3D layers draw over the map, and turning them off hands back to the map', async ({ browser }) => {
    const page = await openSite(browser, WINDOW_SIZES[0]);
    await open3D(page);
    const canvas = await page.locator(SITE_3D.canvas).boundingBox();
    const map = await page.locator(MAP_CONTAINER).boundingBox();
    for (const side of ['x', 'y', 'width', 'height']) expect(Math.abs(canvas[side] - map[side]), side).toBeLessThan(1);
    await expect(page.locator(MAP_CONTAINER)).toHaveCSS('opacity', '0');

    await layersButton(page).click();
    await page.locator(SITE_3D.root).waitFor({ state: 'detached' });
    await expect(page.locator(MAP_CONTAINER)).toHaveCSS('opacity', '1');
    await page.close();
});

test('the site opens on the 2D map, on the aerial basemap', async ({ browser }) => {
    const page = await openSite(browser, WINDOW_SIZES[0]);
    await expect(page.locator(SITE_3D.root)).toHaveCount(0);
    await expect(page.locator(PANELS.basemap)).toHaveText('Topo');
    await expect(page.locator(PANELS.card).getByText(/3D/)).toHaveCount(0);
    await page.close();
});

test('the rail\'s 3D layers button opens the 3D view and closes it again', async ({ browser }) => {
    const page = await openSite(browser, WINDOW_SIZES[0]);
    const button = page.locator(PANELS.rail).getByRole('button', { name: /3D layers/ });
    await button.click();
    await page.locator(SITE_3D.open).waitFor();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await button.click();
    await page.locator(SITE_3D.root).waitFor({ state: 'detached' });
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await page.close();
});
