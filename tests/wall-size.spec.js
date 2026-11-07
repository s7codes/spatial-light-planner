import { test, expect } from './support/fixtures.js';
import {
  dragBy,
  getItem,
  getItems,
  historyState,
  itemLocator,
  loadLayout,
  nextFrame,
  releaseDrag,
  selectItemById,
  setWallSize,
  topSnapshots,
  wallItem,
  wallState,
} from './support/planner.js';

// Wall-size edits closer together than this fold into one undo step
const MERGE_WINDOW_MS = 600;
const waitOutMergeWindow = (page) => page.waitForTimeout(MERGE_WINDOW_MS + 100);

test.describe('wall dimensions', () => {
  test('a resize is one undo step that pushes items back inside the wall', async ({ page }) => {
    await setWallSize(page, { width: 200 });
    expect(await wallState(page)).toMatchObject({ widthCm: 200, cssWidth: '500px' });
    const [before, after] = await topSnapshots(page);
    expect([before.wallWidthCm, after.wallWidthCm]).toEqual([300, 200]);

    await waitOutMergeWindow(page);
    await setWallSize(page, { width: 150 });
    await waitOutMergeWindow(page);
    await setWallSize(page, { height: 150 });

    expect(await getItem(page, 'item-1')).toMatchObject({ left: 100, top: 355, width: 275 });
    expect(await getItem(page, 'item-2')).toMatchObject({ left: 195, top: 140 });
    for (const item of await getItems(page)) {
      expect(item.left + item.width).toBeLessThanOrEqual(375);
      expect(item.top + item.height).toBeLessThanOrEqual(375);
    }

    await page.keyboard.press('Control+z');
    expect(await wallState(page)).toMatchObject({ heightCm: 250 });
    expect(await getItem(page, 'item-1')).toMatchObject({ left: 100, top: 380 });

    await page.keyboard.press('Control+z');
    expect(await wallState(page)).toMatchObject({ widthCm: 200 });
    expect(await getItem(page, 'item-1')).toMatchObject({ left: 120 });

    await page.keyboard.press('Control+y');
    await page.keyboard.press('Control+y');
    expect(await wallState(page)).toMatchObject({ widthCm: 150, heightCm: 150 });
    expect(await getItem(page, 'item-1')).toMatchObject({ top: 355 });
  });

  test('rapid edits fold into a single undo step', async ({ page }) => {
    await setWallSize(page, { width: 320 });
    await setWallSize(page, { width: 330 });
    await setWallSize(page, { width: 340 });

    const [before, after] = await topSnapshots(page);
    expect([before.wallWidthCm, after.wallWidthCm]).toEqual([300, 340]);

    await page.keyboard.press('Control+z');
    expect(await wallState(page)).toMatchObject({ widthCm: 300 });
  });

  test('items wider than the new wall are trimmed and the inspector limit follows the wall', async ({ page }) => {
    await selectItemById(page, 'item-1');
    await page.fill('#edit-width-cm', '300');
    await page.press('#edit-width-cm', 'Enter');

    await setWallSize(page, { width: 150 });

    expect(await getItem(page, 'item-1')).toMatchObject({ width: 375, left: 0 });
    await expect(page.locator('#edit-width-cm')).toHaveAttribute('max', '150');

    await page.keyboard.press('Control+z');
    expect(await getItem(page, 'item-1')).toMatchObject({ width: 750 });
    expect(await wallState(page)).toMatchObject({ widthCm: 300 });
  });

  test('inputs clamp out-of-range values and an empty input restores the current size', async ({ page }) => {
    await setWallSize(page, { width: 1000 });
    expect(await wallState(page)).toMatchObject({ widthCm: 400 });
    await expect(page.locator('#wall-width-input')).toHaveValue('400');

    const before = await historyState(page);
    await page.fill('#wall-width-input', '');
    await page.press('#wall-width-input', 'Tab');
    await expect(page.locator('#wall-width-input')).toHaveValue('400');
    expect(await historyState(page)).toMatchObject({ index: before.index });

    await waitOutMergeWindow(page);
    await setWallSize(page, { height: 50 });
    expect(await wallState(page)).toMatchObject({ heightCm: 150 });
  });

  test('the wall size survives a reload and Reset Layout restores 300 x 250 cm', async ({ page }) => {
    await setWallSize(page, { width: 333, height: 222 });

    await page.reload();
    expect(await wallState(page)).toMatchObject({
      widthCm: 333,
      heightCm: 222,
      cssWidth: '832.5px',
      cssHeight: '555px',
    });

    await page.click('#reset-wall-btn');
    expect(await wallState(page)).toMatchObject({ widthCm: 300, heightCm: 250, widthInput: '300', heightInput: '250' });
  });
});

test.describe('auto-fit', () => {
  const LARGE_WALL = {
    wallWidthCm: 400,
    wallHeightCm: 300,
    items: [wallItem('item-a', 'cube', 400, 300), wallItem('item-b', 'poster', 100, 100)],
  };

  test('scales a 400 x 300 cm wall down to fit the canvas without touching the sidebars', async ({ page }) => {
    await loadLayout(page, LARGE_WALL);

    const state = await wallState(page);
    expect(state).toMatchObject({ cssWidth: '1000px', cssHeight: '750px', note: '(1 cm = 2.5 px, fit 81%)' });
    expect(state.scale).toBeLessThan(1);
    expect(state.transform).toMatch(/^scale\(0\.80/);

    const wall = await page.locator('#wall').boundingBox();
    const area = await page.locator('.canvas-area').boundingBox();
    expect(wall.x).toBeGreaterThanOrEqual(area.x);
    expect(wall.y).toBeGreaterThanOrEqual(area.y);
    expect(wall.x + wall.width).toBeLessThanOrEqual(area.x + area.width);
    expect(wall.y + wall.height).toBeLessThanOrEqual(area.y + area.height);

    for (const sidebar of await page.locator('.sidebar').all()) {
      expect(Math.round((await sidebar.boundingBox()).width)).toBe(270);
    }
  });

  test('dragging on a scaled wall keeps the item under the cursor', async ({ page }) => {
    await loadLayout(page, LARGE_WALL);
    const { scale } = await wallState(page);
    const start = await getItem(page, 'item-a');

    const { startX, startY } = await dragBy(page, 'item-a', 150, 80, { hold: true, alt: true });
    const box = await itemLocator(page, 'item-a').boundingBox();
    const moved = await getItem(page, 'item-a');
    await releaseDrag(page, { alt: true });

    // Quantizing to whole centimeters can shift the item by up to half a centimeter on screen
    const tolerance = 1.25 * scale + 0.75;
    expect(Math.abs(box.x + box.width / 2 - (startX + 150))).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(box.y + box.height / 2 - (startY + 80))).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(moved.left - start.left - 150 / scale)).toBeLessThanOrEqual(1.25);
    expect(Math.abs(moved.top - start.top - 80 / scale)).toBeLessThanOrEqual(1.25);
  });

  test('refits on window resize and renders small walls at 100%', async ({ page }) => {
    await loadLayout(page, LARGE_WALL);
    const fitted = await wallState(page);

    await page.setViewportSize({ width: 1300, height: 700 });
    await nextFrame(page);
    const refitted = await wallState(page);
    expect(refitted.scale).toBeLessThan(fitted.scale);
    expect(refitted.note).toContain('fit');

    await page.setViewportSize({ width: 1400, height: 820 });
    await setWallSize(page, { width: 150, height: 150 });
    expect(await wallState(page)).toMatchObject({ scale: 1, transform: '', note: '(1 cm = 2.5 px)' });
  });
});
