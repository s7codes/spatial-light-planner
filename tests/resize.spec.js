import { test, expect } from './support/fixtures.js';
import {
  dragHandle,
  getItem,
  historyState,
  itemLocator,
  loadLayout,
  rulerState,
  selectItemById,
  wallItem,
  wallState,
} from './support/planner.js';

const handlesOf = (page, id) => itemLocator(page, id).locator('.resize-handle');

test.describe('resize handles', () => {
  test.beforeEach(async ({ page }) => {
    await loadLayout(page, { items: [wallItem('item-a', 'cube', 100, 100), wallItem('item-r', 'cube', 300, 100)] });
    await selectItemById(page, 'item-a');
  });

  test('only the selected, unlocked item carries the east, south and corner grips', async ({ page }) => {
    for (const handle of ['e', 's', 'se']) {
      await expect(itemLocator(page, 'item-a').locator(`.resize-handle.handle-${handle}`)).toBeVisible();
    }
    await expect(handlesOf(page, 'item-a')).toHaveCount(3);
    await expect(handlesOf(page, 'item-r')).toHaveCount(0);

    await page.click('.wall-item[data-id="item-r"]');
    await expect(handlesOf(page, 'item-a')).toHaveCount(0);
    await expect(handlesOf(page, 'item-r')).toHaveCount(3);

    await page.keyboard.press('l');
    await expect(page.locator('.resize-handle')).toHaveCount(0);
  });

  test('the east grip resizes the width live and keeps the inspector, rulers and label in step', async ({ page }) => {
    const before = await historyState(page);

    await dragHandle(page, 'item-a', 'e', 50, 0, { hold: true });

    expect(await getItem(page, 'item-a')).toMatchObject({ left: 100, top: 100, width: 140, height: 90 });
    await expect(itemLocator(page, 'item-a')).toHaveCSS('width', '140px');
    await expect(page.locator('#edit-width-cm')).toHaveValue('56');
    expect(await rulerState(page, 'gapRight')).toMatchObject({ visible: true, text: '24 cm' });
    expect(await historyState(page)).toEqual(before);

    await page.mouse.up();

    expect((await historyState(page)).index).toBe(before.index + 1);
    await expect(page.locator('#edit-width-cm')).toHaveValue('56');
    await expect(page.locator('#edit-height-cm')).toHaveValue('36');
  });

  test('the south grip snaps heights to 5 cm when Snap 5cm is on', async ({ page }) => {
    await page.check('#snap-grid-toggle');

    await dragHandle(page, 'item-a', 's', 0, 40);

    expect(await getItem(page, 'item-a')).toMatchObject({ width: 90, height: 125 });
    await expect(page.locator('#edit-height-cm')).toHaveValue('50');
  });

  test('the corner grip resizes both axes and stops at the wall edges and the minimum size', async ({ page }) => {
    await loadLayout(page, { items: [wallItem('item-c', 'cube', 600, 500)] });
    await selectItemById(page, 'item-c');

    await dragHandle(page, 'item-c', 'se', 500, 500);
    expect(await getItem(page, 'item-c')).toMatchObject({ left: 600, top: 500, width: 150, height: 125 });

    await dragHandle(page, 'item-c', 'se', -800, -800);
    expect(await getItem(page, 'item-c')).toMatchObject({ left: 600, top: 500, width: 20, height: 10 });
  });

  test('a resize is a single undo step', async ({ page }) => {
    await dragHandle(page, 'item-a', 'se', 50, 30);
    expect(await getItem(page, 'item-a')).toMatchObject({ width: 140, height: 120 });

    await page.keyboard.press('Control+z');
    expect(await getItem(page, 'item-a')).toMatchObject({ width: 90, height: 90 });

    await page.keyboard.press('Control+y');
    expect(await getItem(page, 'item-a')).toMatchObject({ width: 140, height: 120 });
  });

  test('Escape mid-resize restores the original size without a history step', async ({ page }) => {
    const before = await historyState(page);
    await dragHandle(page, 'item-a', 'e', 60, 0, { hold: true });

    await page.keyboard.press('Escape');
    await page.mouse.up();

    expect(await getItem(page, 'item-a')).toMatchObject({ width: 90, height: 90 });
    await expect(itemLocator(page, 'item-a')).toHaveCSS('width', '90px');
    expect(await historyState(page)).toEqual(before);
    expect((await getItem(page, 'item-a')).id).toBe('item-a');
  });

  test('growing into a neighbor flags the collision while the grip is held', async ({ page }) => {
    await dragHandle(page, 'item-a', 'e', 250, 0, { hold: true });

    await expect(itemLocator(page, 'item-a')).toContainClass('colliding');
    await expect(itemLocator(page, 'item-r')).toContainClass('colliding');
    await expect(page.locator('#warning-overlap')).toBeVisible();

    await page.mouse.up();
  });

  test('pressing a grip never moves the item or clears the selection', async ({ page }) => {
    await dragHandle(page, 'item-a', 's', 0, 300);

    expect(await getItem(page, 'item-a')).toMatchObject({ left: 100, top: 100 });
    await expect(page.locator('.wall-item.selected')).toHaveAttribute('data-id', 'item-a');
  });

  test('grips track the cursor on a scaled wall', async ({ page }) => {
    await loadLayout(page, { wallWidthCm: 400, wallHeightCm: 300, items: [wallItem('item-a', 'cube', 100, 100)] });
    await selectItemById(page, 'item-a');
    const { scale } = await wallState(page);
    expect(scale).toBeLessThan(1);

    await dragHandle(page, 'item-a', 'e', 120, 0);

    expect(Math.abs((await getItem(page, 'item-a')).width - (90 + 120 / scale))).toBeLessThanOrEqual(1.25);
  });
});
