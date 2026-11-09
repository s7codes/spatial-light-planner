import { test, expect } from './support/fixtures.js';
import { downloadFrom, getItem, importFile, loadLayout, selectedItem, wallItem } from './support/planner.js';

const QUOTE_LAYOUT = {
  items: [
    wallItem('item-s1', 'shelf', 100, 380),
    wallItem('item-s2', 'shelf', 450, 380),
    wallItem('item-s3', 'shelf', 100, 450, { finish: 'oak' }),
    wallItem('item-p', 'poster', 300, 100),
    wallItem('item-st', 'storage', 500, 200),
    wallItem('item-door', 'door', 0, 125),
  ],
};

test.describe('Lumen splash screen', () => {
  test.use({ splash: true });

  test('covers the studio on load and fades out for good after Enter Studio', async ({ page }) => {
    const splash = page.locator('#splash-screen');
    await expect(splash).toBeVisible();
    await expect(splash.locator('.splash-wordmark')).toHaveText('Lumen');
    await expect(splash).toContainText('Professional Spatial Lighting & Shelving Planner');
    expect(await page.evaluate(() => document.body.firstElementChild.id)).toBe('splash-screen');

    // While the splash is up, studio shortcuts stay inert
    await page.keyboard.press('Delete');
    expect(await page.evaluate(() => wallItems.length)).toBe(2);

    await page.click('#enter-studio-btn');
    await expect(splash).toHaveClass(/fade-out/);
    expect(await splash.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');

    await expect(splash).toBeHidden();
    expect(await splash.evaluate((el) => el.hidden)).toBe(true);

    await page.click('.catalog-item[data-type="cube"]');
    expect(await page.evaluate(() => wallItems.length)).toBe(3);
  });
});

test.describe('branded quote', () => {
  test('lists the billable items and adds 27% VAT to the layout total', async ({ page }) => {
    await loadLayout(page, QUOTE_LAYOUT);
    await expect(page.locator('#total-price')).toHaveText('$215.00');

    await page.click('#generate-quote-btn');
    const modal = page.locator('#quote-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('#quote-modal-title')).toHaveText('Official Quote');
    await expect(modal.locator('.quote-company')).toHaveText('Lumen Spatial Design Kft.');

    const today = await page.evaluate(() =>
      new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    );
    await expect(page.locator('#quote-date')).toHaveText(today);
    await expect(page.locator('#quote-number')).toHaveText(/^LUM-\d{8}-\d{4}$/);

    // Room features are never billed
    const rows = page.locator('#quote-body tr');
    await expect(rows).toHaveCount(4);
    await expect(rows.first().locator('td')).toHaveText(['Compact Storage75 x 38 cm', 'Walnut', '1', '$55.00', '$55.00']);
    await expect(rows.nth(1).locator('td')).toHaveText([/^Floating Shelf/, 'Oak', '1', '$45.00', '$45.00']);
    await expect(rows.nth(2).locator('td')).toHaveText([/^Floating Shelf/, 'Walnut', '2', '$45.00', '$90.00']);

    await expect(page.locator('#quote-net')).toHaveText('$215.00');
    await expect(page.locator('#quote-vat')).toHaveText('$58.05');
    await expect(page.locator('#quote-gross')).toHaveText('$273.05');

    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
  });

  test('rounds VAT to the cent so net plus VAT always equals the gross total', async ({ page }) => {
    await loadLayout(page, {
      items: [wallItem('item-a', 'cube', 0, 0, { price: 19.99 }), wallItem('item-b', 'cube', 200, 0, { price: 0.37 })],
    });
    await page.click('#generate-quote-btn');

    await expect(page.locator('#quote-net')).toHaveText('$20.36');
    await expect(page.locator('#quote-vat')).toHaveText('$5.50');
    await expect(page.locator('#quote-gross')).toHaveText('$25.86');
  });

  test('an empty wall gives a zero quote', async ({ page }) => {
    await loadLayout(page, { items: [wallItem('item-door', 'door', 0, 125)] });
    await page.click('#generate-quote-btn');

    await expect(page.locator('#quote-body')).toHaveText('No billable items on the wall yet.');
    await expect(page.locator('#quote-gross')).toHaveText('$0.00');
  });

  test('Print Quote calls window.print and print media shows only the quote', async ({ page }) => {
    await page.click('#generate-quote-btn');
    await page.evaluate(() => {
      window.printCalls = 0;
      window.print = () => {
        window.printCalls += 1;
      };
    });
    await page.click('#print-quote-btn');
    expect(await page.evaluate(() => window.printCalls)).toBe(1);

    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.topbar')).toBeHidden();
    await expect(page.locator('.sidebar.catalog')).toBeHidden();
    await expect(page.locator('.canvas-area')).toBeHidden();
    await expect(page.locator('#print-quote-btn')).toBeHidden();
    await expect(page.locator('#quote-gross')).toBeVisible();
    expect(await page.locator('#quote-modal').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
      'rgb(255, 255, 255)',
    );

    await page.emulateMedia({ media: 'screen' });
    await expect(page.locator('.topbar')).toBeVisible();
  });

  test('the quote does not open over another dialog', async ({ page }) => {
    await page.click('#view-spec-btn');
    await page.evaluate(() => document.getElementById('generate-quote-btn').click());
    await expect(page.locator('#quote-modal')).toBeHidden();
  });
});

test.describe('z-depth foundation', () => {
  test('a mounted Floating Shelf carries 25 cm of depth, shown read-only in the Inspector', async ({ page }) => {
    await page.click('.catalog-item[data-type="shelf"]');

    const shelf = await selectedItem(page);
    expect(shelf).toMatchObject({ type: 'shelf', name: 'Floating Shelf', depth: 25 });

    const depthInput = page.locator('.inspector-content #edit-depth-cm');
    await expect(depthInput).toHaveValue('25');
    await expect(depthInput).toHaveAttribute('readonly', '');
    await expect(depthInput).not.toBeEditable();
    await expect(page.locator('label[for="edit-depth-cm"]')).toHaveText('Depth (cm)');
  });

  test('every catalog type has its default depth and room features stay flush', async ({ page }) => {
    const expected = { shelf: 25, cube: 35, storage: 38, poster: 3, spotlight: 5, 'corner-lamp': 15, socket: 0, door: 0, window: 0, note: 0 };
    for (const type of Object.keys(expected)) await page.click(`.catalog-item[data-type="${type}"]`);

    const depths = await page.evaluate(() => Object.fromEntries(wallItems.map((item) => [item.type, item.depth])));
    expect(depths).toEqual({ ...expected });
  });

  test('older files without depth fall back to the catalog default and exports carry depth', async ({ page }) => {
    const status = await importFile(
      page,
      'legacy.json',
      JSON.stringify({
        version: '1.7',
        wallItems: [
          { id: 'item-old', type: 'storage', left: 0, top: 0 },
          { id: 'item-deep', type: 'shelf', left: 0, top: 200, depth: 30 },
          { id: 'item-bad', type: 'cube', left: 300, top: 0, depth: 'deep' },
          { id: 'item-win', type: 'window', left: 400, top: 200, depth: 12 },
        ],
      }),
    );
    await expect(status).toHaveText('Imported 4 items.');

    expect((await getItem(page, 'item-old')).depth).toBe(38);
    expect((await getItem(page, 'item-deep')).depth).toBe(30);
    expect((await getItem(page, 'item-bad')).depth).toBe(35);
    expect((await getItem(page, 'item-win')).depth).toBe(0);

    const { buffer } = await downloadFrom(page, '#export-json-btn');
    const file = JSON.parse(buffer.toString('utf8'));
    expect(file.version).toBe('1.8');
    expect(file.wallItems.map((item) => item.depth)).toEqual([38, 30, 35, 0]);
  });

  test('the starter layout and duplicates keep their depth', async ({ page }) => {
    expect((await getItem(page, 'item-1')).depth).toBe(25);
    expect((await getItem(page, 'item-2')).depth).toBe(3);

    await page.click('.wall-item[data-id="item-2"]');
    await page.keyboard.press('Control+d');
    expect((await selectedItem(page)).depth).toBe(3);
  });
});
