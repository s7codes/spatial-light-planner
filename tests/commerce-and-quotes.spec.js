import { test, expect } from './support/fixtures.js';
import { getItems, loadLayout, selectItemById, wallItem } from './support/planner.js';

// Net $215.00: three shelves, a poster and a storage unit. The door is never billed.
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

const openQuote = async (page) => {
  await page.click('#generate-quote-btn');
  await expect(page.locator('#quote-modal')).toBeVisible();
};

const applyPromo = async (page, code) => {
  await page.fill('#quote-promo-input', code);
  await page.click('#apply-promo-btn');
};

// Amounts are read back in the smallest unit, so the check is exact for cents and forints alike
const units = (text) => Number(text.replace(/[^\d]/g, ''));

const expectTotalsAddUp = async (page) => {
  const [net, discount, discounted, vat, gross] = await Promise.all(
    ['#quote-net', '#quote-discount', '#quote-net-discounted', '#quote-vat', '#quote-gross'].map((id) =>
      page.locator(id).textContent(),
    ),
  );
  expect(units(net) - units(discount)).toBe(units(discounted));
  expect(units(discounted) + units(vat)).toBe(units(gross));
};

test.describe('quote promo codes', () => {
  test.beforeEach(async ({ page }) => {
    await loadLayout(page, QUOTE_LAYOUT);
  });

  test('LUMEN10 takes 10% off the net in USD and VAT is charged on the discounted net', async ({ page }) => {
    await openQuote(page);
    await expect(page.locator('#quote-discount-row')).toBeHidden();
    await expect(page.locator('#clear-promo-btn')).toBeHidden();
    await expect(page.locator('#quote-promo-status')).toBeHidden();

    // Codes match regardless of case
    await applyPromo(page, '  lumen10 ');
    await expect(page.locator('#quote-promo-status')).toHaveText('Promo LUMEN10 applied: Lumen Welcome (10%).');
    await expect(page.locator('#quote-promo-input')).toHaveValue('LUMEN10');
    await expect(page.locator('#clear-promo-btn')).toBeVisible();

    await expect(page.locator('#quote-discount-row')).toBeVisible();
    await expect(page.locator('#quote-net')).toHaveText('$215.00');
    await expect(page.locator('#quote-discount-label')).toHaveText('Discount (LUMEN10, 10%)');
    await expect(page.locator('#quote-discount')).toHaveText('-$21.50');
    await expect(page.locator('#quote-net-discounted')).toHaveText('$193.50');
    await expect(page.locator('#quote-vat')).toHaveText('$52.25');
    await expect(page.locator('#quote-gross')).toHaveText('$245.75');
    await expectTotalsAddUp(page);

    // The bill of materials rows stay at list price
    await expect(page.locator('#quote-body tr').first().locator('td').nth(4)).toHaveText('$55.00');
  });

  test('STUDIO20 replaces an applied code and Enter applies it too', async ({ page }) => {
    await openQuote(page);
    await applyPromo(page, 'TRADE15');
    await expect(page.locator('#quote-discount')).toHaveText('-$32.25');

    await page.fill('#quote-promo-input', 'studio20');
    await page.press('#quote-promo-input', 'Enter');
    await expect(page.locator('#quote-modal')).toBeVisible();
    await expect(page.locator('#quote-discount-label')).toHaveText('Discount (STUDIO20, 20%)');
    await expect(page.locator('#quote-discount')).toHaveText('-$43.00');
    await expect(page.locator('#quote-net-discounted')).toHaveText('$172.00');
    await expect(page.locator('#quote-vat')).toHaveText('$46.44');
    await expect(page.locator('#quote-gross')).toHaveText('$218.44');
    await expectTotalsAddUp(page);
  });

  test('HUF discounts round to whole forints and still add up', async ({ page }) => {
    await page.selectOption('#currency-selector', 'HUF');
    await openQuote(page);
    await expect(page.locator('#quote-currency')).toHaveText('HUF');
    await expect(page.locator('#quote-footer-currency')).toHaveText('HUF');

    await applyPromo(page, 'LUMEN10');
    await expect(page.locator('#quote-net')).toHaveText('77 400 Ft');
    await expect(page.locator('#quote-discount')).toHaveText('-7 740 Ft');
    await expect(page.locator('#quote-net-discounted')).toHaveText('69 660 Ft');
    await expect(page.locator('#quote-vat')).toHaveText('18 808 Ft');
    await expect(page.locator('#quote-gross')).toHaveText('88 468 Ft');
    await expectTotalsAddUp(page);

    await applyPromo(page, 'STUDIO20');
    await expect(page.locator('#quote-discount')).toHaveText('-15 480 Ft');
    await expect(page.locator('#quote-net-discounted')).toHaveText('61 920 Ft');
    await expect(page.locator('#quote-vat')).toHaveText('16 718 Ft');
    await expect(page.locator('#quote-gross')).toHaveText('78 638 Ft');
    await expectTotalsAddUp(page);
  });

  test('an unknown code is rejected and keeps whatever was applied before', async ({ page }) => {
    await openQuote(page);
    await applyPromo(page, 'FREESTUFF');
    await expect(page.locator('#quote-promo-status')).toHaveText('Invalid promo code.');
    await expect(page.locator('#quote-promo-status')).toHaveAttribute('data-tone', 'error');
    await expect(page.locator('#quote-discount-row')).toBeHidden();
    await expect(page.locator('#clear-promo-btn')).toBeHidden();
    await expect(page.locator('#quote-gross')).toHaveText('$273.05');

    await applyPromo(page, 'LUMEN10');
    await applyPromo(page, 'LUMEN99');
    await expect(page.locator('#quote-promo-status')).toHaveText('Invalid promo code.');
    await expect(page.locator('#quote-discount-label')).toHaveText('Discount (LUMEN10, 10%)');
    await expect(page.locator('#quote-gross')).toHaveText('$245.75');
  });

  test('Clear removes the promo and restores the undiscounted totals', async ({ page }) => {
    await openQuote(page);
    await applyPromo(page, 'STUDIO20');
    await page.click('#clear-promo-btn');

    await expect(page.locator('#quote-promo-status')).toHaveText('Promo code removed.');
    await expect(page.locator('#clear-promo-btn')).toBeHidden();
    await expect(page.locator('#quote-discount-row')).toBeHidden();
    await expect(page.locator('#quote-promo-input')).toHaveValue('');
    await expect(page.locator('#quote-promo-input')).toBeFocused();
    await expect(page.locator('#quote-net')).toHaveText('$215.00');
    await expect(page.locator('#quote-vat')).toHaveText('$58.05');
    await expect(page.locator('#quote-gross')).toHaveText('$273.05');
  });

  test('the promo lasts the session, stays out of the layout JSON and prints without its controls', async ({ page }) => {
    await openQuote(page);
    await applyPromo(page, 'LUMEN10');
    await page.click('#close-quote-btn');

    await openQuote(page);
    await expect(page.locator('#quote-promo-status')).toBeHidden();
    await expect(page.locator('#quote-promo-input')).toHaveValue('LUMEN10');
    await expect(page.locator('#quote-gross')).toHaveText('$245.75');
    const stored = await page.evaluate(() => Object.values(localStorage).join('\n'));
    expect(stored).not.toContain('LUMEN10');
    const snapshot = await page.evaluate(() => historyStack[historyIndex]);
    expect(snapshot).not.toContain('LUMEN10');

    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.quote-controls')).toBeHidden();
    await expect(page.locator('#quote-promo-input')).toBeHidden();
    await expect(page.locator('#quote-discount-row')).toBeVisible();
    await expect(page.locator('#quote-discount')).toBeVisible();
    await page.emulateMedia({ media: 'screen' });
    await expect(page.locator('.quote-controls')).toBeVisible();
  });

  test('typing in the quote fields never reaches the studio shortcuts', async ({ page }) => {
    await selectItemById(page, 'item-s1');
    await openQuote(page);
    await page.click('#quote-promo-input');
    await page.keyboard.type('Delete T');
    await page.keyboard.press('Delete');
    await page.click('#quote-client-input');
    await page.keyboard.press('Backspace');
    expect((await getItems(page)).length).toBe(6);
    await expect(page.locator('#tape-measure-btn')).toHaveAttribute('aria-pressed', 'false');
  });
});

