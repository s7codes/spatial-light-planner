import { test, expect } from './support/fixtures.js';
import {
  dragBy,
  dragFromCatalog,
  dragHandle,
  getItems,
  historyState,
  itemLocator,
  loadLayout,
  nextFrame,
  selectItemById,
  selectedItem,
  wallItem,
  wallPoint,
} from './support/planner.js';

const TV = 'TV Screen 55"';
const LIGHTBAR = 'Lumen Lightbar 60cm';
const tvCard = (page) => page.locator('.catalog-item[data-type="tv"]');

// A synthetic DataTransfer that carries one file, the way the OS hands a dragged file to the page
const fileTransfer = (page, text, name = 'layout.json', type = 'application/json') =>
  page.evaluateHandle(
    ({ body, fileName, mime }) => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([body], fileName, { type: mime }));
      return transfer;
    },
    { body: text, fileName: name, mime: type },
  );

const fire = (page, selector, type, dataTransfer) => page.dispatchEvent(selector, type, { dataTransfer });
const overlayText = (page) =>
  page.evaluate(() => getComputedStyle(document.querySelector('.canvas-area'), '::after').content);

const DROPPED_LAYOUT = {
  version: '1.8',
  wallWidthCm: 300,
  wallHeightCm: 250,
  wallItems: [
    { id: 'item-tv', type: 'tv', name: TV, left: 200, top: 100, width: 310, height: 180 },
    { id: 'item-bar', type: 'lightbar', name: LIGHTBAR, left: 300, top: 320, width: 150, height: 12.5 },
    { id: 'item-c', type: 'cube', left: 50, top: 400 },
  ],
};

test.describe('drag-and-drop JSON import', () => {
  test('a dragged file frosts the canvas, survives inner enter / leave pairs and loads on drop', async ({ page }) => {
    const canvas = page.locator('.canvas-area');
    const transfer = await fileTransfer(page, JSON.stringify(DROPPED_LAYOUT));
    await expect(canvas).not.toContainClass('is-file-dragging');

    await fire(page, '.canvas-area', 'dragenter', transfer);
    await expect(canvas).toContainClass('is-file-dragging');
    expect(await overlayText(page)).toBe('"Drop layout file to load"');
    const overlay = await page.evaluate(() => {
      const style = getComputedStyle(document.querySelector('.canvas-area'), '::after');
      return { border: style.borderTopStyle, pointerEvents: style.pointerEvents, blur: style.backdropFilter };
    });
    expect(overlay).toEqual({ border: 'dashed', pointerEvents: 'none', blur: 'blur(10px)' });

    // Crossing into the wall fires enter on the child before leave on the parent: no flicker
    await fire(page, '#wall', 'dragenter', transfer);
    await fire(page, '.canvas-area', 'dragleave', transfer);
    await expect(canvas).toContainClass('is-file-dragging');
    await fire(page, '#wall', 'dragover', transfer);

    await fire(page, '#wall', 'drop', transfer);
    await expect(canvas).not.toContainClass('is-file-dragging');
    await expect(page.locator('#io-status')).toHaveText('Imported 3 items.');
    expect((await getItems(page)).map((item) => item.type)).toEqual(['tv', 'lightbar', 'cube']);
    await expect(itemLocator(page, 'item-tv')).toBeVisible();
  });

  test('leaving the canvas clears the overlay and a non-JSON drop changes nothing', async ({ page }) => {
    const canvas = page.locator('.canvas-area');
    const before = await page.evaluate(() => JSON.stringify(layoutPayload()));
    const history = await historyState(page);

    const json = await fileTransfer(page, '{}');
    await fire(page, '.canvas-area', 'dragenter', json);
    await fire(page, '.canvas-area', 'dragleave', json);
    await expect(canvas).not.toContainClass('is-file-dragging');

    const image = await fileTransfer(page, 'not a layout', 'photo.png', 'image/png');
    await fire(page, '.canvas-area', 'dragenter', image);
    await fire(page, '.canvas-area', 'drop', image);
    await expect(canvas).not.toContainClass('is-file-dragging');
    await expect(page.locator('#io-status')).toHaveText('Import failed: drop a .json layout file.');
    expect(await page.evaluate(() => JSON.stringify(layoutPayload()))).toBe(before);
    expect(await historyState(page)).toEqual(history);
  });

  test('a broken file reports the same error as the Import JSON button', async ({ page }) => {
    const transfer = await fileTransfer(page, '{ nope');
    await fire(page, '.canvas-area', 'dragenter', transfer);
    await fire(page, '.canvas-area', 'drop', transfer);
    await expect(page.locator('#io-status')).toHaveText('Import failed: That file is not valid JSON.');
    await expect(page.locator('#io-status')).toContainClass('is-error');
  });

  test('a catalog drag never raises the file overlay', async ({ page }) => {
    const target = await wallPoint(page, 375, 300);
    await dragFromCatalog(page, 'Modular Cube', target, { release: false });
    await expect(page.locator('body')).toContainClass('is-placing');
    await expect(page.locator('.canvas-area')).not.toContainClass('is-file-dragging');

    // Even a stray file drag event during placement is ignored
    const transfer = await fileTransfer(page, JSON.stringify(DROPPED_LAYOUT));
    await fire(page, '.canvas-area', 'dragenter', transfer);
    await expect(page.locator('.canvas-area')).not.toContainClass('is-file-dragging');

    await page.mouse.up();
    await expect(page.locator('body')).not.toContainClass('is-placing');
    expect((await getItems(page)).map((item) => item.type)).toEqual(['shelf', 'poster', 'cube']);
  });
});

