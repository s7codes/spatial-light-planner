import { test, expect } from './support/fixtures.js';
import {
  clickWallAt,
  dragBy,
  drawMarquee,
  getItem,
  historyState,
  itemLocator,
  loadLayout,
  nextFrame,
  rulerState,
  selectedIds,
  selectItemsById,
  wallItem,
  wallPoint,
  wallState,
} from './support/planner.js';

// Cubes are 90 x 90 px (36 x 36 cm): a and b share a row, c sits under a, and far is out on its own
const GROUP_LAYOUT = {
  items: [
    wallItem('item-a', 'cube', 100, 100),
    wallItem('item-b', 'cube', 250, 100),
    wallItem('item-c', 'cube', 100, 300),
    wallItem('item-far', 'cube', 600, 450),
  ],
};

const positions = async (page, ids) => {
  const result = {};
  for (const id of ids) {
    const { left, top } = await getItem(page, id);
    result[id] = [left, top];
  }
  return result;
};

const liveSelected = (page) =>
  page.evaluate(() => [...document.querySelectorAll('.wall-item.selected')].map((el) => el.dataset.id).sort());

test.describe('marquee selection', () => {
  test.beforeEach(async ({ page }) => {
    await loadLayout(page, GROUP_LAYOUT);
  });

  test('a box dragged across empty wall selects every item it crosses, marking them live', async ({ page }) => {
    await drawMarquee(page, [80, 80], [260, 120], { hold: true });

    const box = page.locator('#selection-marquee');
    await expect(box).toBeVisible();
    await expect(box).toHaveCSS('border-top-color', 'rgb(59, 130, 246)');
    await expect(box).toHaveCSS('background-color', 'rgba(59, 130, 246, 0.15)');
    // The wall can sit on a half pixel while mouse events report whole ones, hence the 1 px slack
    const geometry = await box.evaluate((el) => [el.style.left, el.style.top, el.style.width, el.style.height]);
    [80, 80, 180, 40].forEach((expected, i) =>
      expect(Math.abs(parseFloat(geometry[i]) - expected)).toBeLessThanOrEqual(1),
    );
    expect(await liveSelected(page)).toEqual(['item-a', 'item-b']);
    // The selection itself only changes on release
    expect(await selectedIds(page)).toEqual([]);

    await page.mouse.up();

    await expect(box).toBeHidden();
    expect(await selectedIds(page)).toEqual(['item-a', 'item-b']);
    await expect(page.locator('#batch-count')).toHaveText('2 items selected');
  });

  test('the box follows the cursor back out of an item, and touching an edge is not a crossing', async ({ page }) => {
    await drawMarquee(page, [20, 20], [150, 150], { hold: true });
    expect(await liveSelected(page)).toEqual(['item-a']);

    const outside = await wallPoint(page, 96, 96);
    await page.mouse.move(outside.x, outside.y, { steps: 4 });
    await nextFrame(page);
    expect(await liveSelected(page)).toEqual([]);

    await page.mouse.up();
    expect(await selectedIds(page)).toEqual([]);

    // Hits share the strict AABB test with collisions, so a box ending exactly on an edge misses
    const touching = await page.evaluate(() =>
      isOverlapping(
        { left: 20, top: 20, width: 80, height: 80 },
        wallItems.find((item) => item.id === 'item-a'),
      ),
    );
    expect(touching).toBe(false);
  });

  test('a press on the wall that barely moves is still a click that clears the selection', async ({ page }) => {
    await page.click('.wall-item[data-id="item-a"]');
    const start = await wallPoint(page, 400, 40);

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 2, start.y + 1, { steps: 2 });
    await page.mouse.up();

    await expect(page.locator('#selection-marquee')).toBeHidden();
    expect(await selectedIds(page)).toEqual([]);
  });

  test('releasing the box over an item keeps the new selection instead of clearing it', async ({ page }) => {
    await drawMarquee(page, [40, 260], [150, 340]);
    expect(await selectedIds(page)).toEqual(['item-c']);
  });

  test('Shift extends a marquee, and Shift+click toggles single items', async ({ page }) => {
    await page.click('.wall-item[data-id="item-a"]');
    await page.click('.wall-item[data-id="item-c"]', { modifiers: ['Shift'] });
    expect(await selectedIds(page)).toEqual(['item-a', 'item-c']);

    await page.click('.wall-item[data-id="item-a"]', { modifiers: ['Shift'] });
    expect(await selectedIds(page)).toEqual(['item-c']);

    await drawMarquee(page, [580, 430], [720, 600], { shift: true });
    expect(await selectedIds(page)).toEqual(['item-c', 'item-far']);

    // A Shift-click that misses every item keeps the group
    const empty = await wallPoint(page, 450, 60);
    await page.keyboard.down('Shift');
    await page.mouse.click(empty.x, empty.y);
    await page.keyboard.up('Shift');
    expect(await selectedIds(page)).toEqual(['item-c', 'item-far']);
  });

  test('Escape mid-box puts the previous selection back', async ({ page }) => {
    await page.click('.wall-item[data-id="item-far"]');
    await drawMarquee(page, [80, 80], [360, 220], { hold: true });
    expect(await liveSelected(page)).toEqual(['item-a', 'item-b']);

    await page.keyboard.press('Escape');
    await expect(page.locator('#selection-marquee')).toBeHidden();
    expect(await liveSelected(page)).toEqual(['item-far']);

    await page.mouse.up();
    expect(await selectedIds(page)).toEqual(['item-far']);
  });

  test('Ctrl+A selects every item and Escape clears the group', async ({ page }) => {
    await page.keyboard.press('Control+a');
    expect(await selectedIds(page)).toEqual(['item-a', 'item-b', 'item-c', 'item-far']);
    await expect(page.locator('#batch-count')).toHaveText('4 items selected');

    await page.keyboard.press('Escape');
    expect(await selectedIds(page)).toEqual([]);
  });

  test('hits are measured in wall space on a scaled wall', async ({ page }) => {
    await loadLayout(page, { wallWidthCm: 400, wallHeightCm: 300, ...GROUP_LAYOUT });
    expect((await wallState(page)).scale).toBeLessThan(1);

    await drawMarquee(page, [200, 150], [270, 330]);

    expect(await selectedIds(page)).toEqual(['item-b']);
  });

  test('the shortcuts guide explains the selection gestures without adding table rows', async ({ page }) => {
    await page.keyboard.press('?');
    await expect(page.locator('#shortcuts-modal tbody tr')).toHaveCount(10);
    await expect(page.locator('.shortcut-note')).toContainText('Shift + click adds or removes an item');
    await expect(page.locator('.shortcut-note')).toContainText('Right-click an item for its menu');
  });
});

