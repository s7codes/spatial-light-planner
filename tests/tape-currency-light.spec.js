import { test, expect } from './support/fixtures.js';
import {
  downloadFrom, getItem, loadLayout, nextFrame, selectedIds, setWallSize, wallItem, wallPoint,
} from './support/planner.js';

const SCALE = 2.5;
const EURO = '\u20AC';
const SQ = '\u00B2';

const QUOTE_LAYOUT = {
  items: [
    wallItem('item-s1', 'shelf', 100, 380),
    wallItem('item-s2', 'shelf', 450, 380),
    wallItem('item-s3', 'shelf', 100, 450, { finish: 'oak' }),
    wallItem('item-p', 'poster', 300, 100),
    wallItem('item-st', 'storage', 500, 200),
  ],
};

// Screen point of a wall coordinate, snapped to whole pixels so a drag covers an exact screen distance
async function screenPoint(page, x, y) {
  const point = await wallPoint(page, x, y);
  return { x: Math.round(point.x), y: Math.round(point.y) };
}

async function tapeDrag(page, from, dx, dy) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 6 });
  await nextFrame(page);
  await page.mouse.up();
}

test.describe('tape measure', () => {
  test('the HUD button toggles the tool and a 100 px drag reads the matching cm distance', async ({ page }) => {
    const button = page.locator('.zoom-hud #tape-measure-btn');
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.canvas-area')).not.toHaveClass(/is-measuring/);

    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.canvas-area')).toHaveClass(/is-measuring/);
    expect(await page.locator('#wall').evaluate((el) => getComputedStyle(el).cursor)).toBe('crosshair');

    const scale = await page.evaluate(() => viewScale);
    const from = await screenPoint(page, 40, 60);
    await tapeDrag(page, from, 100, 0);

    const readout = page.locator('.tape-measure-readout');
    await expect(page.locator('.tape-measure-line')).toBeVisible();
    await expect(readout).toHaveText(`${Math.round(100 / scale / SCALE)} cm`);

    // The pill sits on the middle of the line
    const pill = await readout.boundingBox();
    expect(Math.abs(pill.x + pill.width / 2 - (from.x + 50))).toBeLessThanOrEqual(2);
    expect(Math.abs(pill.y + pill.height / 2 - from.y)).toBeLessThanOrEqual(2);

    // Released, the line stays; a plain click clears it
    await nextFrame(page);
    await expect(readout).toBeVisible();
    await page.mouse.click(from.x, from.y + 40);
    await expect(page.locator('.tape-measure-layer')).toBeHidden();

    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.canvas-area')).not.toHaveClass(/is-measuring/);
  });

  test('diagonals use the straight-line distance in wall cm', async ({ page }) => {
    await page.keyboard.press('t');
    const scale = await page.evaluate(() => viewScale);
    const from = await screenPoint(page, 30, 30);
    // A 3-4-5 triangle of 60 x 80 wall px is a 100 px (40 cm) hypotenuse
    await tapeDrag(page, from, Math.round(60 * scale), Math.round(80 * scale));
    await expect(page.locator('.tape-measure-readout')).toHaveText('40 cm');
  });

  test('T toggles the tool, items cannot be dragged or selected while it is out, and Escape puts it away', async ({ page }) => {
    await page.keyboard.press('t');
    await expect(page.locator('#tape-measure-btn')).toHaveAttribute('aria-pressed', 'true');

    const before = await getItem(page, 'item-1');
    const start = await screenPoint(page, before.left + 40, before.top + before.height / 2);
    await tapeDrag(page, start, 120, 0);

    const after = await getItem(page, 'item-1');
    expect([after.left, after.top]).toEqual([before.left, before.top]);
    expect(await selectedIds(page)).toEqual([]);
    await expect(page.locator('.tape-measure-readout')).toBeVisible();

    await page.keyboard.press('t');
    await expect(page.locator('#tape-measure-btn')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.tape-measure-layer')).toBeHidden();

    await page.keyboard.press('t');
    await page.keyboard.press('Escape');
    await expect(page.locator('#tape-measure-btn')).toHaveAttribute('aria-pressed', 'false');

    // With the tool away, the same press drags the shelf again
    await tapeDrag(page, start, 50, 0);
    expect((await getItem(page, 'item-1')).left).not.toBe(before.left);
  });

  test('the shortcut is documented below the pinned table', async ({ page }) => {
    await expect(page.locator('#shortcuts-modal .shortcut-note')).toContainText('toggles the Tape Measure');
  });
});

test.describe('multi-currency prices', () => {
  test('HUF converts the total and the spec sheet with space-grouped forints', async ({ page }) => {
    await expect(page.locator('#total-price')).toHaveText('$70.00');

    await page.selectOption('#currency-selector', 'HUF');
    await expect(page.locator('#total-price')).toHaveText('25 200 Ft');

    await page.click('#view-spec-btn');
    const shelfRow = page.locator('#bom-body tr', { hasText: 'Floating Shelf' });
    await expect(shelfRow.locator('td.num').nth(1)).toHaveText('16 200 Ft');
    await expect(shelfRow.locator('td.num').nth(2)).toHaveText('16 200 Ft');
    await expect(page.locator('#bom-foot .grand-total')).toHaveText('25 200 Ft');
    await page.click('#close-spec-btn');

    await page.selectOption('#currency-selector', 'EUR');
    await expect(page.locator('#total-price')).toHaveText(`${EURO}64.40`);
  });

  test('the quote computes VAT in the selected currency', async ({ page }) => {
    await loadLayout(page, QUOTE_LAYOUT);
    await page.selectOption('#currency-selector', 'HUF');
    await page.click('#generate-quote-btn');
    await expect(page.locator('#quote-net')).toHaveText('77 400 Ft');
    await expect(page.locator('#quote-vat')).toHaveText('20 898 Ft');
    await expect(page.locator('#quote-gross')).toHaveText('98 298 Ft');
    await page.click('#close-quote-btn');

    await page.selectOption('#currency-selector', 'EUR');
    await page.click('#generate-quote-btn');
    await expect(page.locator('#quote-net')).toHaveText(`${EURO}197.80`);
    await expect(page.locator('#quote-vat')).toHaveText(`${EURO}53.41`);
    await expect(page.locator('#quote-gross')).toHaveText(`${EURO}251.21`);
  });

  test('the CSV follows the currency, the choice survives a reload and stays out of the JSON', async ({ page }) => {
    const usdLayout = await page.evaluate(() => JSON.stringify(layoutPayload()));
    await page.selectOption('#currency-selector', 'HUF');

    await page.click('#view-spec-btn');
    const { buffer } = await downloadFrom(page, '#export-csv-btn');
    const csv = buffer.toString('utf8');
    expect(csv).toContain('Unit Price (HUF),Subtotal (HUF)');
    expect(csv).toContain('Floating Shelf,110,8,Walnut,1,16200,16200');
    expect(csv).toContain('Total,,,,2,,25200');
    await page.click('#close-spec-btn');

    expect(await page.evaluate(() => JSON.stringify(layoutPayload()))).toBe(usdLayout);

    await page.reload();
    await expect(page.locator('#currency-selector')).toHaveValue('HUF');
    await expect(page.locator('#total-price')).toHaveText('25 200 Ft');
  });
});

test.describe('illumination estimator', () => {
  const status = (page) => page.locator('#illumination-estimator #illum-status');

  test('the default wall reads Cozy and the brightness slider dims it', async ({ page }) => {
    // 110 cm shelf strip (15.84 W) + 240 cm poster frame (34.56 W) over 7.5 m2
    await expect(status(page)).toHaveText(`Cozy / Balanced (6.7 W/m${SQ})`);
    await page.locator('#brightness-slider').fill('50');
    await expect(status(page)).toHaveText(`Dim / Accent (3.4 W/m${SQ})`);
  });

  test('mounting Corner Floor Lamps moves from Dim through Cozy to Bright', async ({ page }) => {
    await loadLayout(page, { items: [] });
    await expect(status(page)).toHaveText(`Dim / Accent (0.0 W/m${SQ})`);

    const lamp = page.locator('.catalog-item[data-name="Corner Floor Lamp"]');
    await lamp.click();
    await expect(status(page)).toHaveText(`Dim / Accent (2.7 W/m${SQ})`);
    await lamp.click();
    await expect(status(page)).toHaveText(`Cozy / Balanced (5.3 W/m${SQ})`);
    for (let i = 0; i < 3; i += 1) await lamp.click();
    expect(await page.evaluate(() => wallItems.length)).toBe(5);
    await expect(status(page)).toHaveText(`Bright / Task (13.3 W/m${SQ})`);

    await page.locator('#brightness-slider').fill('50');
    await expect(status(page)).toHaveText(`Cozy / Balanced (6.7 W/m${SQ})`);
  });

  test('LED toggles, item resizes and wall resizes update the readout', async ({ page }) => {
    await loadLayout(page, { items: [wallItem('item-a', 'shelf', 0, 0, { width: 250 })] });
    // 100 cm strip = 14.4 W over 7.5 m2
    await expect(status(page)).toHaveText(`Dim / Accent (1.9 W/m${SQ})`);

    await page.evaluate(() => selectItem('item-a'));
    await page.fill('#edit-width-cm', '300');
    await page.press('#edit-width-cm', 'Enter');
    await expect(status(page)).toHaveText(`Cozy / Balanced (5.8 W/m${SQ})`);

    await page.click('#led-toggle-btn');
    await expect(status(page)).toHaveText(`Dim / Accent (0.0 W/m${SQ})`);
    await page.click('#led-toggle-btn');

    await setWallSize(page, { width: 400, height: 300 });
    await expect(status(page)).toHaveText(`Dim / Accent (3.6 W/m${SQ})`);
  });

  test('the readout stays visible in Creator Mode', async ({ page }) => {
    await page.click('#mode-creator-btn');
    await expect(page.locator('#illumination-estimator')).toBeVisible();
  });
});
