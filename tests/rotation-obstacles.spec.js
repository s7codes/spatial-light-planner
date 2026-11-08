import { test, expect } from './support/fixtures.js';
import {
  contextMenuItem,
  downloadFrom,
  drawMarquee,
  getItem,
  getItems,
  historyState,
  importFile,
  itemLocator,
  itemOrder,
  loadLayout,
  openContextMenu,
  readPixels,
  selectedIds,
  selectedItem,
  selectItemById,
  selectItemsById,
  wallItem,
  wallScreenPixels,
} from './support/planner.js';

// Shelves are 110 x 8 cm (275 x 20 px), so a quarter turn makes the swap obvious
const box = ({ left, top, width, height, rotation }) => ({ left, top, width, height, rotation });

const afterLayer = (page, id) =>
  page.evaluate((itemId) => {
    const style = getComputedStyle(getItemElement(itemId), '::after');
    return {
      transform: style.transform,
      width: parseFloat(style.width),
      height: parseFloat(style.height),
      borderTop: style.borderTopWidth,
      borderLeft: style.borderLeftWidth,
      boxShadow: style.boxShadow,
    };
  }, id);

async function exportPixels(page, points) {
  const { buffer } = await downloadFrom(page, '#export-png-btn');
  return readPixels(page, buffer, points, 2);
}

