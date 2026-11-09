import { test, expect } from './support/fixtures.js';
import {
  contextMenuItem,
  historyState,
  itemOrder,
  loadLayout,
  openContextMenu,
  selectItemById,
  selectItemsById,
  wallItem,
} from './support/planner.js';

// Two room features at the bottom of the stack, then four pieces of furniture and a note on top
const LAYOUT = {
  items: [
    wallItem('item-socket', 'socket', 20, 560),
    wallItem('item-door', 'door', 520, 300),
    wallItem('item-a', 'shelf', 40, 40),
    wallItem('item-b', 'cube', 100, 150),
    wallItem('item-c', 'cube', 140, 170),
    wallItem('item-d', 'poster', 300, 100),
    wallItem('item-note', 'note', 300, 400),
  ],
};

const domOrder = (page) =>
  page.evaluate(() => [...document.querySelectorAll('#wall-items .wall-item')].map((el) => el.dataset.id));

const optionLabels = (page) => page.locator('#command-list [role="option"] .command-label').allTextContents();

async function runCommand(page, label) {
  await page.keyboard.press('Control+k');
  await expect(page.locator('#command-palette')).toHaveAttribute('open', '');
  await page.keyboard.type(label);
  await page.keyboard.press('Enter');
  await expect(page.locator('#command-palette')).not.toHaveAttribute('open');
}

