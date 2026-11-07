import { test, expect } from './support/fixtures.js';
import {
  WALL_BORDER,
  allRulersHidden,
  blurActiveElement,
  clickWallAt,
  dragBy,
  getItem,
  getItems,
  historyState,
  itemLocator,
  loadLayout,
  rulerState,
  selectItemById,
  selectedItem,
  topSnapshots,
  wallItem,
} from './support/planner.js';

const inspectorControls = (page) =>
  page.evaluate(() => {
    const find = (selector) => document.querySelector(selector);
    return {
      width: find('#edit-width-cm').disabled,
      height: find('#edit-height-cm').disabled,
      finishes: [...document.querySelectorAll('.btn-finish')].map((button) => button.disabled),
      led: find('#led-toggle-btn').disabled,
      remove: find('#delete-item-btn').disabled,
      duplicate: find('#duplicate-item-btn').disabled,
      lockButton: find('#lock-toggle-btn').disabled,
      backward: find('#send-backward-btn').disabled,
      forward: find('#bring-forward-btn').disabled,
    };
  });

const glowOpacity = (page, id) =>
  page.evaluate((itemId) => getComputedStyle(getItemElement(itemId), '::before').opacity, id);

const itemOrder = (page) => page.evaluate(() => wallItems.map((item) => item.id));
const domOrder = (page) => page.evaluate(() => [...wallItemsLayer.children].map((element) => element.dataset.id));

async function topItemAt(page, x, y) {
  const wall = await page.locator('#wall').boundingBox();
  return page.evaluate(
    ([clientX, clientY]) => document.elementFromPoint(clientX, clientY)?.closest('.wall-item')?.dataset.id ?? null,
    [wall.x + WALL_BORDER + x, wall.y + WALL_BORDER + y],
  );
}

test.describe('duplicate', () => {
  test('Ctrl+D copies the item 4 cm down and right and selects the copy', async ({ page }) => {
    await page.click('.wall-item[data-id="item-2"]');
    const source = await selectedItem(page);
    // Registered after the planner's own listener, so it sees whether the browser default was blocked
    await page.evaluate(() => {
      window.addEventListener('keydown', (event) => {
        if (event.key === 'd') window.duplicatePrevented = event.defaultPrevented;
      });
    });

    await page.keyboard.press('Control+d');

    expect(await page.evaluate(() => window.duplicatePrevented)).toBe(true);
    const copy = await selectedItem(page);
    expect(copy.id).not.toBe(source.id);
    expect(copy).toMatchObject({
      left: source.left + 10,
      top: source.top + 10,
      width: source.width,
      height: source.height,
      type: source.type,
      name: source.name,
      price: source.price,
      finish: source.finish,
    });
    expect(await getItems(page)).toHaveLength(3);
    expect(await rulerState(page, 'wallX')).toMatchObject({ text: `${(source.left + 10) / 2.5} cm` });
  });

  test('the Duplicate Item button works and copies stay inside the wall at the corner', async ({ page }) => {
    await loadLayout(page, { items: [wallItem('item-a', 'cube', 660, 535)] });
    await selectItemById(page, 'item-a');

    await page.click('#duplicate-item-btn');

    const copy = await selectedItem(page);
    expect(copy.id).not.toBe('item-a');
    expect([copy.left + copy.width, copy.top + copy.height]).toEqual([750, 625]);
    expect(await getItems(page)).toHaveLength(2);
  });

  test('undoing a duplicate clears the selection that no longer exists', async ({ page }) => {
    await page.click('.wall-item[data-id="item-2"]');
    await page.keyboard.press('Control+d');

    await page.keyboard.press('Control+z');

    expect(await selectedItem(page)).toBeNull();
    expect(await allRulersHidden(page)).toBe(true);
    await expect(page.locator('#inspector-box')).toContainText('Select or drag an item');
  });

  test('Ctrl+D with nothing selected does nothing', async ({ page }) => {
    await page.keyboard.press('Control+d');

    expect(await getItems(page)).toHaveLength(2);
    expect(await historyState(page)).toMatchObject({ length: 1 });
  });
});