test.describe('rotation', () => {
  test('R turns an item about its center and swaps its footprint in one undo step', async ({ page }) => {
    await loadLayout(page, { items: [wallItem('item-s', 'shelf', 200, 300)] });
    await selectItemById(page, 'item-s');
    const before = await historyState(page);

    await page.keyboard.press('r');

    expect(box(await getItem(page, 'item-s'))).toEqual({
      left: 327.5,
      top: 172.5,
      width: 20,
      height: 275,
      rotation: 90,
    });
    await expect(itemLocator(page, 'item-s')).toHaveCSS('width', '20px');
    await expect(itemLocator(page, 'item-s')).toContainClass('rot-90');
    await expect(page.locator('#edit-width-cm')).toHaveValue('8');
    await expect(page.locator('#edit-height-cm')).toHaveValue('110');
    await expect(page.locator('#rotation-readout')).toHaveText('90 deg');
    expect((await historyState(page)).index).toBe(before.index + 1);

    await page.keyboard.press('Control+z');
    expect(box(await getItem(page, 'item-s'))).toEqual({ left: 200, top: 300, width: 275, height: 20, rotation: 0 });
  });

  test('four quarter turns bring a piece home, even when its center sits on a half centimeter', async ({ page }) => {
    // 75 x 38 cm: the center moves 18.5 cm per turn, so the rounding has to alternate
    await loadLayout(page, { items: [wallItem('item-st', 'storage', 200, 200)] });
    await selectItemById(page, 'item-st');
    const start = box(await getItem(page, 'item-st'));

    await page.keyboard.press('r');
    const quarter = box(await getItem(page, 'item-st'));
    expect(quarter).toMatchObject({ width: 95, height: 187.5, rotation: 90 });
    for (const key of ['left', 'top']) expect(quarter[key] % 2.5).toBe(0);

    await page.keyboard.press('r');
    expect(box(await getItem(page, 'item-st'))).toEqual({ ...start, rotation: 180 });
    await page.keyboard.press('r');
    await page.keyboard.press('r');
    expect(box(await getItem(page, 'item-st'))).toEqual(start);
  });

  test('collisions, the marquee and wall clamping all use the turned footprint', async ({ page }) => {
    await loadLayout(page, {
      items: [
        wallItem('item-s', 'shelf', 100, 250),
        wallItem('item-c', 'cube', 240, 100),
        wallItem('item-low', 'shelf', 300, 600),
      ],
    });
    await expect(itemLocator(page, 'item-s')).not.toContainClass('colliding');

    await selectItemById(page, 'item-s');
    await page.keyboard.press('r');

    // Upright, the shelf runs from 122.5 to 397.5 px down the wall and crosses the cube
    expect(box(await getItem(page, 'item-s'))).toMatchObject({ left: 227.5, top: 122.5, width: 20, height: 275 });
    await expect(itemLocator(page, 'item-s')).toContainClass('colliding');
    await expect(itemLocator(page, 'item-c')).toContainClass('colliding');

    // A box well above the original flat footprint only catches the shelf once it stands upright
    await drawMarquee(page, [215, 130], [235, 150]);
    expect(await selectedIds(page)).toEqual(['item-s']);

    // Next to the floor the turned shelf is pushed back up inside the wall
    await selectItemById(page, 'item-low');
    await page.keyboard.press('r');
    const low = await getItem(page, 'item-low');
    expect(low).toMatchObject({ width: 20, height: 275, top: 350 });
    expect(low.top + low.height).toBe(625);
  });

  test('a piece that would not fit the wall once turned stays put and its Rotate button is disabled', async ({
    page,
  }) => {
    await loadLayout(page, { items: [wallItem('item-wide', 'shelf', 0, 300, { width: 750 })] });
    await selectItemById(page, 'item-wide');
    const before = await historyState(page);

    await expect(page.locator('#rotate-item-btn')).toBeDisabled();
    await page.keyboard.press('r');

    expect(await getItem(page, 'item-wide')).toMatchObject({ width: 750, height: 20, rotation: 0 });
    expect(await historyState(page)).toEqual(before);
  });

  test('batch rotation turns every unlocked member in one step and skips locked ones', async ({ page }) => {
    await loadLayout(page, {
      items: [
        wallItem('item-s', 'shelf', 100, 100),
        wallItem('item-p', 'poster', 450, 100),
        wallItem('item-c', 'cube', 100, 400, { locked: true, width: 100, height: 50 }),
      ],
    });
    await selectItemsById(page, ['item-s', 'item-p', 'item-c']);
    const before = await historyState(page);

    await page.click('#rotate-item-btn');

    expect(await getItem(page, 'item-s')).toMatchObject({ width: 20, height: 275, rotation: 90 });
    expect(await getItem(page, 'item-p')).toMatchObject({ width: 175, height: 125, rotation: 90 });
    expect(await getItem(page, 'item-c')).toMatchObject({ width: 100, height: 50, rotation: 0 });
    expect((await historyState(page)).index).toBe(before.index + 1);
    expect(await selectedIds(page)).toEqual(['item-c', 'item-p', 'item-s']);
  });

  test('the context menu and the Inspector both rotate, and a locked piece cannot turn', async ({ page }) => {
    await loadLayout(page, { items: [wallItem('item-c', 'cube', 200, 200, { width: 100, height: 50 })] });

    await openContextMenu(page, 'item-c');
    await expect(contextMenuItem(page, 'rotate')).toHaveText(/Rotate 90 Degrees/);
    await contextMenuItem(page, 'rotate').click();
    expect(await getItem(page, 'item-c')).toMatchObject({ width: 50, height: 100, rotation: 90 });

    await page.click('#rotate-item-btn');
    expect(await getItem(page, 'item-c')).toMatchObject({ width: 100, height: 50, rotation: 180 });

    await page.keyboard.press('l');
    await expect(page.locator('#rotate-item-btn')).toBeDisabled();
    await openContextMenu(page, 'item-c');
    await expect(contextMenuItem(page, 'rotate')).toBeDisabled();
  });

  test('a quarter turn swaps which side the minimum size applies to', async ({ page }) => {
    await loadLayout(page, {
      items: [wallItem('item-thin', 'shelf', 100, 100, { rotation: 90, width: 10, height: 275 })],
    });
    await selectItemById(page, 'item-thin');

    expect(await getItem(page, 'item-thin')).toMatchObject({ width: 10, height: 275 });
    await expect(page.locator('#edit-width-cm')).toHaveAttribute('min', '4');
    await expect(page.locator('#edit-height-cm')).toHaveAttribute('min', '8');
  });

  test('turned pieces point their wash, diffuser and handles the new way, and the PNG matches', async ({ page }) => {
    // Everything sampled on bare wall stays clear of the corner glow in the bottom right
    await loadLayout(page, {
      items: [
        wallItem('item-sp', 'spotlight', 250, 300, { rotation: 90 }),
        wallItem('item-lamp', 'corner-lamp', 300, 570, { rotation: 90, width: 350, height: 50 }),
        wallItem('item-st', 'storage', 380, 60, { rotation: 90, width: 200, height: 250 }),
      ],
    });

    expect((await afterLayer(page, 'item-sp')).transform).toMatch(/^matrix\(-?[0-9.e-]+, 1, -1, -?[0-9.e-]+, 0, 0\)$/);
    const diffuser = await afterLayer(page, 'item-lamp');
    expect(diffuser.width).toBeGreaterThan(diffuser.height * 10);
    expect(await afterLayer(page, 'item-st')).toMatchObject({ borderTop: '2px', borderLeft: '0px' });

    const points = {
      washLeft: [190, 320],
      belowFixture: [270, 430],
      diffuser: [340, 595],
      seam: [395, 185],
      handle: [559, 179],
    };
    const keys = Object.keys(points);
    const screen = await wallScreenPixels(page, Object.values(points));
    const exported = await exportPixels(page, Object.values(points));
    keys.forEach((key, i) => expect(exported[i], key).toBeNearColor(screen[i], 8));

    const pixel = Object.fromEntries(keys.map((key, i) => [key, exported[i]]));
    // The orange wash now falls to the left, and the spot below the fixture stays plain wall
    expect(pixel.washLeft[0]).toBeGreaterThan(pixel.belowFixture[0] + 15);
    expect(pixel.belowFixture).toBeNearColor([28, 31, 38], 4);
    expect(pixel.diffuser).toBeNearColor([139, 92, 246], 10);
    expect(pixel.handle).toBeNearColor([137, 143, 157], 10);
  });
});

