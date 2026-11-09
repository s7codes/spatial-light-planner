import { test, expect } from './support/fixtures.js';
import {
  WALL_BORDER,
  blurActiveElement,
  downloadFrom,
  historyState,
  importFile,
  itemLocator,
  loadLayout,
  nextFrame,
  pngInfo,
  readPixels,
  selectItemById,
  topbarOverflow,
  wallItem,
} from './support/planner.js';

// On the 750 px wall a 120 x 80 cm slope starts at x = 450 and falls to y = 200 at the right edge,
// so its edge is y = (x - 450) * 2 / 3. The cubes are 90 x 90 px.
const SLOPE_LAYOUT = {
  atticSlope: true,
  items: [
    // Top-right corner at (600, 97.5): above the 120 x 80 edge (y = 100 there), below the 90 x 90 one
    wallItem('item-high', 'cube', 510, 97.5),
    // Corner at (487.5, 25): exactly on the 120 x 80 edge, left of the 90 x 90 slope
    wallItem('item-edge', 'cube', 397.5, 25),
    // Corner at (750, 200): inside the 90 x 90 slope, exactly on the tip of the 120 x 80 one
    wallItem('item-low', 'cube', 660, 200),
  ],
};

async function setAtticSize(page, { width, height }) {
  if (width !== undefined) {
    await page.fill('#attic-width-input', String(width));
    await page.press('#attic-width-input', 'Enter');
  }
  if (height !== undefined) {
    await page.fill('#attic-height-input', String(height));
    await page.press('#attic-height-input', 'Enter');
  }
  await blurActiveElement(page);
}

const atticState = (page) =>
  page.evaluate(() => {
    const zone = getComputedStyle(atticZone);
    return {
      width: atticWidthInput.value,
      height: atticHeightInput.value,
      zone: [zone.width, zone.height],
      label: atticZone.querySelector('#attic-zone-size').textContent,
    };
  });

const colliding = async (page, ids) =>
  Object.fromEntries(
    await Promise.all(
      ids.map(async (id) => [id, await itemLocator(page, id).evaluate((el) => el.classList.contains('colliding'))]),
    ),
  );