test.describe('quote client header', () => {
  test('the Prepared for line follows the client field as it is typed', async ({ page }) => {
    await openQuote(page);
    const display = page.locator('#quote-client-display');
    await expect(page.locator('#quote-client-row')).toBeHidden();
    await expect(page.locator('#quote-client-input')).toHaveAttribute('maxlength', '60');

    await page.click('#quote-client-input');
    await page.keyboard.type('Hotel Aurora');
    await expect(display).toHaveText('Hotel Aurora');
    await expect(page.locator('#quote-client-row')).toBeVisible();
    await page.keyboard.type(' Lobby');
    await expect(display).toHaveText('Hotel Aurora Lobby');

    // Kept for the session, so a reopened quote still carries the client
    await page.click('#close-quote-btn');
    await openQuote(page);
    await expect(page.locator('#quote-client-input')).toHaveValue('Hotel Aurora Lobby');
    await expect(display).toHaveText('Hotel Aurora Lobby');

    await page.emulateMedia({ media: 'print' });
    await expect(display).toBeVisible();
    await expect(page.locator('#quote-client-input')).toBeHidden();
    await page.emulateMedia({ media: 'screen' });

    await page.fill('#quote-client-input', '   ');
    await expect(page.locator('#quote-client-row')).toBeHidden();
  });

  test('client text renders as plain text', async ({ page }) => {
    await openQuote(page);
    await page.fill('#quote-client-input', '<b>Studio & Co</b>');
    await expect(page.locator('#quote-client-display')).toHaveText('<b>Studio & Co</b>');
    await expect(page.locator('#quote-client-display b')).toHaveCount(0);
  });
});

