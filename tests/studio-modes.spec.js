import { test, expect } from './support/fixtures.js';
import {
  WALL_BORDER,
  downloadFrom,
  dragBy,
  dragHandle,
  getItem,
  getItems,
  historyState,
  itemLocator,
  loadLayout,
  selectedIds,
  selectItemById,
  setWallSize,
  wallItem,
} from './support/planner.js';

const SCALE = 2.5;
const shell = (page) => page.locator('body.app-shell');
const engineerBtn = (page) => page.locator('#mode-engineer-btn');
const creatorBtn = (page) => page.locator('#mode-creator-btn');
const backdrop = (page) => page.locator('#floor-backdrop');
const options = (page) => page.locator('#command-list [role="option"]');
const optionLabels = (page) => page.locator('#command-list [role="option"] .command-label').allTextContents();
const hintFor = (page, label) => options(page).filter({ hasText: label }).locator('.command-hint');

// Everything Creator Mode tucks away, given a selected item, one reference guide and the cable runs on
const TECHNICAL_UI = [
  '#ruler-x',
  '#ruler-y',
  '#ruler-corner',
  '.wall-guide',
  '.guide-hit',
  '#power-routes',
  '#power-routing-toggle',
  '#layers-panel',
  '.catalog-item[data-type="socket"]',
  '.catalog-item[data-type="note"]',
  '#edit-left-cm',
  '#edit-top-cm',
  '#edit-width-cm',
  '#edit-height-cm',
  '#inspector-pos-readout',
];

// The everyday controls that stay in both modes
const FRIENDLY_UI = [
  '#center-wall-h-btn',
  '#center-wall-v-btn',
  '.btn-finish[data-finish="white"]',
  '#led-toggle-btn',
  '#item-led-color',
  '#rotate-item-btn',
  '#mirror-wall-btn',
  '#lock-toggle-btn',
  '#duplicate-item-btn',
  '#delete-item-btn',
  '.catalog-item[data-type="poster"]',
  '#backdrop-bed-btn',
];

async function openPalette(page) {
  await page.keyboard.press('Control+k');
  await expect(page.locator('#command-palette')).toHaveAttribute('open', '');
}

async function runCommand(page, query) {
  await openPalette(page);
  await page.keyboard.type(query);
  await page.keyboard.press('Enter');
  await expect(page.locator('#command-palette')).not.toHaveAttribute('open');
}

async function expectMode(page, mode) {
  await expect(shell(page)).toHaveAttribute('data-studio-mode', mode);
  await expect(engineerBtn(page)).toHaveAttribute('aria-pressed', String(mode === 'engineer'));
  await expect(creatorBtn(page)).toHaveAttribute('aria-pressed', String(mode === 'creator'));
}

