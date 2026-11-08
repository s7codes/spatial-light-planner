import { test, expect } from './support/fixtures.js';
import {
  dragFromCatalog,
  getItems,
  historyState,
  loadLayout,
  nextFrame,
  selectedItem,
  wallPoint,
} from './support/planner.js';

const newestItem = async (page) => (await getItems(page)).at(-1);

test.describe('drag from catalog', () => {
  test('dropping a card mounts the item centered under the cursor and selects it', async ({ page }) => {
    const before = await historyState(page);

    await dragFromCatalog(page, 'Modular Cube', await wallPoint(page, 400, 300));

    const cube = await newestItem(page);
    expect(cube).toMatchObject({ type: 'cube', left: 355, top: 255, width: 90, height: 90 });
    expect(await getItems(page)).toHaveLength(3);
    expect(await selectedItem(page)).toMatchObject({ id: cube.id });
    expect((await historyState(page)).index).toBe(before.index + 1);
    await expect(page.locator('#inspector-box')).toContainText('Modular Cube');
  });

  test('the drop lands on the 5 cm grid when Snap 5cm is on', async ({ page }) => {
    await page.check('#snap-grid-toggle');

    await dragFromCatalog(page, 'Modular Cube', await wallPoint(page, 401, 301));

    expect(await newestItem(page)).toMatchObject({ left: 350, top: 250 });
  });

  test('drops near the edges are clamped inside the wall', async ({ page }) => {
    await dragFromCatalog(page, 'Modular Cube', await wallPoint(page, 5, 5));
    expect(await newestItem(page)).toMatchObject({ left: 0, top: 0 });

    await dragFromCatalog(page, 'Corner Floor Lamp', await wallPoint(page, 745, 620));
    expect(await newestItem(page)).toMatchObject({ left: 700, top: 275 });
  });

  test('a ghost follows the cursor and the wall marks itself as the drop target', async ({ page }) => {
    const target = await wallPoint(page, 300, 300);
    await dragFromCatalog(page, 'Poster Frame', target, { release: false });

    const ghost = page.locator('.catalog-ghost');
    await expect(ghost).toBeVisible();
    await expect(ghost).toContainClass('is-over-wall');
    await expect(page.locator('#wall')).toContainClass('drop-target');
    const box = await ghost.locator('.wall-item').boundingBox();
    expect(Math.abs(box.x + box.width / 2 - target.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(box.y + box.height / 2 - target.y)).toBeLessThanOrEqual(1);

    await page.mouse.move(130, 400, { steps: 4 });
    await nextFrame(page);
    await expect(ghost).not.toContainClass('is-over-wall');
    await expect(page.locator('#wall')).not.toContainClass('drop-target');

    await page.mouse.up();
    await expect(page.locator('.catalog-ghost')).toHaveCount(0);
  });

  test('releasing outside the canvas cancels the drop', async ({ page }) => {
    const before = await historyState(page);

    await dragFromCatalog(page, 'Modular Cube', { x: 1300, y: 600 });

    expect(await getItems(page)).toHaveLength(2);
    expect(await historyState(page)).toEqual(before);
    await expect(page.locator('.catalog-ghost')).toHaveCount(0);
  });

  test('Escape cancels mid-drag, and the card still mounts on a later click', async ({ page }) => {
    await dragFromCatalog(page, 'Modular Cube', await wallPoint(page, 400, 300), { release: false });

    await page.keyboard.press('Escape');
    await expect(page.locator('.catalog-ghost')).toHaveCount(0);
    await page.mouse.up();
    expect(await getItems(page)).toHaveLength(2);

    await page.click('.catalog-item[data-name="Modular Cube"]');
    expect(await newestItem(page)).toMatchObject({ type: 'cube', left: 240, top: 260 });
  });

  test('a press that travels less than 6 px is still a click that mounts at the cascade spot', async ({ page }) => {
    const card = await page.locator('.catalog-item[data-name="Mini Spotlight"]').boundingBox();
    const x = card.x + card.width / 2;
    const y = card.y + card.height / 2;

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 3, y + 2, { steps: 2 });
    await page.mouse.up();

    await expect(page.locator('.catalog-ghost')).toHaveCount(0);
    expect(await newestItem(page)).toMatchObject({ type: 'spotlight', left: 240, top: 260 });
  });

  test('drops land under the cursor on a scaled wall', async ({ page }) => {
    await loadLayout(page, { wallWidthCm: 400, wallHeightCm: 300, items: [] });

    await dragFromCatalog(page, 'Modular Cube', await wallPoint(page, 500, 400));

    const cube = await newestItem(page);
    expect(Math.abs(cube.left - 455)).toBeLessThanOrEqual(2.5);
    expect(Math.abs(cube.top - 355)).toBeLessThanOrEqual(2.5);
  });
});