test.describe('stock and lead time', () => {
  const badge = (page) => page.locator('#inspector-stock-badge');

  test('the Corner Floor Lamp badge runs from in stock to backorder and back', async ({ page }) => {
    await loadLayout(page, { items: [wallItem('item-door', 'door', 0, 125)] });

    await openQuote(page);
    await expect(page.locator('#lead-time-summary')).toHaveText(
      'Availability: All items in stock (ships in 1-2 business days)',
    );
    await page.click('#close-quote-btn');

    const lamp = page.locator('.catalog-item[data-type="corner-lamp"]');
    await lamp.click();
    await expect(badge(page)).toHaveText('In Stock (1 of 2 used)');
    await expect(badge(page)).toHaveAttribute('data-stock-status', 'in-stock');

    await lamp.click();
    await expect(badge(page)).toHaveText('Last Unit in Stock (2 of 2)');
    await expect(badge(page)).toHaveAttribute('data-stock-status', 'low-stock');

    await lamp.click();
    await expect(badge(page)).toHaveText('Backorder: +5 business days (3 placed, 2 in stock)');
    await expect(badge(page)).toHaveAttribute('data-stock-status', 'backorder');

    await openQuote(page);
    await expect(page.locator('#lead-time-summary')).toHaveText(
      'Availability: 1 item(s) on backorder (ships in 5-7 business days)',
    );
    await expect(page.locator('#lead-time-summary')).toHaveAttribute('data-stock-status', 'backorder');
    await page.click('#close-quote-btn');

    await page.click('#view-spec-btn');
    await expect(page.locator('#hardware-kit-section #kit-lead-time')).toHaveText(
      'Availability: 1 item(s) on backorder (ships in 5-7 business days)',
    );
    await page.click('#close-spec-btn');

    // Removing the selected lamp leaves two, and the remaining selection shows the last unit
    await page.click('#delete-item-btn');
    const lamps = (await getItems(page)).filter((item) => item.type === 'corner-lamp');
    expect(lamps).toHaveLength(2);
    await selectItemById(page, lamps[0].id);
    await expect(badge(page)).toHaveText('Last Unit in Stock (2 of 2)');

    // A duplicate goes back on backorder
    await page.click('#duplicate-item-btn');
    await expect(badge(page)).toHaveText('Backorder: +5 business days (3 placed, 2 in stock)');
  });

  test('hidden items free their unit and room features carry no badge', async ({ page }) => {
    await loadLayout(page, {
      items: [
        wallItem('item-l1', 'corner-lamp', 0, 0),
        wallItem('item-l2', 'corner-lamp', 100, 0),
        wallItem('item-l3', 'corner-lamp', 200, 0),
        wallItem('item-door', 'door', 400, 125),
      ],
    });
    await selectItemById(page, 'item-l1');
    await expect(badge(page)).toHaveText('Backorder: +5 business days (3 placed, 2 in stock)');

    await page.locator('.layer-row[data-layer="item:item-l3"] .layer-eye').click();
    await expect(badge(page)).toHaveText('Last Unit in Stock (2 of 2)');

    await openQuote(page);
    await expect(page.locator('#lead-time-summary')).toHaveText(
      'Availability: All items in stock (ships in 1-2 business days)',
    );
    await page.click('#close-quote-btn');

    await selectItemById(page, 'item-door');
    await expect(page.locator('#inspector-stock-badge')).toHaveCount(0);

    // Creator Mode declutters the studio but keeps the badge
    await page.click('#mode-creator-btn');
    await selectItemById(page, 'item-l2');
    await expect(badge(page)).toHaveText('Last Unit in Stock (2 of 2)');
  });
});