test.describe('Bring to Front and Send to Back', () => {
  test.beforeEach(async ({ page }) => {
    await loadLayout(page, LAYOUT);
  });

  test('] lifts the selection to the very top of the stack and the wall paints it last', async ({ page }) => {
    await selectItemById(page, 'item-b');
    await page.keyboard.press(']');

    const expected = ['item-socket', 'item-door', 'item-a', 'item-c', 'item-d', 'item-note', 'item-b'];
    expect(await itemOrder(page)).toEqual(expected);
    expect(await domOrder(page)).toEqual(expected);
  });

  test('[ drops furniture onto the room features, never under them', async ({ page }) => {
    await selectItemById(page, 'item-note');
    await page.keyboard.press('[');
    expect(await itemOrder(page)).toEqual([
      'item-socket', 'item-door', 'item-note', 'item-a', 'item-b', 'item-c', 'item-d',
    ]);

    // Already resting on the features, so a second press changes nothing and records nothing
    const before = await historyState(page);
    await page.keyboard.press('[');
    expect(await historyState(page)).toEqual(before);
  });

  test('a multi-selection keeps its own order at either end', async ({ page }) => {
    await selectItemsById(page, ['item-d', 'item-a']);

    await page.keyboard.press(']');
    expect(await itemOrder(page)).toEqual([
      'item-socket', 'item-door', 'item-b', 'item-c', 'item-note', 'item-a', 'item-d',
    ]);

    await page.keyboard.press('[');
    expect(await itemOrder(page)).toEqual([
      'item-socket', 'item-door', 'item-a', 'item-d', 'item-b', 'item-c', 'item-note',
    ]);
  });

  test('room features stay on the floor of the stack in both directions', async ({ page }) => {
    // A selected feature goes below the other features; selected furniture lands right above them
    await selectItemsById(page, ['item-door', 'item-c']);
    await page.keyboard.press('[');
    expect(await itemOrder(page)).toEqual([
      'item-door', 'item-socket', 'item-c', 'item-a', 'item-b', 'item-d', 'item-note',
    ]);

    // Brought to the front, a feature only rises to the top of the features
    await selectItemById(page, 'item-door');
    await page.keyboard.press(']');
    expect(await itemOrder(page)).toEqual([
      'item-socket', 'item-door', 'item-c', 'item-a', 'item-b', 'item-d', 'item-note',
    ]);

    const furnitureStart = (await itemOrder(page)).indexOf('item-c');
    expect(furnitureStart).toBe(2);
  });

  test('a group moves as one block and never splits', async ({ page }) => {
    await loadLayout(page, {
      items: [
        wallItem('item-socket', 'socket', 20, 560),
        wallItem('item-a', 'shelf', 40, 40),
        wallItem('item-b', 'cube', 100, 150, { groupId: 'set' }),
        wallItem('item-c', 'cube', 250, 150, { groupId: 'set' }),
        wallItem('item-d', 'poster', 400, 100),
      ],
    });
    await page.click('.wall-item[data-id="item-b"]');

    await page.keyboard.press(']');
    expect(await itemOrder(page)).toEqual(['item-socket', 'item-a', 'item-d', 'item-b', 'item-c']);

    await page.keyboard.press('[');
    expect(await itemOrder(page)).toEqual(['item-socket', 'item-b', 'item-c', 'item-a', 'item-d']);
  });

  test('each move is a single undo step', async ({ page }) => {
    await selectItemById(page, 'item-a');
    const before = await historyState(page);

    await page.keyboard.press(']');
    expect(await historyState(page)).toMatchObject({ index: before.index + 1 });

    await page.keyboard.press('Control+z');
    expect(await itemOrder(page)).toEqual(LAYOUT.items.map((item) => item.id));
  });

  test('AltGr brackets count, but Ctrl alone does not', async ({ page }) => {
    await selectItemById(page, 'item-a');
    const press = (init) =>
      page.evaluate((options) => window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...options })), init);

    await press({ key: ']', ctrlKey: true });
    expect((await itemOrder(page)).at(-1)).toBe('item-note');

    await press({ key: ']', ctrlKey: true, altKey: true });
    expect((await itemOrder(page)).at(-1)).toBe('item-a');
  });

  test('the context menu offers both moves with their keys and runs them', async ({ page }) => {
    await openContextMenu(page, 'item-note');
    await expect(contextMenuItem(page, 'front')).toBeDisabled();
    await expect(contextMenuItem(page, 'back')).toBeEnabled();
    await expect(contextMenuItem(page, 'front').locator('kbd')).toHaveText(']');
    await expect(contextMenuItem(page, 'back').locator('kbd')).toHaveText('[');

    await contextMenuItem(page, 'back').click();
    await expect(page.locator('#context-menu')).toBeHidden();
    expect((await itemOrder(page))[2]).toBe('item-note');

    await openContextMenu(page, 'item-note');
    await expect(contextMenuItem(page, 'back')).toBeDisabled();
    await contextMenuItem(page, 'front').click();
    expect((await itemOrder(page)).at(-1)).toBe('item-note');
  });

  test('the command palette lists the moves under Selection, after the pinned entries', async ({ page }) => {
    await selectItemById(page, 'item-b');
    await page.keyboard.press('Control+k');
    const labels = await optionLabels(page);
    expect(labels.slice(0, 5)).toEqual([
      'Center Horizontally on Wall',
      'Center Vertically on Wall',
      'Duplicate Selection',
      'Lock / Unlock Selection',
      'Remove Selection',
    ]);
    expect(labels).toContain('Bring to Front');
    expect(labels).toContain('Send to Back');
    await expect(page.locator('[role="option"]', { hasText: 'Bring to Front' }).locator('.command-hint')).toHaveText(']');
    await page.keyboard.press('Escape');

    await runCommand(page, 'send to back');
    expect(await itemOrder(page)).toEqual([
      'item-socket', 'item-door', 'item-b', 'item-a', 'item-c', 'item-d', 'item-note',
    ]);

    // At the bottom of the furniture, only the opposite move is offered
    await page.keyboard.press('Control+k');
    expect(await optionLabels(page)).not.toContain('Send to Back');
    expect(await optionLabels(page)).toContain('Bring to Front');
  });

  test('the shortcut note documents the brackets without adding a table row', async ({ page }) => {
    await expect(page.locator('#shortcuts-modal .shortcut-table tbody tr')).toHaveCount(10);
    await expect(page.locator('#shortcuts-modal .shortcut-note')).toContainText('sends it to the back');
  });
});
