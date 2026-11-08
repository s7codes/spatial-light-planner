import { test, expect } from './support/fixtures.js';
import {
  blurActiveElement,
  downloadFrom,
  getItem,
  getItems,
  glowShadow,
  historyState,
  importFile,
  itemLocator,
  loadLayout,
  readPixels,
  selectItemById,
  wallItem,
  wallScreenPixels,
} from './support/planner.js';

const CYAN = '#22d3ee';
const CYAN_RGB = 'rgb(34, 211, 238)';
const ACCENT_RGB = 'rgb(255, 157, 66)';

const LED_LAYOUT = {
  items: [
    wallItem('item-1', 'shelf', 120, 380),
    wallItem('item-spot', 'spotlight', 520, 60),
    wallItem('item-lamp', 'corner-lamp', 650, 260),
  ],
};

const inlineColor = (page, id) =>
  page.evaluate((itemId) => getItemElement(itemId).style.getPropertyValue('--item-color'), id);

const afterLayer = (page, id, property) =>
  page.evaluate(([itemId, key]) => getComputedStyle(getItemElement(itemId), '::after')[key], [id, property]);

async function pickItemColor(page, id, color) {
  await selectItemById(page, id);
  await page.locator('#item-led-color').fill(color);
}

test.describe('per-item LED color', () => {
  test.beforeEach(async ({ page }) => {
    await loadLayout(page, LED_LAYOUT);
  });

  test('an independent color recolors only that item, live and without a rebuild', async ({ page }) => {
    await selectItemById(page, 'item-spot');
    await expect(page.locator('#item-led-hex')).toHaveText('Global');
    await expect(page.locator('#item-led-color')).toHaveValue('#ff9d42');
    await expect(page.locator('#item-led-reset')).toBeDisabled();
    await page.evaluate(() => (getItemElement('item-spot').dataset.mark = 'kept'));

    await page.locator('#item-led-color').fill(CYAN);

    expect(await getItem(page, 'item-spot')).toMatchObject({ itemLedColor: CYAN });
    expect(await inlineColor(page, 'item-spot')).toBe(CYAN);
    expect(await page.evaluate(() => getItemElement('item-spot').dataset.mark)).toBe('kept');
    await expect(page.locator('#item-led-hex')).toHaveText('#22D3EE');
    await expect(page.locator('#item-led-reset')).toBeEnabled();

    await expect.poll(() => glowShadow(page, 'item-spot')).toContain(CYAN_RGB);
    expect(await afterLayer(page, 'item-spot', 'backgroundImage')).toContain(CYAN_RGB);
    expect(await glowShadow(page, 'item-1')).toContain(ACCENT_RGB);
    expect(await inlineColor(page, 'item-1')).toBe('');
  });

  test('a pick is one undo step and Use Global hands the item back to the shared color', async ({ page }) => {
    await selectItemById(page, 'item-spot');
    const before = await historyState(page);

    await page.locator('#item-led-color').fill(CYAN);
    expect((await historyState(page)).index).toBe(before.index + 1);

    await page.click('#item-led-reset');

    expect(await getItem(page, 'item-spot')).toMatchObject({ itemLedColor: null });
    expect(await inlineColor(page, 'item-spot')).toBe('');
    await expect(page.locator('#item-led-hex')).toHaveText('Global');
    await expect(page.locator('#item-led-color')).toHaveValue('#ff9d42');
    await expect(page.locator('#item-led-reset')).toBeDisabled();
    expect((await historyState(page)).index).toBe(before.index + 2);

    await blurActiveElement(page);
    await page.keyboard.press('Control+z');
    expect(await getItem(page, 'item-spot')).toMatchObject({ itemLedColor: CYAN });
    expect(await inlineColor(page, 'item-spot')).toBe(CYAN);
    await expect(page.locator('#item-led-hex')).toHaveText('#22D3EE');

    await page.keyboard.press('Control+z');
    expect(await getItem(page, 'item-spot')).toMatchObject({ itemLedColor: null });
  });

  test('items without their own color keep following the global pickers, the corner lamp included', async ({
    page,
  }) => {
    await pickItemColor(page, 'item-spot', CYAN);
    await pickItemColor(page, 'item-lamp', '#ef4444');

    await page.locator('#accent-color-picker').fill('#00ff00');
    await page.locator('#corner-color-picker').fill('#11998e');

    await expect.poll(() => glowShadow(page, 'item-1')).toContain('rgb(0, 255, 0)');
    await expect.poll(() => glowShadow(page, 'item-spot')).toContain(CYAN_RGB);
    expect(await afterLayer(page, 'item-lamp', 'backgroundColor')).toBe('rgb(239, 68, 68)');
    await expect.poll(() => glowShadow(page, 'item-lamp')).toContain('rgb(239, 68, 68)');

    await selectItemById(page, 'item-1');
    await expect(page.locator('#item-led-color')).toHaveValue('#00ff00');
    await expect(page.locator('#item-led-hex')).toHaveText('Global');
    await expect(page.locator('#item-led-hex')).toHaveAttribute('title', /#00FF00/);
  });

  test('the PNG export paints the per-item glow, wash and diffuser like the live wall', async ({ page }) => {
    await pickItemColor(page, 'item-spot', CYAN);
    await pickItemColor(page, 'item-lamp', '#ef4444');
    await selectItemById(page, null);
    await expect.poll(() => glowShadow(page, 'item-spot')).toContain(CYAN_RGB);
    await expect.poll(() => glowShadow(page, 'item-lamp')).toContain('rgb(239, 68, 68)');

    // Wash below the fixture, glow just above it (its label pill covers the sides), and the lamp diffuser
    const points = [
      [540, 130],
      [540, 52],
      [675, 320],
    ];
    const screen = await wallScreenPixels(page, points);
    const { buffer } = await downloadFrom(page, '#export-png-btn');
    const [wash, glow, diffuser] = await readPixels(page, buffer, points, 2);

    [wash, glow, diffuser].forEach((pixel, i) => expect(pixel).toBeNearColor(screen[i], 8));
    // A cyan wash and glow lift green and blue over the dark wall, never red
    for (const pixel of [wash, glow]) {
      expect(pixel[2]).toBeGreaterThan(pixel[0] + 10);
      expect(pixel[1]).toBeGreaterThan(pixel[0] + 10);
    }
    expect(diffuser).toBeNearColor([239, 68, 68], 10);
  });

  test('a locked item keeps its color controls disabled', async ({ page }) => {
    await pickItemColor(page, 'item-spot', CYAN);
    await blurActiveElement(page);

    await page.keyboard.press('l');

    await expect(page.locator('#item-led-color')).toBeDisabled();
    await expect(page.locator('#item-led-reset')).toBeDisabled();
  });

  test('per-item colors travel through export, duplicate and reload', async ({ page }) => {
    await pickItemColor(page, 'item-spot', CYAN);
    await blurActiveElement(page);

    const { buffer } = await downloadFrom(page, '#export-json-btn');
    const file = JSON.parse(buffer.toString('utf8'));
    expect(file.version).toBe('1.3');
    expect(Object.fromEntries(file.wallItems.map((item) => [item.id, item.itemLedColor]))).toEqual({
      'item-1': null,
      'item-spot': CYAN,
      'item-lamp': null,
    });

    await page.keyboard.press('Control+d');
    const copy = (await getItems(page)).at(-1);
    expect(copy).toMatchObject({ type: 'spotlight', itemLedColor: CYAN });
    expect(await inlineColor(page, copy.id)).toBe(CYAN);

    await page.reload();
    expect(await getItem(page, 'item-spot')).toMatchObject({ itemLedColor: CYAN });
    expect(await inlineColor(page, 'item-spot')).toBe(CYAN);
  });

  test('older files load with global lighting and malformed colors are dropped', async ({ page }) => {
    let status = await importFile(
      page,
      'legacy.json',
      JSON.stringify({ version: '1.0', wallItems: [{ id: 'item-old', type: 'shelf', left: 0, top: 0 }] }),
    );
    await expect(status).toHaveText('Imported 1 item.');
    expect(await getItem(page, 'item-old')).toMatchObject({ itemLedColor: null });

    status = await importFile(
      page,
      'colors.json',
      JSON.stringify({
        version: '1.3',
        wallItems: [
          { id: 'item-x', type: 'cube', left: 0, top: 0, itemLedColor: 'red' },
          { id: 'item-y', type: 'cube', left: 200, top: 0, itemLedColor: '#ABCDEF' },
          { id: 'item-z', type: 'cube', left: 400, top: 0, itemLedColor: '#abc; background: red' },
        ],
      }),
    );
    await expect(status).toHaveText('Imported 3 items.');
    expect((await getItems(page)).map((item) => item.itemLedColor)).toEqual([null, '#abcdef', null]);
    await expect(itemLocator(page, 'item-z')).not.toHaveAttribute('style', /background/);
    expect(await inlineColor(page, 'item-y')).toBe('#abcdef');
  });
});
