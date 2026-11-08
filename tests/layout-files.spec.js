import { test, expect } from './support/fixtures.js';
import {
  downloadFrom,
  getItems,
  historyState,
  importFile,
  loadLayout,
  selectedItem,
  setWallSize,
  wallItem,
  wallState,
} from './support/planner.js';

const layoutSnapshot = (page) =>
  page.evaluate(() =>
    JSON.stringify({
      items: wallItems,
      atticSlope: atticSlopeToggle.checked,
      accent: accentColorPicker.value,
      wall: [wallWidthCm, wallHeightCm],
    }),
  );

const lighting = (page) =>
  page.evaluate(() => ({
    atticSlope: atticSlopeToggle.checked,
    atticZoneVisible: !atticZone.hidden,
    accent: accentColorPicker.value,
    corner: cornerColorPicker.value,
    brightness: brightnessSlider.value,
  }));

const MESSY_FILE = {
  version: '0.7',
  atticSlope: true,
  accentColor: '#00F2FE',
  cornerColor: 'not-a-color',
  brightness: '140',
  wallItems: [
    { type: 'shelf', name: 'Desk Shelf', price: '50', left: 701, top: -40, width: 999, height: 21.3, finish: 'walnut' },
    {
      type: 'poster',
      name: '<img src=x onerror="window.injected=1">',
      price: -5,
      left: 123.4,
      top: 88.8,
      width: 125,
      height: 175,
      finish: 'gold',
    },
    { type: 'corner-lamp', left: 'abc' },
    { type: 'sofa', width: 100 },
    { id: 'dup', type: 'cube', left: 2000, top: 2000, width: 90, height: 90, finish: 'oak', price: 30 },
  ],
};