test.describe('attic slope size', () => {
  test('the size fields only show, and only accept input, while the slope is on', async ({ page }) => {
    const fields = page.locator('#attic-size-fields');
    await expect(fields).toBeHidden();
    await expect(page.locator('#attic-width-input')).toBeDisabled();

    await page.check('#attic-slope-toggle');

    await expect(fields).toBeVisible();
    await expect(page.locator('#attic-width-input')).toBeEnabled();
    await expect(page.locator('#attic-height-input')).toBeEnabled();
    expect(await atticState(page)).toEqual({ width: '90', height: '90', zone: ['225px', '225px'], label: '90 x 90 cm' });
    for (const input of await fields.locator('input').all()) {
      expect(await input.getAttribute('title')).toBeTruthy();
    }

    await page.uncheck('#attic-slope-toggle');
    await expect(fields).toBeHidden();
    await expect(page.locator('#attic-height-input')).toBeDisabled();
  });

  test('a 120 x 80 cm slope redraws the zone where the collision math puts it', async ({ page }) => {
    await page.check('#attic-slope-toggle');
    await setAtticSize(page, { width: 120, height: 80 });

    expect(await atticState(page)).toEqual({
      width: '120',
      height: '80',
      zone: ['300px', '200px'],
      label: '120 x 80 cm',
    });
    const wall = await page.locator('#wall').boundingBox();
    const zone = await page.locator('#attic-zone').boundingBox();
    expect(zone.x - wall.x - WALL_BORDER).toBeCloseTo(450, 5);
    expect(zone.y - wall.y - WALL_BORDER).toBeCloseTo(0, 5);
    expect([zone.width, zone.height]).toEqual([300, 200]);
  });

  test('items collide against the resized slope edge, not the old 45-degree one', async ({ page }) => {
    await loadLayout(page, SLOPE_LAYOUT);
    const ids = ['item-high', 'item-edge', 'item-low'];
    expect(await colliding(page, ids)).toEqual({ 'item-high': false, 'item-edge': false, 'item-low': true });

    await setAtticSize(page, { width: 120, height: 80 });

    expect(await colliding(page, ids)).toEqual({ 'item-high': true, 'item-edge': false, 'item-low': false });
    await selectItemById(page, 'item-high');
    await expect(page.locator('#warning-attic')).toBeVisible();
    await selectItemById(page, 'item-low');
    await expect(page.locator('#warning-attic')).toBeHidden();

    const cases = await page.evaluate(() => {
      const intrudes = (left, top, width) => intrudesAtticSlope({ left, top, width, height: 10 });
      return {
        leftOfSlope: intrudes(350, 0, 100),
        justInside: intrudes(350, 0, 102.5),
        aboveTheEdge: intrudes(500, 199, 250),
        onTheTip: intrudes(500, 200, 250),
      };
    });
    expect(cases).toEqual({ leftOfSlope: false, justInside: true, aboveTheEdge: true, onTheTip: false });
  });

  test('a 1 cm nudge across the shallower edge sets and clears the warning', async ({ page }) => {
    await loadLayout(page, { ...SLOPE_LAYOUT, atticWidthCm: 120, atticHeightCm: 80, items: [SLOPE_LAYOUT.items[1]] });
    await page.click('.wall-item[data-id="item-edge"]');
    await expect(page.locator('#warning-attic')).toBeHidden();

    await page.keyboard.press('ArrowUp');
    await expect(page.locator('#warning-attic')).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('#warning-attic')).toBeHidden();
  });

  test('typed sizes are clamped to 30-150 cm, and an empty field puts the size back', async ({ page }) => {
    await page.check('#attic-slope-toggle');

    await setAtticSize(page, { width: 500, height: 4 });
    expect(await atticState(page)).toMatchObject({ width: '150', height: '30', label: '150 x 30 cm' });

    await setAtticSize(page, { width: '' });
    expect(await atticState(page)).toMatchObject({ width: '150', height: '30' });
  });

  test('a resize is one undo step and restores the old edge', async ({ page }) => {
    await loadLayout(page, SLOPE_LAYOUT);
    const before = await historyState(page);

    await setAtticSize(page, { width: 120 });
    expect(await historyState(page)).toMatchObject({ index: before.index + 1 });

    await page.keyboard.press('Control+z');
    expect(await atticState(page)).toMatchObject({ width: '90', height: '90', label: '90 x 90 cm' });
    expect(await colliding(page, ['item-low'])).toEqual({ 'item-low': true });

    await page.keyboard.press('Control+y');
    expect(await atticState(page)).toMatchObject({ width: '120', height: '90' });
  });

  test('the size is exported, imported, autosaved and reset with the layout', async ({ page }) => {
    await page.check('#attic-slope-toggle');
    await setAtticSize(page, { width: 120, height: 80 });

    const { buffer } = await downloadFrom(page, '#export-json-btn');
    const file = JSON.parse(buffer.toString('utf8'));
    expect(file).toMatchObject({ version: '1.8', atticSlope: true, atticWidthCm: 120, atticHeightCm: 80 });

    await page.reload();
    expect(await atticState(page)).toMatchObject({ width: '120', height: '80', zone: ['300px', '200px'] });

    await page.click('#reset-wall-btn');
    await page.check('#attic-slope-toggle');
    expect(await atticState(page)).toMatchObject({ width: '90', height: '90' });

    await importFile(page, 'sized.json', JSON.stringify(file));
    expect(await atticState(page)).toMatchObject({ width: '120', height: '80', label: '120 x 80 cm' });
  });

  test('files from before v2.6 with only the atticSlope flag fall back to 90 x 90 cm', async ({ page }) => {
    await page.check('#attic-slope-toggle');
    await setAtticSize(page, { width: 120, height: 80 });

    await importFile(
      page,
      'old.json',
      JSON.stringify({ version: '1.8', atticSlope: true, wallItems: [wallItem('item-old', 'cube', 660, 200)] }),
    );

    await expect(page.locator('#attic-slope-toggle')).toBeChecked();
    expect(await atticState(page)).toEqual({ width: '90', height: '90', zone: ['225px', '225px'], label: '90 x 90 cm' });
    await expect(itemLocator(page, 'item-old')).toContainClass('colliding');

    await loadLayout(page, { atticSlope: true, atticWidthCm: 'wide', atticHeightCm: 999, items: [] });
    expect(await atticState(page)).toMatchObject({ width: '90', height: '150' });
  });

  test('the topbar still fits at 1300 px with the size fields showing', async ({ page }) => {
    await loadLayout(page, { wallWidthCm: 400, wallHeightCm: 300, atticSlope: true, items: [] });
    await page.setViewportSize({ width: 1300, height: 700 });
    await nextFrame(page);

    await expect(page.locator('#attic-size-fields')).toBeVisible();
    await expect(page.locator('#scale-note')).toContainText('fit');
    expect(await topbarOverflow(page)).toBeLessThanOrEqual(0);
  });

  test('the PNG export draws the resized slope edge', async ({ page }) => {
    await loadLayout(page, { atticSlope: true, atticWidthCm: 120, atticHeightCm: 80, items: [] });

    const { buffer } = await downloadFrom(page, '#export-png-btn');
    expect([pngInfo(buffer).width, pngInfo(buffer).height]).toEqual([1500, 1250]);
    // Just inside the edge at x = 600 (y = 100), just below it, and a spot the 90 x 90 slope never reached
    const [edge, below, newCorner] = await readPixels(page, buffer, [[600, 99.5], [600, 104], [480, 8]], 2);

    expect(edge[0]).toBeGreaterThan(edge[1] + 60);
    // The corner glow tints the wall violet here, but none of the slope's red reaches it
    expect(below[0]).toBeLessThan(edge[0] - 80);
    expect(below[0]).toBeLessThanOrEqual(below[2]);
    expect(newCorner[0]).toBeGreaterThanOrEqual(newCorner[1] + 5);
  });
});