test.describe('group selection', () => {
  test.beforeEach(async ({ page }) => {
    await loadLayout(page, GROUP_LAYOUT);
  });

  test('a plain click on one member narrows the group to that member', async ({ page }) => {
    await selectItemsById(page, ['item-a', 'item-b']);
    await page.click('.wall-item[data-id="item-b"]');
    expect(await selectedIds(page)).toEqual(['item-b']);
  });

  test('a dashed outline and the rulers follow the group bounding box', async ({ page }) => {
    await selectItemsById(page, ['item-a', 'item-b']);

    const outline = page.locator('#selection-bounds');
    await expect(outline).toBeVisible();
    expect(await outline.evaluate((el) => [el.style.left, el.style.top, el.style.width, el.style.height])).toEqual([
      '100px',
      '100px',
      '240px',
      '90px',
    ]);
    expect(await rulerState(page, 'wallX')).toMatchObject({ visible: true, text: '40 cm' });
    expect(await rulerState(page, 'wallY')).toMatchObject({ visible: true, text: '40 cm' });
    expect(await rulerState(page, 'gapDown')).toMatchObject({ visible: true, text: '44 cm' });

    await page.click('.wall-item[data-id="item-a"]');
    await expect(outline).toBeHidden();
  });
});

test.describe('group drag', () => {
  test.beforeEach(async ({ page }) => {
    await loadLayout(page, GROUP_LAYOUT);
  });

  test('dragging any member moves the whole group by one delta, without a re-render, in one undo step', async ({
    page,
  }) => {
    await selectItemsById(page, ['item-a', 'item-b', 'item-c']);
    const before = await historyState(page);
    await page.evaluate(() => [...wallItemsLayer.children].forEach((el) => (el.dataset.mark = 'kept')));

    await dragBy(page, 'item-b', 50, 25, { alt: true });

    expect(await positions(page, ['item-a', 'item-b', 'item-c', 'item-far'])).toEqual({
      'item-a': [150, 125],
      'item-b': [300, 125],
      'item-c': [150, 325],
      'item-far': [600, 450],
    });
    await expect(itemLocator(page, 'item-b')).toHaveCSS('left', '300px');
    expect(await page.evaluate(() => [...wallItemsLayer.children].every((el) => el.dataset.mark === 'kept'))).toBe(
      true,
    );
    expect(await selectedIds(page)).toEqual(['item-a', 'item-b', 'item-c']);
    expect((await historyState(page)).index).toBe(before.index + 1);

    await page.keyboard.press('Control+z');
    expect(await positions(page, ['item-a', 'item-b', 'item-c'])).toEqual({
      'item-a': [100, 100],
      'item-b': [250, 100],
      'item-c': [100, 300],
    });
  });

  test('the group stops as one block at the wall edge, keeping its spacing', async ({ page }) => {
    await selectItemsById(page, ['item-a', 'item-far']);

    await dragBy(page, 'item-far', 150, 150, { alt: true });

    expect(await positions(page, ['item-a', 'item-far'])).toEqual({
      'item-a': [160, 185],
      'item-far': [660, 535],
    });
  });

  test('a group refuses to enter the attic slope and slides along the free axis, while a lone item may', async ({
    page,
  }) => {
    await loadLayout(page, {
      atticSlope: true,
      items: [wallItem('item-a', 'cube', 100, 100), wallItem('item-s', 'cube', 400, 150)],
    });
    await selectItemsById(page, ['item-a', 'item-s']);

    // A single jump straight into the slope: the group holds its place
    await dragBy(page, 'item-s', 200, 0, { alt: true, steps: 1 });
    expect(await positions(page, ['item-a', 'item-s'])).toEqual({ 'item-a': [100, 100], 'item-s': [400, 150] });

    // Up and right: the right move is refused, the upward part still goes through
    await dragBy(page, 'item-s', 200, -40, { alt: true, steps: 1 });
    expect(await positions(page, ['item-a', 'item-s'])).toEqual({ 'item-a': [100, 60], 'item-s': [400, 110] });
    await expect(itemLocator(page, 'item-s')).not.toContainClass('colliding');

    await page.click('.wall-item[data-id="item-s"]');
    await dragBy(page, 'item-s', 200, 0, { alt: true, steps: 1 });
    expect(await getItem(page, 'item-s')).toMatchObject({ left: 600, top: 110 });
    await expect(itemLocator(page, 'item-s')).toContainClass('colliding');
  });

  test('one locked member holds the whole group in place and flashes the lock note', async ({ page }) => {
    await loadLayout(page, {
      items: [wallItem('item-a', 'cube', 100, 100, { locked: true }), wallItem('item-b', 'cube', 250, 100)],
    });
    await selectItemsById(page, ['item-a', 'item-b']);
    const before = await historyState(page);

    await dragBy(page, 'item-b', 60, 40, { alt: true });

    expect(await positions(page, ['item-a', 'item-b'])).toEqual({ 'item-a': [100, 100], 'item-b': [250, 100] });
    expect(await historyState(page)).toEqual(before);
    await expect(page.locator('#lock-note')).toContainClass('is-flashing');
    expect(await selectedIds(page)).toEqual(['item-a', 'item-b']);
  });

  test('arrow keys nudge the group, clamp it as one block and fold into one undo step', async ({ page }) => {
    await loadLayout(page, { items: [wallItem('item-a', 'cube', 2.5, 100), wallItem('item-b', 'cube', 250, 100)] });
    await selectItemsById(page, ['item-a', 'item-b']);
    const before = await historyState(page);

    for (let n = 0; n < 3; n++) await page.keyboard.press('ArrowRight');
    expect(await positions(page, ['item-a', 'item-b'])).toEqual({ 'item-a': [10, 100], 'item-b': [257.5, 100] });

    for (let n = 0; n < 6; n++) await page.keyboard.press('ArrowLeft');
    expect(await positions(page, ['item-a', 'item-b'])).toEqual({ 'item-a': [0, 100], 'item-b': [247.5, 100] });
    expect((await historyState(page)).index).toBe(before.index + 1);

    await page.keyboard.press('Control+z');
    expect(await positions(page, ['item-a', 'item-b'])).toEqual({ 'item-a': [2.5, 100], 'item-b': [250, 100] });
  });

  test('the group stays selected after a drag that ends over bare wall, and a wall click clears it', async ({
    page,
  }) => {
    await selectItemsById(page, ['item-a', 'item-b']);

    await dragBy(page, 'item-a', 0, 300, { alt: true });
    expect(await selectedIds(page)).toEqual(['item-a', 'item-b']);
    expect(await positions(page, ['item-a', 'item-b'])).toEqual({ 'item-a': [100, 400], 'item-b': [250, 400] });

    await clickWallAt(page, 5, 5);
    expect(await selectedIds(page)).toEqual([]);
  });
});