test.describe('studio modes', () => {
  test('the planner opens in Engineer Mode with a segmented switch outside the Inspector', async ({ page }) => {
    await expectMode(page, 'engineer');
    expect(await page.evaluate(() => studioMode)).toBe('engineer');
    await expect(page.locator('.sidebar.inspector > .studio-mode')).toHaveAttribute('role', 'group');
    await expect(page.locator('.studio-mode')).toHaveAccessibleName('Workspace mode');
    await expect(page.locator('.inspector-content .studio-mode-btn')).toHaveCount(0);
    await expect(page.locator('.studio-mode [role="switch"]')).toHaveCount(0);
    await expect(engineerBtn(page)).toHaveText('Engineer');
    await expect(creatorBtn(page)).toHaveText('Creator');

    for (const selector of ['#ruler-x', '#ruler-y', '#layers-panel', '#power-routing-toggle']) {
      await expect(page.locator(selector)).toBeVisible();
    }
    await expect(page.locator('.catalog-features .catalog-item')).toHaveCount(5);
  });

  test('Creator hides the technical tools, keeps the friendly ones and Engineer brings it all back untouched', async ({
    page,
  }) => {
    await loadLayout(page, {
      wallGuides: [{ axis: 'x', cm: 200 }],
      items: [
        wallItem('item-a', 'cube', 100, 100),
        wallItem('item-p', 'poster', 450, 50),
        wallItem('item-s', 'socket', 300, 500),
      ],
    });
    await page.click('#power-routing-toggle');
    await selectItemById(page, 'item-a');
    const layout = await page.evaluate(() => JSON.stringify(layoutPayload()));
    const before = await historyState(page);
    for (const selector of TECHNICAL_UI) await expect(page.locator(selector)).toBeVisible();

    await creatorBtn(page).click();
    await expectMode(page, 'creator');
    for (const selector of TECHNICAL_UI) await expect(page.locator(selector)).toBeHidden();
    for (const selector of FRIENDLY_UI) await expect(page.locator(selector)).toBeVisible();
    await expect(page.locator('.catalog-item:visible')).toHaveCount(7);
    // Room features already on the wall stay in view: only the catalog group is tucked away
    await expect(itemLocator(page, 'item-s')).toBeVisible();

    // Switching is a view change, never a layout edit
    expect(await historyState(page)).toEqual(before);
    expect(await page.evaluate(() => JSON.stringify(layoutPayload()))).toBe(layout);

    await engineerBtn(page).click();
    await expectMode(page, 'engineer');
    for (const selector of TECHNICAL_UI) await expect(page.locator(selector)).toBeVisible();
    await expect(page.locator('#power-routing-toggle')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('.power-route')).toHaveCount(2);
    await expect(page.locator('#edit-left-cm')).toHaveValue('40');
    await expect(page.locator('#inspector-pos-readout')).toHaveText('40 cm (X), 40 cm (Y)');
    expect(await selectedIds(page)).toEqual(['item-a']);
  });

  test('Center H, finishes, LED controls and Rotate keep working in Creator Mode', async ({ page }) => {
    await loadLayout(page, { items: [wallItem('item-a', 'cube', 100, 100)] });
    await creatorBtn(page).click();
    await selectItemById(page, 'item-a');
    const before = await historyState(page);

    await page.click('#center-wall-h-btn');
    expect(await getItem(page, 'item-a')).toMatchObject({ left: 132 * SCALE, top: 100 });

    await page.click('.btn-finish[data-finish="white"]');
    expect(await getItem(page, 'item-a')).toMatchObject({ finish: 'white' });
    await expect(itemLocator(page, 'item-a')).toContainClass('finish-white');

    await page.click('#led-toggle-btn');
    expect(await getItem(page, 'item-a')).toMatchObject({ ledEnabled: false });
    await expect(page.locator('#led-toggle-btn')).toHaveAttribute('aria-checked', 'false');

    await page.locator('#item-led-color').fill('#22d3ee');
    expect(await getItem(page, 'item-a')).toMatchObject({ itemLedColor: '#22d3ee' });
    await expect(page.locator('#item-led-hex')).toHaveText('#22D3EE');

    await page.click('#rotate-item-btn');
    expect(await getItem(page, 'item-a')).toMatchObject({ rotation: 90 });
    expect((await historyState(page)).index).toBe(before.index + 5);

    // Every rebuild of the panel keeps the raw fields out of Creator Mode
    for (const selector of ['#edit-left-cm', '#edit-width-cm', '#inspector-pos-readout']) {
      await expect(page.locator(selector)).toBeHidden();
    }

    await engineerBtn(page).click();
    await expect(page.locator('#edit-left-cm')).toHaveValue('132');
    await expect(page.locator('#inspector-pos-readout')).toHaveText('132 cm (X), 40 cm (Y)');
  });

  test('the command palette and Alt+M switch modes, but never from a field or behind a dialog', async ({ page }) => {
    await openPalette(page);
    await page.keyboard.type('creator mode');
    expect(await optionLabels(page)).toEqual(['View: Switch to Creator Mode']);
    await expect(hintFor(page, 'View: Switch to Creator Mode')).toHaveText('Alt+M');
    await page.keyboard.press('Enter');
    await expectMode(page, 'creator');

    // In Creator Mode the palette drops the room features and the drafting overlays as well
    await openPalette(page);
    const labels = await optionLabels(page);
    expect(labels.filter((label) => label.startsWith('Mount: '))).toEqual([
      'Mount: Floating Shelf',
      'Mount: Modular Cube',
      'Mount: Compact Storage',
      'Mount: Poster Frame',
      'Mount: Mini Spotlight',
      'Mount: Corner Floor Lamp',
      'Mount: Lumen Lightbar 60cm',
    ]);
    expect(labels).not.toContain('Toggle Power Routing Overlay');
    expect(labels).not.toContain('Clear Reference Guides');
    await expect(page.locator('.command-group-label')).toHaveText([
      'Mount',
      'Wall & View',
      'Lighting & Paint',
      'Project & Export',
    ]);
    await expect(hintFor(page, 'View: Switch to Creator Mode')).toHaveText('Current');
    await page.fill('#command-search-input', 'engineer mode');
    await page.keyboard.press('Enter');
    await expectMode(page, 'engineer');

    await page.keyboard.press('Alt+m');
    await expectMode(page, 'creator');
    await page.keyboard.press('Alt+m');
    await expectMode(page, 'engineer');

    await page.focus('#wall-width-input');
    await page.keyboard.press('Alt+m');
    await expectMode(page, 'engineer');
    await page.evaluate(() => document.activeElement.blur());

    await page.keyboard.press('?');
    await expect(page.locator('#shortcuts-modal')).toHaveAttribute('open', '');
    await page.keyboard.press('Alt+m');
    await expectMode(page, 'engineer');
    await expect(page.locator('#shortcuts-modal .shortcut-table tbody tr')).toHaveCount(10);
    await expect(page.locator('#shortcuts-modal .shortcut-note')).toContainText('Alt + M');
  });

  test('hidden rulers pull out no guides, and hidden guides stop pulling items', async ({ page }) => {
    // A cube whose left edge stops 1 cm short of the 101 cm guide snaps onto it in Engineer Mode only
    await loadLayout(page, { wallGuides: [{ axis: 'x', cm: 101 }], items: [wallItem('item-a', 'cube', 100, 100)] });
    await creatorBtn(page).click();

    const band = await page.evaluate(() => ({ ...rulerBands.top }));
    const x = (band.left + band.right) / 2;
    const y = (band.top + band.bottom) / 2;
    await page.mouse.move(x, y);
    await expect(page.locator('.canvas-area')).toHaveAttribute('data-ruler-hover', '');
    await page.mouse.down();
    await page.mouse.move(x, y + 120, { steps: 6 });
    await page.mouse.up();
    expect(await page.evaluate(() => wallGuides.map(({ axis, cm }) => [axis, cm]))).toEqual([['x', 101]]);

    await dragBy(page, 'item-a', 150, 0);
    expect(await getItem(page, 'item-a')).toMatchObject({ left: 250 });

    await engineerBtn(page).click();
    await dragBy(page, 'item-a', -150, 0);
    await dragBy(page, 'item-a', 150, 0);
    expect(await getItem(page, 'item-a')).toMatchObject({ left: 101 * SCALE });
  });
});

