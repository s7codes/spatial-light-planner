import { test, expect } from './support/fixtures.js';
import {
  getItem,
  historyState,
  isModalWithFocus,
  loadLayout,
  selectItemById,
  selectedItem,
  wallItem,
} from './support/planner.js';

const SPEC_LAYOUT = {
  items: [
    wallItem('item-s1', 'shelf', 100, 380),
    wallItem('item-s2', 'shelf', 450, 380),
    wallItem('item-s3', 'shelf', 100, 450, { finish: 'oak' }),
    wallItem('item-p', 'poster', 300, 100),
    wallItem('item-st', 'storage', 500, 200),
  ],
};

const EXPECTED_MARKDOWN = [
  '# Spatial Studio Spec Sheet',
  '',
  'Wall: 300 x 250 cm | Items: 5 | Total: $215.00',
  '',
  '## Bill of Materials',
  '',
  '| Item | Dimensions | Finish | Qty | Unit Price | Subtotal |',
  '| :--- | :--- | :--- | ---: | ---: | ---: |',
  '| Compact Storage | 75 x 38 cm | Walnut | 1 | $55.00 | $55.00 |',
  '| Floating Shelf | 110 x 8 cm | Oak | 1 | $45.00 | $45.00 |',
  '| Floating Shelf | 110 x 8 cm | Walnut | 2 | $45.00 | $90.00 |',
  '| Poster Frame | 50 x 70 cm | Black | 1 | $25.00 | $25.00 |',
  '| **Total** | | | **5** | | **$215.00** |',
  '',
  '## Mounting & Drilling Coordinates',
  '',
  "Distances in cm from the left wall edge, the ceiling, and the floor to the item's left, top, and bottom edges.",
  '',
  '| Item | Size (W x H) | From Left (X) | From Ceiling (Y) | From Floor (Bottom Edge) |',
  '| :--- | :--- | ---: | ---: | ---: |',
  '| Floating Shelf | 110 x 8 cm | 40 cm | 152 cm | 90 cm |',
  '| Floating Shelf | 110 x 8 cm | 40 cm | 180 cm | 62 cm |',
  '| Poster Frame | 50 x 70 cm | 120 cm | 40 cm | 140 cm |',
  '| Floating Shelf | 110 x 8 cm | 180 cm | 152 cm | 90 cm |',
  '| Compact Storage | 75 x 38 cm | 200 cm | 80 cm | 132 cm |',
].join('\n');

const tableRows = (page, selector) =>
  page.evaluate(
    (rowSelector) =>
      [...document.querySelectorAll(rowSelector)].map((row) => [...row.cells].map((cell) => cell.textContent.trim())),
    selector,
  );

const isSpecOpen = (page) => page.evaluate(() => specModal.open);

// Records what the page writes to the clipboard without needing clipboard permissions
const stubClipboard = (page) =>
  page.evaluate(() => {
    window.copiedText = null;
    navigator.clipboard.writeText = async (text) => {
      window.copiedText = text;
    };
  });

