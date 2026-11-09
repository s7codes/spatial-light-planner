import { test, expect } from './support/fixtures.js';
import {
  contextMenuItem,
  getItem,
  getItems,
  historyState,
  itemLocator,
  itemOrder,
  loadLayout,
  openContextMenu,
  selectedIds,
  selectItemById,
  selectItemsById,
  wallItem,
} from './support/planner.js';

const LAYOUT = {
  items: [
    wallItem('item-a', 'cube', 100, 100),
    wallItem('item-b', 'cube', 250, 100),
    wallItem('item-c', 'cube', 100, 300),
    wallItem('item-far', 'shelf', 400, 450),
  ],
};

const menu = (page) => page.locator('#context-menu');

const menuLabels = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('#context-menu .context-menu-item')].map((button) => ({
      label: button.querySelector('.context-menu-label').textContent,
      keys: button.querySelector('kbd')?.textContent ?? '',
      disabled: button.disabled,
    })),
  );

test.describe('context menu', () => {
  test.beforeEach(async ({ page }) => {
    await loadLayout(page, LAYOUT);
  });

  test('right-click opens the glass menu at the cursor instead of the browser menu', async ({ page }) => {
    await page.evaluate(() => {
      window.menuDefaultPrevented = null;
      document.addEventListener('contextmenu', (e) => (window.menuDefaultPrevented = e.defaultPrevented));
    });
    const item = await itemLocator(page, 'item-a').boundingBox();

    await openContextMenu(page, 'item-a', { x: 30, y: 40 });

    expect(await page.evaluate(() => window.menuDefaultPrevented)).toBe(true);
    const box = await menu(page).boundingBox();
    expect(Math.abs(box.x - (item.x + 30))).toBeLessThanOrEqual(1);
    expect(Math.abs(box.y - (item.y + 40))).toBeLessThanOrEqual(1);

    const style = await menu(page).evaluate((el) => {
      const computed = getComputedStyle(el);
      return {
        filter: computed.backdropFilter,
        background: computed.backgroundColor,
        radius: computed.borderTopLeftRadius,
      };
    });
    expect(style.filter).toContain('blur(16px)');
    expect(style.background).toMatch(/^rgba\(17, 20, 27, 0\.9\d*\)$/);
    expect(style.radius).toBe('10px');

    await expect(page.locator('#context-menu-title')).toHaveText('Modular Cube');
    expect(await menuLabels(page)).toEqual([
      { label: 'Duplicate', keys: 'Ctrl+D', disabled: false },
      { label: 'Group', keys: 'Ctrl+G', disabled: true },
      { label: 'Ungroup', keys: 'Ctrl+Shift+G', disabled: true },
      { label: 'Bring to Front', keys: ']', disabled: false },
      { label: 'Bring Forward', keys: '', disabled: false },
      { label: 'Send Backward', keys: '', disabled: true },
      { label: 'Send to Back', keys: '[', disabled: true },
      { label: 'Rotate 90 Degrees', keys: 'R', disabled: false },
      { label: 'Lock', keys: 'L', disabled: false },
      { label: 'Delete', keys: 'Del', disabled: false },
    ]);
  });

  test('right-clicking outside the selection selects that item; inside a group it targets the group', async ({
    page,
  }) => {
    await selectItemById(page, 'item-a');
    await openContextMenu(page, 'item-b');
    expect(await selectedIds(page)).toEqual(['item-b']);
    await page.keyboard.press('Escape');

    await selectItemsById(page, ['item-a', 'item-b']);
    await openContextMenu(page, 'item-a');

    expect(await selectedIds(page)).toEqual(['item-a', 'item-b']);
    await expect(page.locator('#context-menu-title')).toHaveText('2 items selected');
    await expect(contextMenuItem(page, 'lock')).toHaveText(/Lock All/);
  });

  test('Duplicate copies the whole group, selects the copies and closes the menu', async ({ page }) => {
    await selectItemsById(page, ['item-a', 'item-b']);
    const before = await historyState(page);

    await openContextMenu(page, 'item-b');
    await contextMenuItem(page, 'duplicate').click();

    await expect(menu(page)).toBeHidden();
    const items = await getItems(page);
    expect(items).toHaveLength(6);
    const copies = items.slice(4);
    expect(copies.map(({ left, top }) => [left, top])).toEqual([
      [110, 110],
      [260, 110],
    ]);
    expect(await selectedIds(page)).toEqual(copies.map((copy) => copy.id).sort());
    expect((await historyState(page)).index).toBe(before.index + 1);
  });

  test('Bring Forward and Send Backward shift the group one layer each way', async ({ page }) => {
    await selectItemsById(page, ['item-a', 'item-b']);

    await openContextMenu(page, 'item-a');
    await contextMenuItem(page, 'forward').click();
    expect(await itemOrder(page)).toEqual(['item-c', 'item-a', 'item-b', 'item-far']);

    await openContextMenu(page, 'item-a');
    await contextMenuItem(page, 'backward').click();
    expect(await itemOrder(page)).toEqual(['item-a', 'item-b', 'item-c', 'item-far']);
    expect(await selectedIds(page)).toEqual(['item-a', 'item-b']);
  });

  test('the layer items disable at the ends of the stack', async ({ page }) => {
    await openContextMenu(page, 'item-far');
    await expect(contextMenuItem(page, 'forward')).toBeDisabled();
    await expect(contextMenuItem(page, 'backward')).toBeEnabled();
    await page.keyboard.press('Escape');

    await openContextMenu(page, 'item-a');
    await expect(contextMenuItem(page, 'forward')).toBeEnabled();
    await expect(contextMenuItem(page, 'backward')).toBeDisabled();
  });

  test('Lock flips to Unlock, and Delete skips locked items until only locked ones remain', async ({ page }) => {
    await selectItemsById(page, ['item-a', 'item-b']);

    await openContextMenu(page, 'item-a');
    await contextMenuItem(page, 'lock').click();
    expect(await getItem(page, 'item-a')).toMatchObject({ locked: true });
    expect(await getItem(page, 'item-b')).toMatchObject({ locked: true });

    await openContextMenu(page, 'item-a');
    await expect(contextMenuItem(page, 'lock')).toHaveText(/Unlock All/);
    await expect(contextMenuItem(page, 'delete')).toBeDisabled();
    await contextMenuItem(page, 'lock').click();
    expect(await getItem(page, 'item-b')).toMatchObject({ locked: false });

    await page.evaluate(() => {
      wallItems.find((item) => item.id === 'item-a').locked = true;
    });
    await openContextMenu(page, 'item-b');
    await expect(contextMenuItem(page, 'delete')).toBeEnabled();
    await contextMenuItem(page, 'delete').click();

    expect(await itemOrder(page)).toEqual(['item-a', 'item-c', 'item-far']);
    expect(await selectedIds(page)).toEqual(['item-a']);
  });

  test('an outside press, Escape and a finished action all close it without dropping the selection', async ({
    page,
  }) => {
    await openContextMenu(page, 'item-a');
    await page.click('.logo h1');
    await expect(menu(page)).toBeHidden();
    expect(await selectedIds(page)).toEqual(['item-a']);

    await openContextMenu(page, 'item-a');
    await page.keyboard.press('Escape');
    await expect(menu(page)).toBeHidden();
    expect(await selectedIds(page)).toEqual(['item-a']);

    await openContextMenu(page, 'item-a');
    await contextMenuItem(page, 'forward').click();
    await expect(menu(page)).toBeHidden();
    expect(await selectedIds(page)).toEqual(['item-a']);
  });

  test('arrow keys walk the enabled items and Enter runs the focused one', async ({ page }) => {
    await openContextMenu(page, 'item-far');
    const focused = () =>
      page.evaluate(() => document.activeElement.closest('.context-menu-item')?.dataset.action ?? null);

    expect(await focused()).toBeNull();
    await page.keyboard.press('ArrowDown');
    expect(await focused()).toBe('duplicate');
    // Bring Forward is disabled for the top item, so focus skips it
    await page.keyboard.press('ArrowDown');
    expect(await focused()).toBe('backward');
    await page.keyboard.press('End');
    expect(await focused()).toBe('delete');
    await page.keyboard.press('ArrowDown');
    expect(await focused()).toBe('duplicate');
    await page.keyboard.press('ArrowUp');
    expect(await focused()).toBe('delete');
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowDown');

    await page.keyboard.press('Enter');

    await expect(menu(page)).toBeHidden();
    expect(await itemOrder(page)).toEqual(['item-a', 'item-b', 'item-far', 'item-c']);
  });

  test('a shortcut printed in the menu still works while it is open', async ({ page }) => {
    await openContextMenu(page, 'item-a');

    await page.keyboard.press('l');

    await expect(menu(page)).toBeHidden();
    expect(await getItem(page, 'item-a')).toMatchObject({ locked: true });
  });

  test('near the viewport corner the menu flips to stay fully on screen', async ({ page }) => {
    const viewport = page.viewportSize();
    await page.evaluate(
      ({ x, y }) => {
        getItemElement('item-far').dispatchEvent(
          new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y }),
        );
      },
      { x: viewport.width - 4, y: viewport.height - 4 },
    );

    await expect(menu(page)).toBeVisible();
    const box = await menu(page).boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(8);
    expect(box.y).toBeGreaterThanOrEqual(8);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width - 8);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height - 8);
  });

  test('right-click on bare wall keeps the browser menu, and the item menu stays shut over a dialog', async ({
    page,
  }) => {
    const prevented = await page.evaluate(() => {
      const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 });
      wallCanvas.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(prevented).toBe(false);
    await expect(menu(page)).toBeHidden();

    await page.click('#view-spec-btn');
    await page.evaluate(() =>
      getItemElement('item-a').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })),
    );
    await expect(menu(page)).toBeHidden();
  });
});