// Geometry in wall px, measured from the wall's content box at whatever fit the wall is shown
const backdropGeometry = (page) =>
  page.evaluate((border) => {
    const wall = wallCanvas.getBoundingClientRect();
    const box = document.getElementById('floor-backdrop').getBoundingClientRect();
    return {
      width: box.width / viewScale,
      height: box.height / viewScale,
      centerOffset: ((box.left + box.right) / 2 - wall.left) / viewScale - border - wallWidthPx / 2,
      floorGap: wallHeightPx - ((box.bottom - wall.top) / viewScale - border),
    };
  }, WALL_BORDER);

async function expectStandingOnFloor(page, widthCm, heightCm) {
  const geometry = await backdropGeometry(page);
  expect(Math.abs(geometry.width - widthCm * SCALE)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(geometry.height - heightCm * SCALE)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(geometry.centerOffset)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(geometry.floorGap)).toBeLessThanOrEqual(0.5);
}

test.describe('floor reference silhouettes', () => {
  test('a bed or a desk stands centered on the floor line, lets presses through and follows the wall size', async ({
    page,
  }) => {
    await loadLayout(page, { items: [wallItem('item-low', 'cube', 330, 520)] });
    await expect(backdrop(page)).toBeHidden();
    await expect(page.locator('#backdrop-none-btn')).toHaveAttribute('aria-pressed', 'true');
    const before = await historyState(page);

    await page.click('#backdrop-bed-btn');
    await expect(page.locator('#backdrop-bed-btn')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#backdrop-none-btn')).toHaveAttribute('aria-pressed', 'false');
    await expect(backdrop(page)).toBeVisible();
    await expect(backdrop(page)).toHaveAttribute('data-kind', 'bed');
    await expect(backdrop(page)).toHaveCSS('pointer-events', 'none');
    await expect(page.locator('.floor-backdrop-tag')).toHaveText('Bed 155 x 85 cm');
    await expectStandingOnFloor(page, 155, 85);

    // The cube sits behind the headboard outline, and a press still reaches it
    await page.click('.wall-item[data-id="item-low"]');
    expect(await selectedIds(page)).toEqual(['item-low']);

    await page.click('#backdrop-desk-btn');
    await expect(backdrop(page)).toHaveAttribute('data-kind', 'desk');
    await expect(page.locator('#backdrop-bed-btn')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.floor-backdrop-tag')).toHaveText('Desk 140 x 115 cm');
    await expectStandingOnFloor(page, 140, 115);

    // A view aid only: no undo step and nothing in the saved or exported layout
    expect(await historyState(page)).toEqual(before);
    const payload = await page.evaluate(() => JSON.stringify(layoutPayload()));
    expect(payload).not.toMatch(/backdrop|desk/i);

    await setWallSize(page, { width: 200, height: 180 });
    await expectStandingOnFloor(page, 140, 115);
    await setWallSize(page, { width: 400, height: 300 });
    expect(await page.evaluate(() => viewScale)).toBeLessThan(1);
    await expectStandingOnFloor(page, 140, 115);

    await page.click('#backdrop-none-btn');
    await expect(backdrop(page)).toBeHidden();
    await expect(backdrop(page)).toBeEmpty();

    await page.click('#backdrop-bed-btn');
    await page.reload();
    await expect(backdrop(page)).toBeHidden();
    await expect(page.locator('#backdrop-none-btn')).toHaveAttribute('aria-pressed', 'true');
  });

  test('the palette picks each backdrop, and the PNG export is identical with or without one', async ({ page }) => {
    await loadLayout(page, {
      items: [wallItem('item-p', 'poster', 450, 50), wallItem('item-shelf', 'shelf', 200, 450)],
    });
    const plain = await downloadFrom(page, '#export-png-btn');

    await runCommand(page, 'backdrop bed');
    await expect(backdrop(page)).toHaveAttribute('data-kind', 'bed');
    await expect(page.locator('#backdrop-bed-btn')).toHaveAttribute('aria-pressed', 'true');
    const withBed = await downloadFrom(page, '#export-png-btn');
    expect(withBed.buffer.equals(plain.buffer)).toBe(true);

    await openPalette(page);
    await page.keyboard.type('backdrop');
    expect(await optionLabels(page)).toEqual([
      'Backdrop: None',
      'Backdrop: Bed (155 cm)',
      'Backdrop: Desk (140 cm)',
      'Backdrop: Sofa (200 cm)',
      'Backdrop Align: Left',
      'Backdrop Align: Center',
      'Backdrop Align: Right',
    ]);
    await expect(hintFor(page, 'Backdrop: Bed (155 cm)')).toHaveText('Current');
    await page.keyboard.press('Escape');

    await runCommand(page, 'backdrop desk');
    await expect(backdrop(page)).toHaveAttribute('data-kind', 'desk');
    const withDesk = await downloadFrom(page, '#export-png-btn');
    expect(withDesk.buffer.equals(plain.buffer)).toBe(true);

    await runCommand(page, 'backdrop none');
    await expect(backdrop(page)).toBeHidden();
    await expect(page.locator('#backdrop-none-btn')).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('small-item grips', () => {
  test('a freshly mounted, selected 8 x 8 cm socket moves from a center drag and keeps its size', async ({ page }) => {
    // Sockets mount beneath furniture, so the wall is cleared first: one low shelf puts the cascade at 220, 240 px
    await loadLayout(page, { items: [wallItem('item-shelf', 'shelf', 100, 500)] });
    await page.click('.catalog-item[data-type="socket"]');
    const socket = (await getItems(page)).find((item) => item.type === 'socket');
    expect(socket).toMatchObject({ left: 220, top: 240, width: 20, height: 20 });
    expect(await selectedIds(page)).toEqual([socket.id]);

    const el = itemLocator(page, socket.id);
    await expect(el).toContainClass('is-tiny');
    await expect(el.locator('.resize-handle')).toHaveCount(3);
    const face = await el.boundingBox();
    for (const handle of await el.locator('.resize-handle').all()) {
      await expect(handle).toBeVisible();
      const box = await handle.boundingBox();
      expect(box.x >= face.x + face.width || box.y >= face.y + face.height).toBe(true);
    }

    // The center and the corner of the face both hit the socket itself, never one of its grips
    const hits = await page.evaluate(
      (points) => points.map(([x, y]) => document.elementFromPoint(x, y).dataset.id ?? null),
      [
        [face.x + face.width / 2, face.y + face.height / 2],
        [face.x + face.width - 2, face.y + face.height - 2],
      ],
    );
    expect(hits).toEqual([socket.id, socket.id]);

    const before = await historyState(page);
    await dragBy(page, socket.id, 100, 60);
    expect(await getItem(page, socket.id)).toMatchObject({ left: 320, top: 300, width: 20, height: 20 });
    expect(await selectedIds(page)).toEqual([socket.id]);
    expect((await historyState(page)).index).toBe(before.index + 1);

    // Sizing still works from the Inspector, and from the grips that now sit outside the face
    await page.fill('#edit-width-cm', '12');
    await page.press('#edit-width-cm', 'Enter');
    expect(await getItem(page, socket.id)).toMatchObject({ width: 30, height: 20 });
    await expect(el).toContainClass('is-tiny');
    await dragHandle(page, socket.id, 'e', 10, 0);
    expect(await getItem(page, socket.id)).toMatchObject({ width: 40, height: 20 });
    await expect(el).not.toContainClass('is-tiny');
  });

  test('larger pieces keep their grips, and a tiny piece against a wall edge drops the clipped ones', async ({
    page,
  }) => {
    await loadLayout(page, {
      items: [wallItem('item-edge', 'socket', 730, 300), wallItem('item-square', 'cube', 100, 100, { width: 32.5, height: 32.5 })],
    });

    // 13 x 13 cm is past the threshold, so its grips straddle the edges as before
    await selectItemById(page, 'item-square');
    const square = itemLocator(page, 'item-square');
    await expect(square).not.toContainClass('is-tiny');
    const face = await square.boundingBox();
    const grip = await square.locator('.handle-e').boundingBox();
    expect(grip.x).toBeLessThan(face.x + face.width);

    await selectItemById(page, 'item-edge');
    const edge = itemLocator(page, 'item-edge');
    await expect(edge).toContainClass('is-tiny');
    await expect(edge).toContainClass('flush-right');
    await expect(edge.locator('.handle-e')).toBeHidden();
    await expect(edge.locator('.handle-se')).toBeHidden();
    await expect(edge.locator('.handle-s')).toBeVisible();

    await dragBy(page, 'item-edge', -100, 0);
    expect(await getItem(page, 'item-edge')).toMatchObject({ left: 630, top: 300, width: 20, height: 20 });
    await expect(edge).not.toContainClass('flush-right');
    await expect(edge.locator('.handle-e')).toBeVisible();
  });
});