test.describe('TV screen and lightbar', () => {
  test(`mounts a ${TV} as a free, unlit room feature that blocks the wall`, async ({ page }) => {
    await expect(tvCard(page)).toHaveAttribute('data-name', TV);
    await tvCard(page).click();

    expect(await selectedItem(page)).toMatchObject({
      type: 'tv',
      name: TV,
      price: 0,
      width: 310,
      height: 180,
      depth: 8,
      finish: null,
      ledEnabled: false,
    });
    const id = (await selectedItem(page)).id;
    await expect(itemLocator(page, id)).toContainClass('feature');
    await expect(itemLocator(page, id)).toContainClass('obstacle');
    // Obstacles join the bottom of the stack, like doors and windows
    expect((await getItems(page))[0].type).toBe('tv');
    await expect(page.locator('#total-price')).toHaveText('$70.00');
    await expect(page.locator('#edit-depth-cm')).toHaveValue('8');

    const look = await page.evaluate(
      (itemId) => getComputedStyle(getItemElement(itemId)).backgroundColor,
      id,
    );
    expect(look).toBe('rgb(7, 9, 13)');
  });

  test(`mounts a ${LIGHTBAR} that glows in the corner lamp color`, async ({ page }) => {
    const card = page.locator(`.catalog-item[data-name="${LIGHTBAR}"]`);
    await expect(card.locator('.item-price-tag')).toHaveText('$45');
    await card.click();

    expect(await selectedItem(page)).toMatchObject({
      type: 'lightbar',
      name: LIGHTBAR,
      price: 45,
      width: 150,
      height: 12.5,
      depth: 5,
      finish: 'black',
      ledEnabled: true,
    });
    await expect(page.locator('#edit-width-cm')).toHaveValue('60');
    await expect(page.locator('#edit-height-cm')).toHaveValue('5');
    await expect(page.locator('#total-price')).toHaveText('$115.00');

    const id = (await selectedItem(page)).id;
    await page.locator('#corner-color-picker').fill('#22c55e');
    // The glow eases between colors, so it is read once it settles
    await expect
      .poll(() => page.evaluate((itemId) => getComputedStyle(getItemElement(itemId), '::before').boxShadow, id))
      .toContain('rgb(34, 197, 94)');
    const diffuser = await page.evaluate((itemId) => {
      const style = getComputedStyle(getItemElement(itemId), '::after');
      return { color: style.backgroundColor, horizontal: parseFloat(style.width) > parseFloat(style.height) };
    }, id);
    expect(diffuser).toEqual({ color: 'rgb(34, 197, 94)', horizontal: true });
  });

  test('the lightbar adds its 60 cm strip and two anchors to the hardware kit', async ({ page }) => {
    await loadLayout(page, { items: [wallItem('item-bar', 'lightbar', 100, 100), wallItem('item-tv', 'tv', 300, 200)] });
    await page.click('#view-spec-btn');
    await expect(page.locator('#kit-led-strip')).toHaveText('0.6 m');
    await expect(page.locator('#kit-wall-anchors')).toHaveText('2 anchors');
  });

  test('files saved before v2.5 still load unchanged next to the new types', async ({ page }) => {
    await loadLayout(page, {
      version: '1.7',
      items: [wallItem('item-a', 'cube', 100, 100), wallItem('item-w', 'window', 400, 50)],
    });
    expect((await getItems(page)).map(({ type, depth, price }) => ({ type, depth, price }))).toEqual([
      { type: 'cube', depth: 35, price: 30 },
      { type: 'window', depth: 0, price: 0 },
    ]);
  });
});

