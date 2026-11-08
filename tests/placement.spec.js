import { test, expect } from './support/fixtures.js';
import {
  WALL_BORDER,
  allRulersHidden,
  clickWallAt,
  clippedLabels,
  dragBy,
  getItems,
  itemLocator,
  loadLayout,
  nextFrame,
  releaseDrag,
  rulerState,
  selectedItem,
  toCm,
  wallItem,
  wallState,
} from './support/planner.js';

const CATALOG = [
  {
    name: 'Floating Shelf',
    label: '110 x 8 cm',
    type: 'shelf',
    widthCm: 110,
    heightCm: 8,
    price: 45,
    finish: 'walnut',
  },
  { name: 'Modular Cube', label: '36 x 36 cm', type: 'cube', widthCm: 36, heightCm: 36, price: 30, finish: 'oak' },
  {
    name: 'Compact Storage',
    label: '75 x 38 cm',
    type: 'storage',
    widthCm: 75,
    heightCm: 38,
    price: 55,
    finish: 'walnut',
  },
  { name: 'Poster Frame', label: '50 x 70 cm', type: 'poster', widthCm: 50, heightCm: 70, price: 25, finish: 'black' },
  {
    name: 'Mini Spotlight',
    label: 'Top-mount LED',
    type: 'spotlight',
    widthCm: 16,
    heightCm: 16,
    price: 35,
    finish: 'black',
  },
  {
    name: 'Corner Floor Lamp',
    label: '140 cm RGB bar',
    type: 'corner-lamp',
    widthCm: 20,
    heightCm: 140,
    price: 65,
    finish: 'black',
  },
];

test.describe('starter wall', () => {
  test('renders the 300 x 250 cm wall at 1 cm = 2.5 px with the starter layout', async ({ page }) => {
    await expect(page.locator('.badge')).toHaveText('v1.7');
    expect(await wallState(page)).toMatchObject({
      widthCm: 300,
      heightCm: 250,
      cssWidth: '750px',
      cssHeight: '625px',
      widthInput: '300',
      heightInput: '250',
      scale: 1,
      transform: '',
      note: '(1 cm = 2.5 px)',
    });

    const items = await getItems(page);
    expect(items.map(({ id, type, left, top }) => [id, type, left, top])).toEqual([
      ['item-1', 'shelf', 120, 380],
      ['item-2', 'poster', 195, 140],
    ]);
    await expect(page.locator('#total-price')).toHaveText('$70.00');
    expect(await allRulersHidden(page)).toBe(true);
  });

  test('the wall interior matches the 750 x 625 px model, so edge items are fully visible', async ({ page }) => {
    expect(await page.evaluate(() => [wallCanvas.clientWidth, wallCanvas.clientHeight])).toEqual([750, 625]);

    await loadLayout(page, { items: [wallItem('item-corner', 'cube', 660, 535)] });
    const wall = await page.locator('#wall').boundingBox();
    const cube = await itemLocator(page, 'item-corner').boundingBox();

    expect(cube.x + cube.width).toBeLessThanOrEqual(wall.x + wall.width - WALL_BORDER);
    expect(cube.y + cube.height).toBeLessThanOrEqual(wall.y + wall.height - WALL_BORDER);
  });
});

test.describe('selection and rulers', () => {
  test('clicking items moves a single selection highlight', async ({ page }) => {
    await page.click('.wall-item[data-id="item-1"]');
    await expect(page.locator('.wall-item.selected')).toHaveAttribute('data-id', 'item-1');

    await page.click('.wall-item[data-id="item-2"]');
    await expect(page.locator('.wall-item.selected')).toHaveCount(1);
    await expect(page.locator('.wall-item.selected')).toHaveAttribute('data-id', 'item-2');
  });

  test('show the distance from the left wall and the ceiling for the selected item', async ({ page }) => {
    await page.click('.wall-item[data-id="item-2"]');

    expect(await rulerState(page, 'wallX')).toMatchObject({
      visible: true,
      text: '78 cm',
      top: '228px',
      width: '195px',
    });
    expect(await rulerState(page, 'wallY')).toMatchObject({ visible: true, text: '56 cm' });
  });

  test('clicking empty wall deselects the item and hides every ruler', async ({ page }) => {
    await page.click('.wall-item[data-id="item-2"]');
    await clickWallAt(page, 30, 600);

    expect(await selectedItem(page)).toBeNull();
    expect(await allRulersHidden(page)).toBe(true);
    await expect(page.locator('#inspector-box')).toContainText('Select or drag an item');
  });
});