test.describe('locking', () => {
  test.beforeEach(async ({ page }) => {
    await loadLayout(page, {
      items: [
        wallItem('item-a', 'cube', 100, 100),
        wallItem('item-b', 'poster', 300, 100),
        wallItem('item-c', 'shelf', 100, 400),
      ],
    });
    await selectItemById(page, 'item-a');
  });

  test('locks size, finish, backlight and removal but keeps duplicate, unlock and layers', async ({ page }) => {
    const lockButton = page.locator('#lock-toggle-btn');
    expect(await inspectorControls(page)).toMatchObject({ width: false, height: false, led: false, remove: false });
    await expect(lockButton).toHaveText('Lock Item');
    await expect(lockButton).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.lock-badge')).toHaveCount(0);

    await lockButton.click();

    const controls = await inspectorControls(page);
    expect(controls).toMatchObject({ width: true, height: true, led: true, remove: true });
    expect(controls.finishes.every(Boolean)).toBe(true);
    expect(controls).toMatchObject({ duplicate: false, lockButton: false, forward: false });
    await expect(lockButton).toHaveText('Unlock Item');
    await expect(lockButton).toHaveAttribute('aria-pressed', 'true');
    await expect(lockButton).toBeFocused();
    await expect(page.locator('.lock-badge')).toHaveText('Locked');
    await expect(page.locator('#lock-note')).toBeVisible();

    const element = itemLocator(page, 'item-a');
    await expect(element).toContainClass('locked');
    await expect(element).toHaveCSS('cursor', 'default');
    await expect(element.locator('.item-label .lock-icon')).toHaveCount(1);

    const [previous, current] = await topSnapshots(page);
    expect([previous.items[0].locked, current.items[0].locked]).toEqual([false, true]);
  });

  test('a locked item cannot be dragged, nudged or deleted', async ({ page }) => {
    await page.click('#lock-toggle-btn');
    const before = await historyState(page);

    await dragBy(page, 'item-a', 60, 40);
    expect(await getItem(page, 'item-a')).toMatchObject({ left: 100, top: 100 });
    expect(await selectedItem(page)).toMatchObject({ id: 'item-a' });
    await expect(page.locator('#lock-note')).toContainClass('is-flashing');

    await blurActiveElement(page);
    for (const key of ['ArrowRight', 'ArrowDown', 'Delete', 'Backspace']) await page.keyboard.press(key);

    expect(await getItem(page, 'item-a')).toMatchObject({ left: 100, top: 100 });
    expect(await historyState(page)).toEqual(before);
  });

  test('L toggles the lock, Ctrl+L is left to the browser and typing L in a field is ignored', async ({ page }) => {
    await page.keyboard.press('l');
    expect(await getItem(page, 'item-a')).toMatchObject({ locked: true });
    await page.keyboard.press('Shift+L');
    expect(await getItem(page, 'item-a')).toMatchObject({ locked: false });
    await page.keyboard.press('Control+l');
    expect(await getItem(page, 'item-a')).toMatchObject({ locked: false });

    await page.focus('#edit-width-cm');
    await page.keyboard.press('l');
    expect(await getItem(page, 'item-a')).toMatchObject({ locked: false });
  });

  test('lock changes are undoable and survive a reload', async ({ page }) => {
    await page.keyboard.press('l');

    await page.keyboard.press('Control+z');
    expect(await getItem(page, 'item-a')).toMatchObject({ locked: false });
    await page.keyboard.press('Control+y');
    expect(await getItem(page, 'item-a')).toMatchObject({ locked: true });

    await page.reload();
    expect(await getItem(page, 'item-a')).toMatchObject({ locked: true });
    await expect(itemLocator(page, 'item-a')).toContainClass('locked');
  });

  test('duplicating a locked item creates an unlocked copy that drags normally', async ({ page }) => {
    await page.keyboard.press('l');
    await page.keyboard.press('Control+d');

    const copy = await selectedItem(page);
    expect(copy).toMatchObject({ locked: false, left: 110 });
    expect(await getItem(page, 'item-a')).toMatchObject({ locked: true });

    await dragBy(page, copy.id, 50, 0, { alt: true });
    expect(await getItem(page, copy.id)).toMatchObject({ left: 160 });
  });

  test('a locked item stays selectable, even when the press ends over the wall', async ({ page }) => {
    await page.keyboard.press('l');
    await clickWallAt(page, 5, 600);
    expect(await selectedItem(page)).toBeNull();

    await page.click('.wall-item[data-id="item-a"]', { position: { x: 10, y: 10 } });
    expect(await selectedItem(page)).toMatchObject({ id: 'item-a' });

    const box = await itemLocator(page, 'item-a').boundingBox();
    await page.mouse.move(box.x + 10, box.y + 10);
    await page.mouse.down();
    await page.mouse.move(box.x + 10, box.y + 250, { steps: 5 });
    await page.mouse.up();
    expect(await selectedItem(page)).toMatchObject({ id: 'item-a' });
  });
});