test.describe('JSON export', () => {
  test('downloads the versioned schema with wall size, flags and lighting', async ({ page }) => {
    await page.click('.wall-item[data-id="item-2"]');
    await page.keyboard.press('l');
    await setWallSize(page, { width: 333, height: 222 });
    const before = await historyState(page);

    const { name, buffer } = await downloadFrom(page, '#export-json-btn');
    const file = JSON.parse(buffer.toString('utf8'));

    expect(name).toBe('spatial-studio-layout.json');
    expect(file).toMatchObject({
      version: '1.5',
      wallWidthCm: 333,
      wallHeightCm: 222,
      atticSlope: false,
      brightness: 100,
    });
    expect(file.accentColor).toMatch(/^#[0-9a-f]{6}$/);
    expect(file.cornerColor).toMatch(/^#[0-9a-f]{6}$/);
    expect(file.wallItems.map(({ id, locked, ledEnabled }) => ({ id, locked, ledEnabled }))).toEqual([
      { id: 'item-1', locked: false, ledEnabled: true },
      { id: 'item-2', locked: true, ledEnabled: true },
    ]);
    await expect(page.locator('#io-status')).toHaveText('Layout exported.');
    expect(await historyState(page)).toEqual(before);
  });
});

test.describe('JSON import', () => {
  const REJECTED = [
    ['corrupt JSON', 'broken.json', '{"wallItems": [ {"type": "shelf"', 'Import failed: That file is not valid JSON.'],
    [
      'a file without an items array',
      'no-items.json',
      '{"version":"0.7","foo":[]}',
      'Import failed: Layout has no items array.',
    ],
    ['a top-level array', 'array.json', '[1,2,3]', 'Import failed: Unrecognized layout format.'],
    [
      'a file with only invalid items',
      'invalid.json',
      JSON.stringify({ items: [{ type: 'sofa' }, null, 'x'] }),
      'Import failed: No valid items found in this file.',
    ],
    [
      'a file over 1 MB',
      'huge.json',
      JSON.stringify({ items: [], padding: 'x'.repeat(1024 * 1024) }),
      'File is too large to be a layout export.',
    ],
  ];

  for (const [description, name, content, message] of REJECTED) {
    test(`rejects ${description} and leaves the wall untouched`, async ({ page }) => {
      const before = await layoutSnapshot(page);
      const history = await historyState(page);

      const status = await importFile(page, name, content);

      await expect(status).toHaveText(message);
      await expect(status).toContainClass('is-error');
      expect(await layoutSnapshot(page)).toBe(before);
      expect(await historyState(page)).toEqual(history);
    });
  }

  test('sanitizes a messy file: clamps, snaps, falls back to catalog values and escapes names', async ({ page }) => {
    const status = await importFile(page, 'messy.json', JSON.stringify(MESSY_FILE));
    await expect(status).toHaveText('Imported 4 items, skipped 1 invalid.');
    await expect(status).toContainClass('is-success');

    const [shelf, poster, lamp, cube] = await getItems(page);
    for (const item of [shelf, poster, lamp, cube]) {
      for (const key of ['left', 'top', 'width', 'height']) expect(item[key] % 2.5).toBe(0);
      expect(item.left + item.width).toBeLessThanOrEqual(750);
      expect(item.top + item.height).toBeLessThanOrEqual(625);
    }
    expect(shelf).toMatchObject({ width: 750, left: 0, top: 0, height: 22.5, price: 50 });
    expect(poster).toMatchObject({ finish: 'black', price: 25 });
    expect(lamp).toMatchObject({ width: 50, height: 350, name: 'Corner Floor Lamp' });
    expect(cube).toMatchObject({ left: 660, top: 535 });
    expect(new Set([shelf, poster, lamp, cube].map((item) => item.id)).size).toBe(4);
    expect(cube.id).not.toBe('dup');

    expect(await page.evaluate(() => window.injected)).toBeUndefined();
    await expect(page.locator('.wall-item img')).toHaveCount(0);
    await expect(page.locator(`.wall-item[data-id="${poster.id}"] .item-label`)).toContainText('<img src=x');

    expect(await lighting(page)).toEqual({
      atticSlope: true,
      atticZoneVisible: true,
      accent: '#00f2fe',
      corner: '#8b5cf6',
      brightness: '100',
    });
    expect(await selectedItem(page)).toBeNull();
  });

  test('an import is one undo step', async ({ page }) => {
    const before = await historyState(page);
    await importFile(page, 'messy.json', JSON.stringify(MESSY_FILE));
    expect(await historyState(page)).toMatchObject({ index: before.index + 1 });

    await page.keyboard.press('Control+z');

    expect((await getItems(page)).map((item) => item.id)).toEqual(['item-1', 'item-2']);
    await expect(page.locator('#attic-slope-toggle')).not.toBeChecked();
  });

  test('round-trips its own export and accepts the same file twice in a row', async ({ page }) => {
    await page.click('.wall-item[data-id="item-1"]');
    await page.keyboard.press('ArrowLeft');
    const original = await getItems(page);
    const { buffer } = await downloadFrom(page, '#export-json-btn');
    await page.click('#reset-wall-btn');

    let status = await importFile(page, 'spatial-studio-layout.json', buffer);
    await expect(status).toHaveText('Imported 2 items.');
    expect(await getItems(page)).toEqual(original);

    status = await importFile(page, 'spatial-studio-layout.json', buffer);
    await expect(status).toHaveText('Imported 2 items.');
  });

  test('accepts the legacy items key and snaps sizes to whole centimeters', async ({ page }) => {
    const status = await importFile(
      page,
      'legacy.json',
      JSON.stringify({ items: [{ type: 'cube', left: 10, top: 10, width: 88, height: 88 }] }),
    );

    await expect(status).toHaveText('Imported 1 item.');
    expect((await getItems(page))[0]).toMatchObject({ left: 10, top: 10, width: 87.5, height: 87.5 });
  });

  test('keeps valid unique ids and regenerates duplicate or malformed ones', async ({ page }) => {
    await importFile(
      page,
      'ids.json',
      JSON.stringify({
        items: [
          { id: 'item-a', type: 'cube' },
          { id: 'item-a', type: 'cube' },
          { id: '"><b>', type: 'cube' },
        ],
      }),
    );

    const ids = (await getItems(page)).map((item) => item.id);
    expect(ids[0]).toBe('item-a');
    expect(ids[1]).not.toBe('item-a');
    expect(ids[2]).toMatch(/^item-[a-z0-9-]+$/);
    expect(new Set(ids).size).toBe(3);
  });
});

test.describe('schema compatibility', () => {
  const VERSIONS = [
    { version: '0.7', extra: {}, expected: { widthCm: 300, heightCm: 250 } },
    { version: '0.8', extra: { wallWidthCm: 280, wallHeightCm: 240 }, expected: { widthCm: 280, heightCm: 240 } },
    { version: '0.9', extra: { wallWidthCm: 260 }, expected: { widthCm: 260, heightCm: 250 } },
  ];

  for (const { version, extra, expected } of VERSIONS) {
    test(`imports a version ${version} file`, async ({ page }) => {
      await loadLayout(page, {
        version,
        ...extra,
        wallItems: [wallItem('item-v', 'cube', 100, 100, { ledEnabled: false, locked: true })],
      });

      expect(await wallState(page)).toMatchObject(expected);
      expect(await getItems(page)).toMatchObject([{ id: 'item-v', ledEnabled: false, locked: true }]);
    });
  }

  test('wall sizes are clamped to the allowed range and rounded to whole centimeters', async ({ page }) => {
    await loadLayout(page, { wallWidthCm: 9999, wallHeightCm: 'abc', items: [wallItem('item-a', 'cube', 100, 100)] });
    expect(await wallState(page)).toMatchObject({ widthCm: 400, heightCm: 250 });

    await loadLayout(page, {
      wallWidthCm: 149.6,
      wallHeightCm: '300.4',
      items: [wallItem('item-a', 'cube', 100, 100)],
    });
    expect(await wallState(page)).toMatchObject({ widthCm: 150, heightCm: 300 });
  });

  test('items are clamped to the imported wall, and undo restores the previous wall', async ({ page }) => {
    await loadLayout(page, {
      wallWidthCm: 200,
      wallHeightCm: 150,
      items: [wallItem('item-a', 'cube', 2000, 2000), wallItem('item-b', 'shelf', 0, 0, { width: 900 })],
    });

    expect(await getItems(page)).toMatchObject([
      { id: 'item-a', left: 410, top: 285 },
      { id: 'item-b', width: 500 },
    ]);

    await page.keyboard.press('Control+z');
    expect(await wallState(page)).toMatchObject({ widthCm: 300, heightCm: 250 });
  });

  test('backlight and lock flags only accept real booleans', async ({ page }) => {
    await loadLayout(page, {
      items: [
        wallItem('item-a', 'cube', 0, 0),
        wallItem('item-b', 'cube', 100, 0, { ledEnabled: 'no', locked: 'yes' }),
        wallItem('item-c', 'cube', 200, 0, { ledEnabled: false, locked: true }),
      ],
    });

    const items = await getItems(page);
    expect(items.map((item) => item.ledEnabled)).toEqual([true, true, false]);
    expect(items.map((item) => item.locked)).toEqual([false, false, true]);
  });
});
