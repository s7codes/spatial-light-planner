import { test, expect } from './support/fixtures.js';
import {
  WALL_BORDER,
  allRulersHidden,
  itemLocator,
  loadLayout,
  selectItemById,
  selectedItem,
  wallItem,
} from './support/planner.js';

test.describe('attic slope', () => {
  test('shows the 90 x 90 cm zone and flags items that cut into it', async ({ page }) => {
    await loadLayout(page, { items: [wallItem('item-p', 'poster', 625, 0), wallItem('item-c', 'cube', 100, 100)] });
    await expect(page.locator('#attic-zone')).toBeHidden();
    await expect(itemLocator(page, 'item-p')).not.toContainClass('colliding');

    await page.check('#attic-slope-toggle');

    await expect(page.locator('#attic-zone')).toBeVisible();
    await expect(page.locator('#attic-zone')).toContainText('90 x 90 cm');
    await expect(itemLocator(page, 'item-p')).toContainClass('colliding');
    await expect(itemLocator(page, 'item-c')).not.toContainClass('colliding');

    await selectItemById(page, 'item-p');
    await expect(page.locator('#warning-attic')).toBeVisible();
    await expect(page.locator('#warning-attic')).toHaveText('Intrudes into sloped ceiling zone');
    await expect(page.locator('#warning-overlap')).toBeHidden();
  });

  test('draws the slope exactly where the collision math puts it', async ({ page }) => {
    await page.check('#attic-slope-toggle');

    const wall = await page.locator('#wall').boundingBox();
    const zone = await page.locator('#attic-zone').boundingBox();
    expect(zone.x - wall.x - WALL_BORDER).toBeCloseTo(525, 5);
    expect(zone.y - wall.y - WALL_BORDER).toBeCloseTo(0, 5);
    expect([zone.width, zone.height]).toEqual([225, 225]);
  });

  test('tests the exact 45-degree edge through the top-right corner', async ({ page }) => {
    await page.check('#attic-slope-toggle');

    // The slope starts 225 px from the right edge of the 750 px wall and falls at 45 degrees
    const cases = await page.evaluate(() => {
      const intrudes = (left, top, width) => intrudesAtticSlope({ left, top, width, height: 10 });
      return {
        leftOfSlope: intrudes(400, 0, 125),
        justInside: intrudes(400, 0, 126),
        onTheEdge: intrudes(500, 100, 125),
        belowTheEdge: intrudes(500, 101, 125),
        aboveTheEdge: intrudes(500, 99, 125),
        cornerTip: intrudes(700, 224, 50),
        belowTheTip: intrudes(700, 225, 50),
      };
    });

    expect(cases).toEqual({
      leftOfSlope: false,
      justInside: true,
      onTheEdge: false,
      belowTheEdge: false,
      aboveTheEdge: true,
      cornerTip: true,
      belowTheTip: false,
    });
  });

  test('a 1 cm nudge off the slope edge clears the warning', async ({ page }) => {
    await loadLayout(page, { atticSlope: true, items: [wallItem('item-p', 'poster', 625, 222.5)] });
    await page.click('.wall-item[data-id="item-p"]');
    await expect(page.locator('#warning-attic')).toBeVisible();

    await page.keyboard.press('ArrowDown');

    expect(await selectedItem(page)).toMatchObject({ top: 225 });
    await expect(itemLocator(page, 'item-p')).not.toContainClass('colliding');
    await expect(page.locator('#warning-attic')).toBeHidden();
  });

  test('follows the right wall edge when the wall is wider', async ({ page }) => {
    await loadLayout(page, {
      wallWidthCm: 400,
      atticSlope: true,
      items: [wallItem('item-old-corner', 'cube', 660, 0), wallItem('item-new-corner', 'cube', 910, 0)],
    });

    await expect(itemLocator(page, 'item-old-corner')).not.toContainClass('colliding');
    await expect(itemLocator(page, 'item-new-corner')).toContainClass('colliding');
  });

  test('the setting and collision state survive a reload', async ({ page }) => {
    await loadLayout(page, { items: [wallItem('item-p', 'poster', 625, 0)] });
    await page.check('#attic-slope-toggle');

    await page.reload();

    await expect(page.locator('#attic-slope-toggle')).toBeChecked();
    await expect(page.locator('#attic-zone')).toBeVisible();
    await expect(itemLocator(page, 'item-p')).toContainClass('colliding');
    expect(await allRulersHidden(page)).toBe(true);
  });

  test('Reset Layout turns the slope off again', async ({ page }) => {
    await page.check('#attic-slope-toggle');
    await page.click('#reset-wall-btn');

    await expect(page.locator('#attic-slope-toggle')).not.toBeChecked();
    await expect(page.locator('#attic-zone')).toBeHidden();
  });
});

test.describe('item overlap', () => {
  test('flags both overlapping items and warns in the inspector', async ({ page }) => {
    await loadLayout(page, { items: [wallItem('item-a', 'cube', 100, 100), wallItem('item-b', 'cube', 150, 150)] });

    await expect(itemLocator(page, 'item-a')).toContainClass('colliding');
    await expect(itemLocator(page, 'item-b')).toContainClass('colliding');

    await selectItemById(page, 'item-a');
    await expect(page.locator('#warning-overlap')).toBeVisible();
    await expect(page.locator('#warning-overlap')).toHaveText('Overlap detected with another item');
  });

  test('items that only touch are not flagged', async ({ page }) => {
    await loadLayout(page, { items: [wallItem('item-a', 'cube', 100, 100), wallItem('item-b', 'cube', 190, 100)] });

    await expect(page.locator('.wall-item.colliding')).toHaveCount(0);
  });

  test('nudging an item into its neighbor flags the collision live', async ({ page }) => {
    await loadLayout(page, { items: [wallItem('item-a', 'cube', 100, 100), wallItem('item-b', 'cube', 190, 100)] });
    await page.click('.wall-item[data-id="item-b"]');

    await page.keyboard.press('ArrowLeft');

    await expect(itemLocator(page, 'item-a')).toContainClass('colliding');
    await expect(itemLocator(page, 'item-b')).toContainClass('colliding');
    await expect(page.locator('#warning-overlap')).toBeVisible();
  });
});