test.describe('layers', () => {
  test.beforeEach(async ({ page }) => {
    await loadLayout(page, {
      items: [
        wallItem('item-x', 'cube', 100, 100, { finish: 'walnut' }),
        wallItem('item-y', 'cube', 140, 120, { finish: 'oak' }),
        wallItem('item-z', 'cube', 180, 140, { finish: 'black' }),
      ],
    });
    await selectItemById(page, 'item-y');
  });

  test('Send Backward and Bring Forward reorder the data, the DOM and the paint order', async ({ page }) => {
    await expect(page.locator('.layer-readout')).toHaveText('2 of 3');
    expect(await topItemAt(page, 175, 125)).toBe('item-y');

    await page.click('#send-backward-btn');

    expect(await itemOrder(page)).toEqual(['item-y', 'item-x', 'item-z']);
    expect(await domOrder(page)).toEqual(['item-y', 'item-x', 'item-z']);
    expect(await topItemAt(page, 175, 125)).toBe('item-x');
    await expect(page.locator('.layer-readout')).toHaveText('1 of 3');
    await expect(page.locator('#send-backward-btn')).toBeDisabled();

    await page.click('#bring-forward-btn');
    await expect(page.locator('#bring-forward-btn')).toBeFocused();
    await page.click('#bring-forward-btn');

    expect(await itemOrder(page)).toEqual(['item-x', 'item-z', 'item-y']);
    await expect(page.locator('.layer-readout')).toHaveText('3 of 3');
    await expect(page.locator('#bring-forward-btn')).toBeDisabled();
  });

  test('each reorder is one undo step', async ({ page }) => {
    await page.click('#send-backward-btn');
    const [previous, current] = await topSnapshots(page);
    expect(previous.items[0].id).toBe('item-x');
    expect(current.items[0].id).toBe('item-y');

    await page.click('#bring-forward-btn');
    await page.click('#bring-forward-btn');
    await blurActiveElement(page);
    for (let n = 0; n < 3; n++) await page.keyboard.press('Control+z');

    expect(await itemOrder(page)).toEqual(['item-x', 'item-y', 'item-z']);
  });

  test('layer buttons stay available on a locked item', async ({ page }) => {
    await page.keyboard.press('l');

    await expect(page.locator('#send-backward-btn')).toBeEnabled();
    await expect(page.locator('#bring-forward-btn')).toBeEnabled();
    await expect(page.locator('#lock-note')).toBeVisible();
  });
});

test.describe('per-item backlight', () => {
  test.beforeEach(async ({ page }) => {
    await loadLayout(page, {
      items: [wallItem('item-s', 'storage', 100, 100), wallItem('item-p', 'poster', 400, 100)],
    });
    await selectItemById(page, 'item-s');
  });

  test('turning one LED off hides only that glow and is one undo step', async ({ page }) => {
    const toggle = page.locator('#led-toggle-btn');
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await expect(toggle).toHaveText('Backlight LED: ON');
    await expect(toggle).toContainClass('is-on');
    expect(await glowOpacity(page, 'item-s')).toBe('1');
    const before = await historyState(page);

    await toggle.click();

    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await expect(toggle).toHaveText('Backlight LED: OFF');
    await expect(toggle).not.toContainClass('is-on');
    await expect(itemLocator(page, 'item-s')).toContainClass('led-off');
    expect(await getItem(page, 'item-s')).toMatchObject({ ledEnabled: false });
    await expect.poll(() => glowOpacity(page, 'item-s')).toBe('0');
    expect(await glowOpacity(page, 'item-p')).toBe('1');
    expect(await historyState(page)).toMatchObject({ index: before.index + 1 });
  });

  test('undo and redo flip the LED and the inspector together', async ({ page }) => {
    await page.click('#led-toggle-btn');
    await blurActiveElement(page);

    await page.keyboard.press('Control+z');
    await expect(itemLocator(page, 'item-s')).not.toContainClass('led-off');
    await expect(page.locator('#led-toggle-btn')).toHaveText('Backlight LED: ON');

    await page.keyboard.press('Control+y');
    expect(await getItem(page, 'item-s')).toMatchObject({ ledEnabled: false });
  });

  test('the LED state survives duplicate and reload', async ({ page }) => {
    await page.click('#led-toggle-btn');
    await blurActiveElement(page);
    await page.keyboard.press('Control+d');

    const copy = await selectedItem(page);
    expect(copy).toMatchObject({ ledEnabled: false });
    await expect(itemLocator(page, copy.id)).toContainClass('led-off');

    await page.reload();
    expect(await getItem(page, 'item-s')).toMatchObject({ ledEnabled: false });
    await expect(itemLocator(page, 'item-s')).toContainClass('led-off');
  });

  test('Daylight Grid hides every glow, including LEDs that are on', async ({ page }) => {
    await page.click('#theme-toggle-btn');

    await expect.poll(() => glowOpacity(page, 'item-p')).toBe('0');
  });
});
