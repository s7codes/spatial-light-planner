import { test, expect } from './support/fixtures.js';
import {
  dragBy,
  getItem,
  historyState,
  itemLocator,
  loadLayout,
  releaseDrag,
  selectItemById,
  selectItemsById,
  wallItem,
} from './support/planner.js';

const SCALE = 2.5;
const hint = (page) => page.locator('#ergonomic-hint');
const copyBtn = (page) => page.locator('#copy-style-btn');
const pasteBtn = (page) => page.locator('#paste-style-btn');
const palette = (page) => page.locator('#command-palette');
const optionLabels = (page) => page.locator('#command-list [role="option"] .command-label').allTextContents();

async function typePosition(page, field, value) {
  await page.fill(field, value);
  await page.press(field, 'Enter');
}

async function removeById(page, ids) {
  await selectItemsById(page, ids);
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Delete');
}

async function openPalette(page) {
  await page.keyboard.press('Control+k');
  await expect(palette(page)).toHaveAttribute('open', '');
}

const styleOf = (item) => ({
  finish: item.finish,
  ledEnabled: item.ledEnabled,
  itemLedColor: item.itemLedColor,
  posterArt: item.posterArt,
});

test.describe('ergonomic clearance advisor', () => {
  // Poster 50 x 70 cm at 240 cm across; shelf 110 x 8 cm at 80 cm across, its bottom 168 cm from the ceiling
  const LAYOUT = {
    items: [
      wallItem('item-p', 'poster', 600, 0),
      wallItem('item-s', 'shelf', 200, 400),
      wallItem('item-k', 'socket', 50, 550),
    ],
  };

  test.beforeEach(async ({ page }) => {
    await loadLayout(page, LAYOUT);
  });

  test('reads the poster center against the 140-160 cm eye-level zone and follows edits live', async ({ page }) => {
    await selectItemById(page, 'item-p');
    // Center 35 cm below the ceiling: 250 - 35 = 215 cm from the floor
    await expect(hint(page)).toHaveText('Center 215 cm from floor (ideal eye level: 140-160 cm)');
    await expect(hint(page)).not.toHaveClass(/is-warning/);

    await typePosition(page, '#edit-top-cm', '56');
    await expect(hint(page)).toHaveText('Eye-level gallery zone (center 159 cm from floor)');

    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('ArrowUp');
    await expect(hint(page)).toHaveText('Eye-level gallery zone (center 160 cm from floor)');
    await page.keyboard.press('ArrowUp');
    await expect(hint(page)).toHaveText('Center 161 cm from floor (ideal eye level: 140-160 cm)');

    await dragBy(page, 'item-p', 0, 60, { hold: true });
    const dragged = await getItem(page, 'item-p');
    const center = Math.round(250 - (dragged.top + dragged.height / 2) / SCALE);
    expect(center).toBeLessThan(161);
    await expect(hint(page)).toHaveText(new RegExp(`center ${center} cm from floor`, 'i'));
    await releaseDrag(page);
  });

  test('furniture shows its bottom and center height, room features show no hint', async ({ page }) => {
    await selectItemById(page, 'item-s');
    await expect(hint(page)).toHaveText('Bottom 82 cm from floor (center 86 cm)');

    await selectItemById(page, 'item-k');
    await expect(hint(page)).toHaveCount(0);

    await selectItemsById(page, ['item-s', 'item-p']);
    await expect(hint(page)).toHaveCount(0);
  });

  test('measures clearance or overlap against the active floor backdrop and its alignment', async ({ page }) => {
    await selectItemById(page, 'item-s');
    await page.click('#backdrop-bed-btn');
    // Bed 85 cm tall, shelf bottom 82 cm from the floor
    await expect(hint(page)).toHaveText('Overlaps Bed backdrop by 3 cm');
    await expect(hint(page)).toHaveClass(/is-warning/);

    await page.click('#backdrop-sofa-btn');
    await expect(hint(page)).toHaveText('0 cm clear above Sofa (center 86 cm from floor)');
    await expect(hint(page)).not.toHaveClass(/is-warning/);

    await typePosition(page, '#edit-top-cm', '150');
    await expect(hint(page)).toHaveText('10 cm clear above Sofa (center 96 cm from floor)');

    // The centered bed spans 72.5-227.5 cm, so the poster at 240-290 cm stands clear of it
    await typePosition(page, '#edit-top-cm', '160');
    await selectItemById(page, 'item-p');
    await typePosition(page, '#edit-top-cm', '56');
    await page.click('#backdrop-bed-btn');
    await expect(hint(page)).toHaveText('Eye-level gallery zone (center 159 cm from floor)');

    await page.click('#backdrop-align-right-btn');
    await expect(hint(page)).toHaveText('39 cm clear above Bed (center 159 cm from floor)');
    await page.click('#backdrop-align-left-btn');
    await expect(hint(page)).toHaveText('Eye-level gallery zone (center 159 cm from floor)');
    await page.click('#backdrop-align-right-btn');

    await page.click('#backdrop-none-btn');
    await expect(hint(page)).toHaveText('Eye-level gallery zone (center 159 cm from floor)');
  });

  test('stays visible in Creator Mode, where the coordinate readouts step aside', async ({ page }) => {
    await selectItemById(page, 'item-p');
    await page.keyboard.press('Alt+m');
    await expect(page.locator('body.app-shell')).toHaveAttribute('data-studio-mode', 'creator');
    await expect(page.locator('#inspector-pos-readout')).toBeHidden();
    await expect(hint(page)).toBeVisible();
    await expect(hint(page)).toHaveText('Center 215 cm from floor (ideal eye level: 140-160 cm)');
  });
});