test.describe('spec sheet', () => {
  test.beforeEach(async ({ page }) => {
    await loadLayout(page, SPEC_LAYOUT);
    await selectItemById(page, 'item-s1');
    await page.click('#view-spec-btn');
  });

  test('opens as a modal dialog with focus inside it', async ({ page }) => {
    expect(await isModalWithFocus(page, '#spec-modal')).toBe(true);
    await expect(page.locator('#spec-modal-subtitle')).toHaveText('Wall 300 x 250 cm | 5 items');

    const box = await page.locator('#spec-modal').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(1400);
    expect(box.y + box.height).toBeLessThanOrEqual(820);
  });

  test('groups identical items into a priced bill of materials', async ({ page }) => {
    expect(await tableRows(page, '#bom-body tr')).toEqual([
      ['Compact Storage', '75 x 38 cm', 'Walnut', '1', '$55.00', '$55.00'],
      ['Floating Shelf', '110 x 8 cm', 'Oak', '1', '$45.00', '$45.00'],
      ['Floating Shelf', '110 x 8 cm', 'Walnut', '2', '$45.00', '$90.00'],
      ['Poster Frame', '50 x 70 cm', 'Black', '1', '$25.00', '$25.00'],
    ]);

    const footer = await page.evaluate(() =>
      [...document.querySelectorAll('#bom-foot tr > *')].map((cell) => cell.textContent.trim()),
    );
    expect(footer).toEqual(['Total', '5', '', '$215.00']);
    await expect(page.locator('#total-price')).toHaveText('$215.00');
  });

  test('lists drilling coordinates left to right with the bottom edge measured from the floor', async ({ page }) => {
    expect(await tableRows(page, '#mounting-body tr')).toEqual([
      ['Floating Shelf', '110 x 8 cm', '40 cm', '152 cm', '90 cm'],
      ['Floating Shelf', '110 x 8 cm', '40 cm', '180 cm', '62 cm'],
      ['Poster Frame', '50 x 70 cm', '120 cm', '40 cm', '140 cm'],
      ['Floating Shelf', '110 x 8 cm', '180 cm', '152 cm', '90 cm'],
      ['Compact Storage', '75 x 38 cm', '200 cm', '80 cm', '132 cm'],
    ]);
  });

  test('editor shortcuts do nothing while the dialog is open', async ({ page }) => {
    const before = await historyState(page);

    for (const key of ['Delete', 'Backspace', 'l', 'ArrowRight', 'Control+z', 'Control+d']) {
      await page.keyboard.press(key);
    }

    expect(await isSpecOpen(page)).toBe(true);
    expect(await historyState(page)).toEqual(before);
    expect(await getItem(page, 'item-s1')).toMatchObject({ left: 100, locked: false });
    expect(await page.evaluate(() => wallItems.length)).toBe(5);
  });

  test('copies both tables as plain ASCII Markdown', async ({ page }) => {
    await stubClipboard(page);

    await page.click('#copy-markdown-btn');

    await expect(page.locator('#copy-markdown-btn')).toHaveText('Copied to Clipboard');
    const markdown = await page.evaluate(() => window.copiedText);
    expect(markdown).toBe(EXPECTED_MARKDOWN);
    expect(markdown).toMatch(/^[\x00-\x7f]*$/);
    await expect(page.locator('#copy-markdown-btn')).toHaveText('Copy as Markdown');
  });

  test('falls back to a selection copy when the Clipboard API is refused', async ({ page }) => {
    await page.evaluate(() => {
      navigator.clipboard.writeText = () => Promise.reject(new Error('denied'));
    });

    await page.click('#copy-markdown-btn');

    // Headless browsers may or may not allow execCommand('copy'); either outcome must be reported cleanly
    await expect(page.locator('#copy-markdown-btn')).toHaveText(/^(Copied to Clipboard|Copy failed)$/);
    await expect(page.locator('.clipboard-buffer')).toHaveCount(0);
    await expect(page.locator('#copy-markdown-btn')).toBeFocused();
  });

  test('Escape closes the dialog, returns focus and resets the copy label', async ({ page }) => {
    await stubClipboard(page);
    await page.click('#copy-markdown-btn');

    await page.keyboard.press('Escape');
    expect(await isSpecOpen(page)).toBe(false);
    await expect(page.locator('#view-spec-btn')).toBeFocused();
    expect(await selectedItem(page)).toMatchObject({ id: 'item-s1' });

    await page.click('#view-spec-btn');
    await expect(page.locator('#copy-markdown-btn')).toHaveText('Copy as Markdown');
  });

  test('only a real backdrop click or the Close button dismisses it', async ({ page }) => {
    await page.click('#bom-title');
    expect(await isSpecOpen(page)).toBe(true);

    const cell = await page.locator('#mounting-body td').first().boundingBox();
    await page.mouse.move(cell.x + 5, cell.y + 5);
    await page.mouse.down();
    await page.mouse.move(5, 5, { steps: 4 });
    await page.mouse.up();
    expect(await isSpecOpen(page)).toBe(true);

    await page.mouse.click(5, 5);
    expect(await isSpecOpen(page)).toBe(false);

    await page.click('#view-spec-btn');
    await page.click('#close-spec-btn');
    expect(await isSpecOpen(page)).toBe(false);
  });
});

test.describe('spec sheet content edge cases', () => {
  test('escapes item names in the table and in Markdown', async ({ page }) => {
    await loadLayout(page, { items: [wallItem('item-q', 'shelf', 0, 0, { name: 'Shelf | A <b>x</b>' })] });
    await page.click('#view-spec-btn');

    await expect(page.locator('#bom-body b')).toHaveCount(0);
    await expect(page.locator('#bom-body td').first()).toHaveText('Shelf | A <b>x</b>');

    await stubClipboard(page);
    await page.click('#copy-markdown-btn');
    await expect(page.locator('#copy-markdown-btn')).toHaveText('Copied to Clipboard');
    expect(await page.evaluate(() => window.copiedText)).toContain('| Shelf \\| A <b>x</b> | 110 x 8 cm |');
  });

  test('an empty wall shows friendly empty rows and a $0.00 total', async ({ page }) => {
    await loadLayout(page, { items: [] });
    await page.click('#view-spec-btn');

    await expect(page.locator('#bom-body')).toContainText('No items on the wall yet.');
    await expect(page.locator('#mounting-body')).toContainText('No items to mount yet.');
    await expect(page.locator('#spec-modal .grand-total')).toHaveText('$0.00');
  });

  test('From Floor follows the current wall height', async ({ page }) => {
    await loadLayout(page, { wallHeightCm: 280, items: [wallItem('item-s', 'shelf', 0, 380)] });
    await page.click('#view-spec-btn');

    // 280 cm wall - 152 cm from the ceiling - 8 cm shelf height
    await expect(page.locator('#mounting-body tr').first().locator('td').nth(4)).toHaveText('120 cm');
  });
});