test.describe('room features', () => {
  test('mount from their own group at $0, beneath the furniture, with a feature-only Inspector', async ({ page }) => {
    await page.click('.catalog-item[data-name="Wall Socket"]');

    expect(await selectedItem(page)).toMatchObject({
      type: 'socket',
      name: 'Wall Socket',
      price: 0,
      width: 20,
      height: 20,
      finish: null,
      ledEnabled: false,
      itemLedColor: null,
      rotation: 0,
    });
    expect((await itemOrder(page))[0]).toBe((await selectedItem(page)).id);
    await expect(page.locator('#total-price')).toHaveText('$70.00');

    await expect(page.locator('.feature-badge')).toHaveText('Room Feature');
    await expect(page.locator('#feature-note')).toBeVisible();
    for (const selector of ['#led-toggle-btn', '#item-led-color', '.btn-finish']) {
      await expect(page.locator(selector)).toHaveCount(0);
    }
    await expect(page.locator('#rotate-item-btn')).toBeEnabled();

    await page.click('.catalog-item[data-name="Door Clearance"]');
    expect(await selectedItem(page)).toMatchObject({ type: 'door', width: 225, height: 525, price: 0 });
    await page.click('.catalog-item[data-name="Window"]');
    expect(await selectedItem(page)).toMatchObject({ type: 'window', width: 300, height: 300, price: 0 });
    await expect(page.locator('#total-price')).toHaveText('$70.00');
  });

  test('stay out of the budget, the bill of materials and the drilling table, whatever a file claims', async ({
    page,
  }) => {
    const status = await importFile(
      page,
      'features.json',
      JSON.stringify({
        version: '1.4',
        wallItems: [
          wallItem('item-s', 'shelf', 100, 450),
          wallItem('item-w', 'window', 400, 50, {
            price: 999,
            finish: 'oak',
            ledEnabled: true,
            itemLedColor: '#ff0000',
          }),
          wallItem('item-k', 'socket', 650, 560, { price: 12 }),
        ],
      }),
    );
    await expect(status).toHaveText('Imported 3 items.');

    expect((await getItems(page)).find((item) => item.id === 'item-w')).toMatchObject({
      price: 0,
      finish: null,
      ledEnabled: false,
      itemLedColor: null,
    });
    await expect(page.locator('#total-price')).toHaveText('$45.00');

    await selectItemsById(page, ['item-s', 'item-w', 'item-k']);
    await expect(page.locator('.selected-item-meta')).toContainText('$45');

    await page.click('#view-spec-btn');
    await expect(page.locator('#spec-modal-subtitle')).toHaveText('Wall 300 x 250 cm | 1 item');
    await expect(page.locator('#bom-body tr')).toHaveCount(1);
    await expect(page.locator('#mounting-body tr')).toHaveCount(1);
    await expect(page.locator('#bom-body')).not.toContainText('Window');
  });

  test('furniture over a feature is flagged; features never clash with each other or the attic slope', async ({
    page,
  }) => {
    await loadLayout(page, {
      atticSlope: true,
      items: [
        wallItem('item-door', 'door', 20, 100),
        wallItem('item-sock', 'socket', 100, 300),
        wallItem('item-win', 'window', 420, 160),
        wallItem('item-s', 'shelf', 300, 200),
        wallItem('item-cube', 'cube', 640, 20),
      ],
    });

    await expect(itemLocator(page, 'item-s')).toContainClass('colliding');
    await expect(itemLocator(page, 'item-win')).toContainClass('colliding');
    await selectItemById(page, 'item-s');
    await expect(page.locator('#warning-feature')).toBeVisible();
    await expect(page.locator('#warning-overlap')).toBeHidden();

    // The socket sits inside the door zone, and the window reaches into the slope
    await expect(itemLocator(page, 'item-sock')).not.toContainClass('colliding');
    await expect(itemLocator(page, 'item-door')).not.toContainClass('colliding');
    await page.evaluate(() => {
      wallItems.find((item) => item.id === 'item-s').top = 500;
      renderPlanner();
    });
    await expect(itemLocator(page, 'item-win')).not.toContainClass('colliding');
    await selectItemById(page, 'item-win');
    await expect(page.locator('#warning-attic')).toBeHidden();
    await expect(page.locator('#warning-feature')).toBeHidden();

    // A regular piece up in the corner is still caught by the slope
    await expect(itemLocator(page, 'item-cube')).toContainClass('colliding');
    await selectItemById(page, 'item-cube');
    await expect(page.locator('#warning-attic')).toBeVisible();
  });

  test('render without a glow, turn like any piece, and reach the PNG detail for detail', async ({ page }) => {
    await loadLayout(page, {
      items: [
        wallItem('item-door', 'door', 20, 80),
        wallItem('item-win', 'window', 350, 60),
        wallItem('item-sock', 'socket', 600, 500),
      ],
    });

    expect(await page.evaluate(() => getComputedStyle(getItemElement('item-win'), '::before').display)).toBe('none');
    await expect(itemLocator(page, 'item-sock').locator('.item-label')).toBeHidden();

    const points = {
      doorFill: [60, 300],
      doorEdge: [21, 300],
      mullion: [500, 120],
      glass: [420, 120],
      socketPlate: [610, 504],
      socketHole: [607, 510],
    };
    const keys = Object.keys(points);
    const screen = await wallScreenPixels(page, Object.values(points));
    const exported = await exportPixels(page, Object.values(points));
    keys.forEach((key, i) => expect(exported[i], key).toBeNearColor(screen[i], 8));

    const pixel = Object.fromEntries(keys.map((key, i) => [key, exported[i]]));
    expect(pixel.socketPlate).toBeNearColor([211, 216, 224], 6);
    expect(pixel.socketHole).toBeNearColor([58, 65, 80], 10);
    pixel.glass.forEach((channel, i) => expect(channel).toBeLessThan(pixel.mullion[i]));
    expect(pixel.doorEdge[2]).toBeGreaterThan(pixel.doorFill[2] + 30);

    await selectItemById(page, 'item-sock');
    await page.keyboard.press('r');
    expect((await afterLayer(page, 'item-sock')).boxShadow).toContain('0px 6px 0px');
  });

  test('older files load unturned and malformed rotations fall back to 0', async ({ page }) => {
    const status = await importFile(
      page,
      'legacy.json',
      JSON.stringify({
        version: '1.3',
        wallItems: [
          wallItem('item-a', 'cube', 0, 0),
          wallItem('item-b', 'cube', 100, 0, { rotation: 45 }),
          wallItem('item-c', 'cube', 200, 0, { rotation: '270' }),
          wallItem('item-d', 'cube', 300, 0, { rotation: 360 }),
        ],
      }),
    );
    await expect(status).toHaveText('Imported 4 items.');
    expect((await getItems(page)).map((item) => item.rotation)).toEqual([0, 0, 270, 0]);
    await expect(itemLocator(page, 'item-c')).toContainClass('rot-270');

    await selectItemById(page, 'item-a');
    await page.keyboard.press('r');
    const { buffer } = await downloadFrom(page, '#export-json-btn');
    const file = JSON.parse(buffer.toString('utf8'));
    expect(file.version).toBe('1.7');
    expect(file.wallItems.find((item) => item.id === 'item-a')).toMatchObject({ rotation: 90 });
  });
});