test.describe('item style copy and paste', () => {
  const LAYOUT = {
    items: [
      wallItem('item-src', 'poster', 50, 50, { finish: 'white', ledEnabled: false, itemLedColor: '#00ff88', posterArt: 'bauhaus' }),
      wallItem('item-p2', 'poster', 250, 50, { finish: 'black', ledEnabled: true, itemLedColor: null, posterArt: 'noir' }),
      wallItem('item-sh', 'shelf', 50, 400, { finish: 'walnut', ledEnabled: true }),
      wallItem('item-cu', 'cube', 400, 300, { finish: 'oak', ledEnabled: true, itemLedColor: '#ff0000' }),
      wallItem('item-lk', 'cube', 550, 300, { finish: 'oak', ledEnabled: true, locked: true }),
      wallItem('item-so', 'socket', 650, 550),
    ],
  };

  test.beforeEach(async ({ page }) => {
    await loadLayout(page, LAYOUT);
  });

  test('Copy Style and Paste Style buttons move every style field onto another poster as one undo step', async ({ page }) => {
    await selectItemById(page, 'item-p2');
    await expect(copyBtn(page)).toHaveText('Copy Style');
    await expect(pasteBtn(page)).toBeDisabled();

    await selectItemById(page, 'item-src');
    await copyBtn(page).click();
    await expect(page.locator('#io-status')).toHaveText('Copied style from Poster Frame.');
    await expect(pasteBtn(page)).toBeEnabled();

    await selectItemById(page, 'item-p2');
    const original = styleOf(await getItem(page, 'item-p2'));
    const before = await historyState(page);
    await pasteBtn(page).click();

    expect(styleOf(await getItem(page, 'item-p2'))).toEqual({
      finish: 'white',
      ledEnabled: false,
      itemLedColor: '#00ff88',
      posterArt: 'bauhaus',
    });
    await expect(itemLocator(page, 'item-p2')).toHaveAttribute('data-art', 'bauhaus');
    await expect(itemLocator(page, 'item-p2')).toHaveClass(/led-off/);
    await expect(itemLocator(page, 'item-p2')).toHaveClass(/finish-white/);
    expect((await historyState(page)).index).toBe(before.index + 1);

    // A second paste changes nothing, so it adds no history step
    await pasteBtn(page).click();
    expect((await historyState(page)).index).toBe(before.index + 1);

    await page.keyboard.press('Control+z');
    expect(styleOf(await getItem(page, 'item-p2'))).toEqual(original);
    await page.keyboard.press('Control+y');
    expect((await getItem(page, 'item-p2')).posterArt).toBe('bauhaus');
  });

  test('Alt+Shift+C and Alt+Shift+V paste onto a mixed selection, skipping locked items and features', async ({ page }) => {
    await selectItemById(page, 'item-src');
    await page.keyboard.press('Alt+Shift+KeyC');
    await expect(page.locator('#io-status')).toHaveText('Copied style from Poster Frame.');

    const lockedBefore = styleOf(await getItem(page, 'item-lk'));
    const originals = {};
    for (const id of ['item-p2', 'item-sh', 'item-cu']) originals[id] = styleOf(await getItem(page, id));

    await selectItemsById(page, ['item-sh', 'item-cu', 'item-lk', 'item-so', 'item-p2']);
    await expect(pasteBtn(page)).toBeEnabled();
    const before = await historyState(page);
    await page.keyboard.press('Alt+Shift+KeyV');

    for (const id of ['item-sh', 'item-cu']) {
      const item = await getItem(page, id);
      expect(styleOf(item)).toEqual({ finish: 'white', ledEnabled: false, itemLedColor: '#00ff88', posterArt: undefined });
    }
    expect((await getItem(page, 'item-p2')).posterArt).toBe('bauhaus');
    expect(styleOf(await getItem(page, 'item-lk'))).toEqual(lockedBefore);
    expect(await getItem(page, 'item-so')).toMatchObject({ finish: null, ledEnabled: false, itemLedColor: null });
    await expect(page.locator('#io-status')).toHaveText('Pasted style onto 3 items.');
    expect((await historyState(page)).index).toBe(before.index + 1);

    await page.keyboard.press('Control+z');
    for (const id of ['item-p2', 'item-sh', 'item-cu']) {
      expect(styleOf(await getItem(page, id))).toEqual(originals[id]);
    }
  });

  test('the batch row follows the unlocked furniture, and room features alone get no row', async ({ page }) => {
    await selectItemById(page, 'item-so');
    await expect(copyBtn(page)).toHaveCount(0);

    await selectItemsById(page, ['item-so', 'item-lk']);
    await expect(copyBtn(page)).toBeEnabled();
    await copyBtn(page).click();
    await expect(page.locator('#io-status')).toHaveText('Copied style from Modular Cube.');
    // The only furniture is locked, so nothing can take the style
    await expect(pasteBtn(page)).toBeDisabled();

    await selectItemById(page, 'item-lk');
    await expect(pasteBtn(page)).toBeDisabled();
    await expect(copyBtn(page)).toBeEnabled();
  });

  test('the command palette lists Copy and Paste Item Style in the Selection group when they apply', async ({ page }) => {
    await selectItemById(page, 'item-src');
    await openPalette(page);
    let labels = await optionLabels(page);
    expect(labels).toContain('Copy Item Style');
    expect(labels).not.toContain('Paste Item Style');
    await expect(page.locator('.command-group-label').first()).toHaveText('Selection');

    await page.fill('#command-search-input', 'copy item style');
    await page.keyboard.press('Enter');
    await expect(palette(page)).not.toHaveAttribute('open');

    await selectItemById(page, 'item-cu');
    await openPalette(page);
    labels = await optionLabels(page);
    expect(labels.slice(0, 7)).toEqual([
      'Center Horizontally on Wall',
      'Center Vertically on Wall',
      'Duplicate Selection',
      'Lock / Unlock Selection',
      'Remove Selection',
      'Copy Item Style',
      'Paste Item Style',
    ]);
    await page.fill('#command-search-input', 'paste item style');
    await page.keyboard.press('Enter');
    expect(await getItem(page, 'item-cu')).toMatchObject({ finish: 'white', ledEnabled: false, itemLedColor: '#00ff88' });

    await selectItemById(page, 'item-so');
    await openPalette(page);
    labels = await optionLabels(page);
    expect(labels).not.toContain('Copy Item Style');
    expect(labels).not.toContain('Paste Item Style');
  });

  test('the shortcuts guide documents the style shortcuts below the pinned table', async ({ page }) => {
    await page.keyboard.press('?');
    await expect(page.locator('#shortcuts-modal .shortcut-table tbody tr')).toHaveCount(10);
    await expect(page.locator('#shortcuts-modal .shortcut-note')).toContainText('Alt + Shift + C');
    await expect(page.locator('#shortcuts-modal .shortcut-note')).toContainText('Alt + Shift + V');
  });
});

