import { test, expect } from './support/fixtures.js';
import {
  allRulersHidden,
  itemLocator,
  loadLayout,
  nextFrame,
  rulerState,
  selectItemById,
  selectItemsById,
  wallItem,
  wallPoint,
} from './support/planner.js';

// Cubes are 90 x 90 px: b sits level with a, c sits diagonally below and to the right
const LAYOUT = {
  items: [
    wallItem('item-a', 'cube', 100, 100),
    wallItem('item-b', 'cube', 300, 100),
    wallItem('item-c', 'cube', 300, 300),
    wallItem('item-win', 'window', 420, 250),
    wallItem('item-sock', 'socket', 500, 330),
  ],
};

const overlay = (page) => page.locator('#measure-layer');

const labels = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('#measure-layer .measure-label')].map((el) => el.textContent).sort(),
  );

const guideCount = (page) => page.locator('#measure-layer .measure-guide').count();

async function hover(page, x, y) {
  const point = await wallPoint(page, x, y);
  await page.mouse.move(point.x, point.y, { steps: 2 });
  await nextFrame(page);
}

test.describe('Alt-hover measurements', () => {
  test.beforeEach(async ({ page }) => {
    await loadLayout(page, LAYOUT);
  });

  test.afterEach(async ({ page }) => {
    await page.keyboard.up('Alt');
  });

  test('Alt over an unselected item draws the gap to it and hides the regular rulers', async ({ page }) => {
    await selectItemById(page, 'item-a');
    await hover(page, 340, 140);

    await page.keyboard.down('Alt');
    await nextFrame(page);

    await expect(overlay(page)).toBeVisible();
    expect(await labels(page)).toEqual(['44 cm']);
    expect(await guideCount(page)).toBe(0);
    await expect(page.locator('#measure-layer .measure-line.is-h')).toHaveCount(1);
    await expect(itemLocator(page, 'item-b')).toContainClass('measure-target');
    await expect(overlay(page).locator('.measure-label')).toHaveCSS('background-color', 'rgb(244, 63, 94)');
    expect(await allRulersHidden(page)).toBe(true);

    await page.keyboard.up('Alt');

    await expect(overlay(page)).toBeHidden();
    await expect(itemLocator(page, 'item-b')).not.toContainClass('measure-target');
    expect(await rulerState(page, 'wallX')).toMatchObject({ visible: true, text: '40 cm' });
  });

  test('a diagonal neighbor gets both gaps, with dashed extensions out to its edges', async ({ page }) => {
    await selectItemById(page, 'item-a');
    await page.keyboard.down('Alt');
    await hover(page, 340, 340);

    expect(await labels(page)).toEqual(['44 cm', '44 cm']);
    expect(await guideCount(page)).toBe(2);
  });

  test('bare wall measures to all four wall edges', async ({ page }) => {
    await selectItemById(page, 'item-a');
    await page.keyboard.down('Alt');
    await hover(page, 40, 560);

    // 100 px to the left and top, 560 px to the right edge and 435 px to the floor
    expect(await labels(page)).toEqual(['174 cm', '224 cm', '40 cm', '40 cm']);
  });

  test('an item nested inside the hovered one gets an edge-to-edge distance on every side', async ({ page }) => {
    await selectItemById(page, 'item-sock');
    await page.keyboard.down('Alt');
    await hover(page, 440, 270);

    // Socket 500-520 x 330-350 inside the window frame 420-720 x 250-550
    expect(await labels(page)).toEqual(['32 cm', '32 cm', '80 cm', '80 cm']);
  });

  test('a group measures from its bounding box', async ({ page }) => {
    await selectItemsById(page, ['item-a', 'item-b']);
    await page.keyboard.down('Alt');
    await hover(page, 340, 340);

    // The box spans 100-390 px, so c sits directly below it and only the vertical gap is drawn
    expect(await labels(page)).toEqual(['44 cm']);
    await expect(page.locator('#measure-layer .measure-line.is-v')).toHaveCount(1);
  });

  test('the readout follows the selection while it moves with Alt still held', async ({ page }) => {
    await selectItemById(page, 'item-a');
    await page.keyboard.down('Alt');
    await hover(page, 340, 140);
    expect(await labels(page)).toEqual(['44 cm']);

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');

    expect(await labels(page)).toEqual(['42 cm']);
  });

  test('nothing is drawn without a selection, over the selection itself, or while dragging', async ({ page }) => {
    await page.keyboard.down('Alt');
    await hover(page, 340, 140);
    await expect(overlay(page)).toBeHidden();
    await page.keyboard.up('Alt');

    await selectItemById(page, 'item-a');
    await page.keyboard.down('Alt');
    await hover(page, 140, 140);
    await expect(overlay(page)).toBeHidden();

    await hover(page, 340, 140);
    await expect(overlay(page)).toBeVisible();

    // Pressing b selects it and starts an Alt drag, which suspends measuring until the release
    await page.mouse.down();
    await hover(page, 360, 160);
    await expect(overlay(page)).toBeHidden();
    await page.mouse.up();
  });

  test('Alt still bypasses the magnet during a drag', async ({ page }) => {
    await selectItemById(page, 'item-b');
    const start = await wallPoint(page, 345, 145);
    await page.mouse.move(start.x, start.y);
    await page.keyboard.down('Alt');
    await page.mouse.down();
    await page.mouse.move(start.x + 3, start.y + 3, { steps: 2 });
    await nextFrame(page);
    await page.mouse.up();

    // One centimeter off c's left edge and a's top edge, both of which would pull it back without Alt
    await expect(page.locator('#inspector-pos-readout')).toHaveText('121 cm (X), 41 cm (Y)');
    await expect(page.locator('.align-line:not([hidden])')).toHaveCount(0);
  });
});