test.describe('precise positioning', () => {
  test('arrow keys nudge the selected item by exactly 1 cm', async ({ page }) => {
    await page.click('.wall-item[data-id="item-2"]');
    for (const key of ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowDown']) await page.keyboard.press(key);

    expect(await selectedItem(page)).toMatchObject({ left: 202.5, top: 142.5 });
    expect(await rulerState(page, 'wallX')).toMatchObject({ text: '81 cm' });
    expect(await rulerState(page, 'wallY')).toMatchObject({ text: '57 cm' });
    await expect(page.locator('#inspector-pos-readout')).toHaveText('81 cm (X), 57 cm (Y)');
  });

  test('dragging quantizes to whole centimeters and keeps the item selected', async ({ page }) => {
    await dragBy(page, 'item-2', 37, 23, { alt: true });

    expect(await selectedItem(page)).toMatchObject({ id: 'item-2', left: 232.5, top: 162.5 });
  });

  test('rulers follow the item during a drag and hide at zero distance', async ({ page }) => {
    await dragBy(page, 'item-2', 100, -60, { hold: true, alt: true });
    const midDrag = await selectedItem(page);
    expect(await rulerState(page, 'wallX')).toMatchObject({ text: `${toCm(midDrag.left)} cm` });
    expect(await rulerState(page, 'wallY')).toMatchObject({ text: `${toCm(midDrag.top)} cm` });

    await page.mouse.move(1300, 0, { steps: 6 });
    await nextFrame(page);
    await releaseDrag(page, { alt: true });

    expect(await selectedItem(page)).toMatchObject({ left: 625, top: 0 });
    expect(await rulerState(page, 'wallX')).toMatchObject({ text: '250 cm' });
    expect(await rulerState(page, 'wallY')).toMatchObject({ visible: false });
  });

  test('Snap 5cm places dragged items on a 5 cm grid', async ({ page }) => {
    await page.check('#snap-grid-toggle');
    await dragBy(page, 'item-2', 37, 23, { alt: true });

    expect(await selectedItem(page)).toMatchObject({ left: 237.5, top: 162.5 });
  });

  test('inspector sizes are clamped to the wall and the clamped value is written back', async ({ page }) => {
    await page.click('.wall-item[data-id="item-1"]');
    await page.fill('#edit-width-cm', '999');
    await page.press('#edit-width-cm', 'Enter');

    await expect(page.locator('#edit-width-cm')).toHaveValue('300');
    expect(await selectedItem(page)).toMatchObject({ width: 750, left: 0 });
  });
});

test.describe('catalog', () => {
  for (const entry of CATALOG) {
    test(`mounts a ${entry.name} at its catalog size, price and finish`, async ({ page }) => {
      const catalogItem = page.locator(`.catalog-item[data-name="${entry.name}"]`);
      await expect(catalogItem.locator('.item-dims')).toHaveText(entry.label);
      await catalogItem.click();

      expect(await selectedItem(page)).toMatchObject({
        type: entry.type,
        name: entry.name,
        price: entry.price,
        finish: entry.finish,
        width: entry.widthCm * 2.5,
        height: entry.heightCm * 2.5,
        ledEnabled: true,
        locked: false,
      });
      await expect(page.locator('#edit-width-cm')).toHaveValue(String(entry.widthCm));
      await expect(page.locator('#edit-height-cm')).toHaveValue(String(entry.heightCm));
    });
  }

  test('Compact Storage renders with its finish class and adds $55 to the estimate', async ({ page }) => {
    await page.click('.catalog-item[data-name="Compact Storage"]');

    const { id } = await selectedItem(page);
    await expect(itemLocator(page, id)).toContainClass('storage finish-walnut');
    await expect(page.locator('#total-price')).toHaveText('$125.00');
  });

  test('new items cascade from the spawn point and tall pieces stay above the floor', async ({ page }) => {
    for (let n = 0; n < 5; n++) await page.click('.catalog-item[data-name="Mini Spotlight"]');
    await page.click('.catalog-item[data-name="Corner Floor Lamp"]');

    const items = await getItems(page);
    const spotlights = items.filter((item) => item.type === 'spotlight');
    expect(spotlights.map(({ left, top }) => [left, top])).toEqual([
      [240, 260],
      [260, 280],
      [280, 300],
      [300, 320],
      [320, 340],
    ]);

    const lamp = items.find((item) => item.type === 'corner-lamp');
    expect(lamp).toMatchObject({ left: 340, top: 275 });
    expect(lamp.top + lamp.height).toBe(625);
    expect(await rulerState(page, 'wallY')).toMatchObject({ text: '110 cm' });
  });
});

test.describe('item labels', () => {
  const EDGE_LAYOUT = {
    items: [wallItem('item-spot', 'spotlight', 0, 0), wallItem('item-lamp', 'corner-lamp', 700, 275)],
  };
  const labelTransform = (page, id) =>
    itemLocator(page, id)
      .locator('.item-label')
      .evaluate((label) => label.style.transform);

  test('labels wider than their item stay inside the wall at the edges', async ({ page }) => {
    await loadLayout(page, EDGE_LAYOUT);

    expect(await clippedLabels(page)).toEqual([]);
    expect(await labelTransform(page, 'item-spot')).toMatch(/^translate\(\d/);
    expect(await labelTransform(page, 'item-lamp')).toMatch(/^translate\(-\d/);
  });

  test('labels re-center away from the edges and stay inside while dragging', async ({ page }) => {
    await loadLayout(page, EDGE_LAYOUT);

    const { startX, startY } = await dragBy(page, 'item-spot', 300, 200, { hold: true, alt: true });
    expect(await labelTransform(page, 'item-spot')).toBe('');

    await page.mouse.move(startX + 1000, startY + 200, { steps: 6 });
    await nextFrame(page);
    expect(await clippedLabels(page)).toEqual([]);
    await releaseDrag(page, { alt: true });

    expect(await selectedItem(page)).toMatchObject({ left: 710 });
    expect(await clippedLabels(page)).toEqual([]);
  });
});