test.describe('hardware and LED kit estimate', () => {
  // Shelf 110 cm, storage 75 cm, cube 36 x 36 cm, poster 50 x 70 cm, plus a spotlight, a lamp and a socket
  const KIT_LAYOUT = {
    items: [
      wallItem('item-kshelf', 'shelf', 20, 20),
      wallItem('item-kstorage', 'storage', 20, 100),
      wallItem('item-kcube', 'cube', 250, 100),
      wallItem('item-kposter', 'poster', 400, 20),
      wallItem('item-kspot', 'spotlight', 400, 250),
      wallItem('item-klamp', 'corner-lamp', 650, 250),
      wallItem('item-ksocket', 'socket', 300, 550),
    ],
  };

  async function readKit(page) {
    await page.click('#view-spec-btn');
    await expect(page.locator('#spec-modal')).toHaveAttribute('open', '');
    const kit = {
      led: await page.locator('#kit-led-strip').textContent(),
      power: await page.locator('#kit-power-draw').textContent(),
      anchors: await page.locator('#kit-wall-anchors').textContent(),
    };
    await page.click('#close-spec-btn');
    return kit;
  }

  test('sums strip length, power draw and anchors for every lit and mounted piece', async ({ page }) => {
    await loadLayout(page, KIT_LAYOUT);
    await page.click('#view-spec-btn');
    await expect(page.locator('#hardware-kit-title')).toHaveText('Hardware & LED Kit Estimate');
    await expect(page.locator('#hardware-kit-grid .kit-card')).toHaveCount(3);
    await page.click('#close-spec-btn');

    // 110 + 75 + 144 + 240 + 20 + 140 = 729 cm; 7.29 m x 14.4 W + 5 W = 109.98 W
    expect(await readKit(page)).toEqual({ led: '7.3 m', power: '110 W (24V PSU)', anchors: '15 anchors' });
  });

  test('follows the backlight switches and the furniture on the wall', async ({ page }) => {
    await loadLayout(page, KIT_LAYOUT);
    await selectItemById(page, 'item-kposter');
    await page.click('#led-toggle-btn');
    await selectItemById(page, 'item-klamp');
    await page.click('#led-toggle-btn');
    // 729 - 240 - 140 = 349 cm; 3.49 m x 14.4 W + 5 W = 55.26 W
    expect(await readKit(page)).toEqual({ led: '3.5 m', power: '56 W (24V PSU)', anchors: '15 anchors' });

    await selectItemById(page, 'item-kspot');
    await page.click('#led-toggle-btn');
    // 329 cm with no spotlight: 47.38 W
    expect(await readKit(page)).toEqual({ led: '3.3 m', power: '48 W (24V PSU)', anchors: '15 anchors' });

    await removeById(page, ['item-kshelf', 'item-kstorage', 'item-kcube', 'item-kposter', 'item-kspot']);
    expect(await readKit(page)).toEqual({ led: '0.0 m', power: '0 W', anchors: '1 anchor' });
  });

  test('keeps exact whole-watt results and a turned shelf strip on its long side', async ({ page }) => {
    // 250 cm of strip is exactly 36 W, which must not round up to 37 W
    await loadLayout(page, {
      items: [
        wallItem('item-ta', 'shelf', 20, 20, { width: 250, height: 20 }),
        wallItem('item-tb', 'shelf', 20, 100, { width: 375, height: 20 }),
        wallItem('item-tc', 'shelf', 600, 100, { width: 20, height: 275, rotation: 90 }),
      ],
    });
    // 100 + 150 + 110 = 360 cm; 3.6 m x 14.4 W = 51.84 W
    expect(await readKit(page)).toEqual({ led: '3.6 m', power: '52 W (24V PSU)', anchors: '12 anchors' });

    await removeById(page, ['item-tc']);
    expect(await readKit(page)).toEqual({ led: '2.5 m', power: '36 W (24V PSU)', anchors: '8 anchors' });
  });

  test('leaves the bill of materials and mounting tables in their places above the kit', async ({ page }) => {
    await loadLayout(page, KIT_LAYOUT);
    await page.click('#view-spec-btn');
    const order = await page.evaluate(() =>
      [...document.querySelectorAll('#spec-modal .spec-section h3')].map((heading) => heading.id),
    );
    expect(order).toEqual(['bom-title', 'mounting-title', 'hardware-kit-title']);
    await expect(page.locator('#spec-modal .spec-table')).toHaveCount(2);
  });
});