test.describe('collision x-ray', () => {
  const layout = {
    items: [
      wallItem('item-tv', 'tv', 200, 100),
      wallItem('item-s', 'shelf', 0, 450),
      wallItem('item-c', 'cube', 600, 450),
    ],
  };

  test('dragging a Floating Shelf over the TV turns it red and x-rays the TV until the drop', async ({ page }) => {
    await loadLayout(page, layout);
    const shelf = itemLocator(page, 'item-s');
    const tv = itemLocator(page, 'item-tv');
    const shelfBox = await shelf.boundingBox();
    const tvBox = await tv.boundingBox();

    await dragBy(
      page,
      'item-s',
      Math.round(tvBox.x + tvBox.width / 2 - (shelfBox.x + shelfBox.width / 2)),
      Math.round(tvBox.y + tvBox.height / 2 - (shelfBox.y + shelfBox.height / 2)),
      { hold: true },
    );
    await expect(shelf).toContainClass('colliding');
    await expect(tv).toContainClass('is-xray-target');
    await expect(itemLocator(page, 'item-c')).not.toContainClass('is-xray-target');
    await expect(shelf).not.toContainClass('is-xray-target');
    const glow = await page.evaluate(() => {
      const style = getComputedStyle(getItemElement('item-tv'));
      return { shadow: style.boxShadow, animation: style.animationName };
    });
    expect(glow.shadow).toContain('rgb(239, 68, 68)');
    expect(glow.animation).toBe('pulse-red');

    // Back off the TV mid-drag: the collision ends and so does the x-ray
    await page.mouse.move(shelfBox.x + shelfBox.width / 2, shelfBox.y + shelfBox.height / 2, { steps: 6 });
    await nextFrame(page);
    await expect(shelf).not.toContainClass('colliding');
    await expect(tv).not.toContainClass('is-xray-target');

    // Drop it on the TV: still red at rest, but the x-ray only lives while the pointer holds the piece
    await page.mouse.move(tvBox.x + tvBox.width / 2, tvBox.y + tvBox.height / 2, { steps: 6 });
    await nextFrame(page);
    await expect(tv).toContainClass('is-xray-target');
    await page.mouse.up();
    await expect(shelf).toContainClass('colliding');
    await expect(page.locator('.is-xray-target')).toHaveCount(0);
  });

  test('a resize that runs into a neighbour x-rays it until the grip is released', async ({ page }) => {
    await loadLayout(page, { items: [wallItem('item-a', 'cube', 100, 100), wallItem('item-b', 'cube', 250, 100)] });
    await selectItemById(page, 'item-a');
    const scale = await page.evaluate(() => viewScale);

    await dragHandle(page, 'item-a', 'e', Math.round(100 * scale), 0, { hold: true });
    await expect(itemLocator(page, 'item-a')).toContainClass('colliding');
    await expect(itemLocator(page, 'item-b')).toContainClass('is-xray-target');

    await page.mouse.up();
    await expect(page.locator('.is-xray-target')).toHaveCount(0);
  });

  test('resting overlaps and room features sharing space never x-ray', async ({ page }) => {
    await loadLayout(page, {
      items: [
        wallItem('item-tv', 'tv', 200, 100),
        wallItem('item-s', 'shelf', 200, 150),
        wallItem('item-sock', 'socket', 220, 145),
      ],
    });
    await expect(itemLocator(page, 'item-s')).toContainClass('colliding');
    await expect(page.locator('.is-xray-target')).toHaveCount(0);

    // A socket dragged across the TV may share its space, so nothing lights up
    await dragBy(page, 'item-sock', 10, 0, { hold: true });
    await expect(itemLocator(page, 'item-sock')).toContainClass('colliding');
    await expect(itemLocator(page, 'item-s')).toContainClass('is-xray-target');
    await expect(itemLocator(page, 'item-tv')).not.toContainClass('is-xray-target');
    await page.mouse.up();
    await expect(page.locator('.is-xray-target')).toHaveCount(0);
  });
});
