import { test, expect } from './support/fixtures.js';
import {
  blurActiveElement,
  clickWallAt,
  downloadFrom,
  getItem,
  getItems,
  historyState,
  importFile,
  itemLocator,
  loadLayout,
  readPixels,
  selectedItem,
  selectItemById,
  wallItem,
  wallScreenPixels,
} from './support/planner.js';

const PAPER = [253, 230, 138];
const editor = (page) => page.locator('.wall-item.note .note-editor');
const noteLabel = (page, id) => itemLocator(page, id).locator('.item-label');

// Rows of the note that hold any dark text pixel, merged into bands: one band per rendered line
function textBands(pixels, columns, top) {
  const rows = [];
  for (let start = 0; start < pixels.length; start += columns) {
    rows.push(pixels.slice(start, start + columns).some(([r, g, b]) => r + g + b < 360));
  }
  const bands = [];
  rows.forEach((dark, index) => {
    const last = bands.at(-1);
    if (dark && last && last.end === index - 1) last.end = index;
    else if (dark) bands.push({ start: index, end: index });
  });
  return bands.map(({ start, end }) => ({ start: top + start, end: top + end }));
}

function noteGrid(left, top, width, height) {
  const points = [];
  for (let y = top; y < top + height; y++) {
    for (let x = left + 4; x < left + width - 4; x += 2) points.push([x, y]);
  }
  return { points, columns: Math.ceil((width - 8) / 2) };
}

