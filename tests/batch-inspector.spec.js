import { test, expect } from './support/fixtures.js';
import {
  getItem,
  getItems,
  historyState,
  itemLocator,
  itemOrder,
  loadLayout,
  selectedIds,
  selectItemsById,
  wallItem,
} from './support/planner.js';

const LAYOUT = {
  items: [
    wallItem('item-a', 'cube', 100, 100, { finish: 'walnut' }),
    wallItem('item-b', 'cube', 250, 100, { finish: 'oak' }),
    wallItem('item-c', 'cube', 100, 300, { finish: 'black' }),
    wallItem('item-far', 'cube', 600, 450),
  ],
};

const finishes = async (page, ids) =>
  (await getItems(page)).filter((item) => ids.includes(item.id)).map((item) => item.finish);

test.describe('batch inspector', () => {
  test.beforeEach(async ({ page }) => {
    await loadLayout(page, LAYOUT);
  });

  test('shows the count, total and group geometry, and leaves out the single-item editors', async ({ page }) => {
    await selectItemsById(page, ['item-a', 'item-b']);

    await expect(page.locator('#batch-count')).toHaveText('2 items selected');
    await expect(page.locator('.selected-item-meta')).toContainText('$60');
    await expect(page.locator('#inspector-pos-readout')).toHaveText('40 cm (X), 40 cm (Y)');
    await expect(page.locator('#batch-footprint-readout')).toHaveText('96 x 36 cm');
    for (const selector of ['#edit-width-cm', '#edit-height-cm', '#led-toggle-btn', '#item-led-color']) {
      await expect(page.locator(selector)).toHaveCount(0);
    }
    await expect(page.locator('#lock-toggle-btn')).toHaveText('Lock All');
    await expect(page.locator('#duplicate-item-btn')).toHaveText('Duplicate 2 Items');
    await expect(page.locator('#delete-item-btn')).toHaveText('Remove 2 Items');
  });

  test('the group readout and collision warning follow a group nudge live', async ({ page }) => {
    await selectItemsById(page, ['item-a', 'item-c']);

    for (let n = 0; n < 4; n++) await page.keyboard.press('ArrowRight');

    await expect(page.locator('#inspector-pos-readout')).toHaveText('44 cm (X), 40 cm (Y)');
    await expect(page.locator('#warning-overlap')).toBeHidden();

    for (let n = 0; n < 50; n++) await page.keyboard.press('ArrowRight');
    await expect(page.locator('#warning-overlap')).toBeVisible();
    await expect(itemLocator(page, 'item-b')).toContainClass('colliding');
  });

  test('a batch finish paints every member in one undo step', async ({ page }) => {
    await selectItemsById(page, ['item-a', 'item-b', 'item-c']);
    await expect(page.locator('.btn-finish.active')).toHaveCount(0);
    const before = await historyState(page);

    await page.click('.btn-finish[data-finish="white"]');

    expect(await finishes(page, ['item-a', 'item-b', 'item-c'])).toEqual(['white', 'white', 'white']);
    await expect(itemLocator(page, 'item-b')).toContainClass('finish-white');
    await expect(page.locator('.btn-finish.active')).toHaveAttribute('data-finish', 'white');
    expect((await historyState(page)).index).toBe(before.index + 1);
    expect(await selectedIds(page)).toEqual(['item-a', 'item-b', 'item-c']);

    await page.keyboard.press('Control+z');
    expect(await finishes(page, ['item-a', 'item-b', 'item-c'])).toEqual(['walnut', 'oak', 'black']);
  });

  test('locked members are reported, and finish changes skip them', async ({ page }) => {
    await loadLayout(page, {
      items: [
        wallItem('item-a', 'cube', 100, 100, { locked: true, finish: 'oak' }),
        wallItem('item-b', 'cube', 250, 100),
      ],
    });
    await selectItemsById(page, ['item-a', 'item-b']);

    await expect(page.locator('.lock-badge')).toHaveText('1 Locked');
    await expect(page.locator('#lock-note')).toContainText('1 of 2 items are locked');
    await expect(page.locator('#delete-item-btn')).toHaveText('Remove 1 Item');

    await page.click('.btn-finish[data-finish="black"]');

    expect(await getItem(page, 'item-a')).toMatchObject({ finish: 'oak' });
    expect(await getItem(page, 'item-b')).toMatchObject({ finish: 'black' });
  });

  test('Lock All and Unlock All flip the whole group in one step each', async ({ page }) => {
    await selectItemsById(page, ['item-a', 'item-b']);
    const before = await historyState(page);

    await page.click('#lock-toggle-btn');

    expect(await getItem(page, 'item-a')).toMatchObject({ locked: true });
    expect(await getItem(page, 'item-b')).toMatchObject({ locked: true });
    await expect(page.locator('#lock-toggle-btn')).toHaveText('Unlock All');
    await expect(page.locator('#delete-item-btn')).toBeDisabled();
    await expect(page.locator('.btn-finish').first()).toBeDisabled();
    expect((await historyState(page)).index).toBe(before.index + 1);

    await page.keyboard.press('l');

    expect(await getItem(page, 'item-a')).toMatchObject({ locked: false });
    expect(await getItem(page, 'item-b')).toMatchObject({ locked: false });
    await expect(page.locator('#lock-toggle-btn')).toHaveText('Lock All');
  });

  test('Duplicate copies the group with one shared offset and selects the copies', async ({ page }) => {
    await loadLayout(page, {
      items: [wallItem('item-a', 'cube', 100, 100, { locked: true }), wallItem('item-edge', 'cube', 660, 200)],
    });
    await selectItemsById(page, ['item-a', 'item-edge']);
    const before = await historyState(page);

    await page.keyboard.press('Control+d');

    const copies = (await getItems(page)).slice(2);
    // The right member is flush with the wall, so the whole copy keeps x and only drops 4 cm
    expect(copies.map(({ left, top, locked }) => ({ left, top, locked }))).toEqual([
      { left: 100, top: 110, locked: false },
      { left: 660, top: 210, locked: false },
    ]);
    expect(await selectedIds(page)).toEqual(copies.map((copy) => copy.id).sort());
    await expect(page.locator('#batch-count')).toHaveText('2 items selected');
    expect((await historyState(page)).index).toBe(before.index + 1);
  });

  test('Delete removes the unlocked members, keeps the locked one selected, and undoes in one step', async ({
    page,
  }) => {
    await loadLayout(page, {
      items: [
        wallItem('item-a', 'cube', 100, 100, { locked: true }),
        wallItem('item-b', 'cube', 250, 100),
        wallItem('item-c', 'cube', 100, 300),
      ],
    });
    await selectItemsById(page, ['item-a', 'item-b', 'item-c']);
    await expect(page.locator('#delete-item-btn')).toHaveText('Remove 2 Items');

    await page.keyboard.press('Delete');

    expect(await itemOrder(page)).toEqual(['item-a']);
    expect(await selectedIds(page)).toEqual(['item-a']);
    await expect(page.locator('.selected-item-title')).toHaveText('Modular Cube');
    await expect(page.locator('.lock-badge')).toContainText('Locked');

    await page.keyboard.press('Delete');
    expect(await itemOrder(page)).toEqual(['item-a']);

    await page.keyboard.press('Control+z');
    expect(await itemOrder(page)).toEqual(['item-a', 'item-b', 'item-c']);
  });

  test('the layer buttons hop a split group up one layer at a time and keep its order', async ({ page }) => {
    // c can still drop below b, so Send Backward stays live even though a is already at the bottom
    await selectItemsById(page, ['item-a', 'item-c']);
    await expect(page.locator('#send-backward-btn')).toBeEnabled();

    await page.click('#bring-forward-btn');
    expect(await itemOrder(page)).toEqual(['item-b', 'item-a', 'item-far', 'item-c']);

    await page.click('#bring-forward-btn');
    expect(await itemOrder(page)).toEqual(['item-b', 'item-far', 'item-a', 'item-c']);
    await expect(page.locator('#bring-forward-btn')).toBeDisabled();
    await expect(page.locator('#send-backward-btn')).toBeEnabled();
  });
});