test.describe('text notes', () => {
  test('a note mounts from Room Features at $0 and shows its prompt on the wall', async ({ page }) => {
    await page.click('.catalog-item[data-name="Text Note"]');

    const note = await selectedItem(page);
    expect(note).toMatchObject({
      type: 'note',
      name: 'Text Note',
      price: 0,
      width: 150,
      height: 75,
      finish: null,
      ledEnabled: false,
      itemLedColor: null,
      text: 'Double-click to edit',
    });
    expect((await getItems(page)).at(-1).id).toBe(note.id);
    await expect(noteLabel(page, note.id)).toHaveText('Double-click to edit');
    await expect(page.locator('#total-price')).toHaveText('$70.00');
    await expect(page.locator('#note-text')).toHaveValue('Double-click to edit');
    for (const selector of ['#led-toggle-btn', '#item-led-color', '.btn-finish']) {
      await expect(page.locator(selector)).toHaveCount(0);
    }
  });

  test('double-click edits in place; Escape or clicking away saves one undo step each', async ({ page }) => {
    await loadLayout(page, { items: [wallItem('item-n', 'note', 100, 100)] });
    const before = await historyState(page);

    await page.dblclick('.wall-item[data-id="item-n"]');
    await expect(editor(page)).toBeFocused();
    await expect(editor(page)).toHaveValue('Double-click to edit');
    // The prompt is selected, so typing replaces it; shortcut letters stay in the text
    await page.keyboard.type('TV center, router left');
    await page.keyboard.press('Escape');

    await expect(editor(page)).toHaveCount(0);
    await expect(noteLabel(page, 'item-n')).toHaveText('TV center, router left');
    expect(await getItem(page, 'item-n')).toMatchObject({ text: 'TV center, router left', rotation: 0, locked: false });
    await expect(page.locator('#layer-list [data-layer="item:item-n"] .layer-text')).toHaveText(
      'Note: TV center, router left',
    );
    expect((await historyState(page)).index).toBe(before.index + 1);

    await page.dblclick('.wall-item[data-id="item-n"]');
    await page.keyboard.type('Shelf line');
    await page.keyboard.press('Enter');
    await page.keyboard.type('at 140 cm');
    await clickWallAt(page, 600, 500);

    expect(await getItem(page, 'item-n')).toMatchObject({ text: 'Shelf line\nat 140 cm' });
    expect((await historyState(page)).index).toBe(before.index + 2);

    await page.keyboard.press('Control+z');
    expect(await getItem(page, 'item-n')).toMatchObject({ text: 'TV center, router left' });
  });

  test('saving an unchanged or emptied note costs no history step and brings the prompt back', async ({ page }) => {
    await loadLayout(page, { items: [wallItem('item-n', 'note', 100, 100, { text: 'Router' })] });
    const before = await historyState(page);

    await page.dblclick('.wall-item[data-id="item-n"]');
    await page.keyboard.press('Escape');
    expect(await historyState(page)).toEqual(before);

    await page.dblclick('.wall-item[data-id="item-n"]');
    await page.keyboard.press('Delete');
    await page.keyboard.press('Escape');
    expect(await getItem(page, 'item-n')).toMatchObject({ text: 'Double-click to edit' });
    expect(await getItems(page)).toHaveLength(1);
  });

  test('a locked note keeps its editor shut, and the Inspector field edits the text as well', async ({ page }) => {
    await loadLayout(page, { items: [wallItem('item-n', 'note', 100, 100, { locked: true })] });

    await page.dblclick('.wall-item[data-id="item-n"]');
    await expect(editor(page)).toHaveCount(0);
    await expect(page.locator('#note-text')).toBeDisabled();
    await expect(page.locator('#lock-note')).toContainClass('is-flashing');

    await page.keyboard.press('l');
    await page.fill('#note-text', 'Line one\nLine two');
    await expect(noteLabel(page, 'item-n')).toHaveText('Line one\nLine two');
    await blurActiveElement(page);

    expect(await getItem(page, 'item-n')).toMatchObject({ text: 'Line one\nLine two' });
  });

  test('notes never collide, skip the attic slope, and stay off the spec sheet', async ({ page }) => {
    await loadLayout(page, {
      atticSlope: true,
      items: [
        wallItem('item-c', 'cube', 100, 100),
        wallItem('item-n', 'note', 120, 120),
        wallItem('item-high', 'note', 590, 10),
      ],
    });

    for (const id of ['item-c', 'item-n', 'item-high']) {
      await expect(itemLocator(page, id)).not.toContainClass('colliding');
    }
    await selectItemById(page, 'item-high');
    await expect(page.locator('#warning-attic')).toBeHidden();

    await page.click('#view-spec-btn');
    await expect(page.locator('#spec-modal-subtitle')).toHaveText('Wall 300 x 250 cm | 1 item');
    await expect(page.locator('#bom-body tr')).toHaveCount(1);
  });

  test('the PNG export paints the paper and wraps the text on the same lines as the wall', async ({ page }) => {
    await loadLayout(page, {
      items: [
        wallItem('item-one', 'note', 100, 100, { width: 300, height: 100, text: 'Router here' }),
        wallItem('item-wrap', 'note', 450, 100, {
          width: 150,
          height: 150,
          text: 'Keep this wall clear for the wardrobe doors',
        }),
      ],
    });

    const single = noteGrid(100, 100, 300, 100);
    const wrapped = noteGrid(450, 100, 150, 150);
    const points = [[110, 112], ...single.points, ...wrapped.points];
    const screen = await wallScreenPixels(page, points);
    const { buffer } = await downloadFrom(page, '#export-png-btn');
    const exported = await readPixels(page, buffer, points, 2);

    expect(exported[0]).toBeNearColor(PAPER, 6);
    expect(exported[0]).toBeNearColor(screen[0], 6);

    const split = 1 + single.points.length;
    const cases = [
      [screen.slice(1, split), exported.slice(1, split), single, 100],
      [screen.slice(split), exported.slice(split), wrapped, 100],
    ];
    const extents = [];
    for (const [onScreen, inPng, grid, top] of cases) {
      const expected = textBands(onScreen, grid.columns, top);
      const actual = textBands(inPng, grid.columns, top);
      expect(actual.length).toBe(expected.length);
      actual.forEach((band, i) => {
        expect(Math.abs(band.start - expected[i].start)).toBeLessThanOrEqual(2);
        expect(Math.abs(band.end - expected[i].end)).toBeLessThanOrEqual(2);
      });
      extents.push(actual.at(-1).end - actual[0].start);
    }
    // Descenders can touch the next line's ascenders, so the wrap shows as height rather than band count
    expect(extents[0]).toBeLessThan(18);
    expect(extents[1]).toBeGreaterThan(extents[0] + 10);
  });

  test('note text is cleaned on import and travels through export with groups and hidden flags', async ({ page }) => {
    const status = await importFile(
      page,
      'notes.json',
      JSON.stringify({
        version: '1.5',
        wallItems: [
          wallItem('item-a', 'note', 0, 0, { text: 'Bell\u0007 ring\r\nnext line', price: 40, finish: 'oak' }),
          wallItem('item-b', 'note', 200, 0, { text: '   ' }),
          wallItem('item-c', 'note', 400, 0, { text: 'x'.repeat(300), hidden: true }),
        ],
      }),
    );
    await expect(status).toHaveText('Imported 3 items.');

    const [a, b, c] = await getItems(page);
    expect(a).toMatchObject({ text: 'Bell ring\nnext line', price: 0, finish: null });
    expect(b.text).toBe('Double-click to edit');
    expect(c.text).toHaveLength(160);
    expect(c.hidden).toBe(true);
    await expect(itemLocator(page, 'item-c')).toContainClass('is-hidden');

    const { buffer } = await downloadFrom(page, '#export-json-btn');
    const file = JSON.parse(buffer.toString('utf8'));
    expect(file.wallItems[0]).toMatchObject({
      type: 'note',
      text: 'Bell ring\nnext line',
      groupId: null,
      hidden: false,
    });
  });
});
