import { test, expect } from './support/fixtures.js';
import { blurActiveElement, getItem, getItems, historyState, itemLocator, selectedItem } from './support/planner.js';

const position = async (page, id) => {
  const { left, top } = await getItem(page, id);
  return [left, top];
};

// One drag, a burst of five nudges, then a separate nudge after the merge window has closed
async function recordThreeSteps(page) {
  const box = await itemLocator(page, 'item-2').boundingBox();
  await page.mouse.move(box.x + 30, box.y + 30);
  await page.mouse.down();
  await page.mouse.move(box.x + 130, box.y + 80, { steps: 25 });
  await page.mouse.up();
  const afterDrag = await position(page, 'item-2');

  for (let n = 0; n < 5; n++) await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(700);
  await page.keyboard.press('ArrowDown');

  return afterDrag;
}

test.describe('recording', () => {
  test('starts with one snapshot and both history buttons disabled', async ({ page }) => {
    expect(await historyState(page)).toEqual({ index: 0, length: 1, undoDisabled: true, redoDisabled: true });
    await expect(page.locator('#undo-btn')).toBeDisabled();
    await expect(page.locator('#redo-btn')).toBeDisabled();
  });

  test('a click without movement or a drag back to its start records nothing', async ({ page }) => {
    const box = await itemLocator(page, 'item-2').boundingBox();
    await page.mouse.move(box.x + 30, box.y + 30);
    await page.mouse.down();
    await page.mouse.up();
    expect(await historyState(page)).toMatchObject({ length: 1 });

    await page.mouse.down();
    await page.mouse.move(box.x + 120, box.y + 90, { steps: 6 });
    await page.mouse.move(box.x + 30, box.y + 30, { steps: 6 });
    await page.mouse.up();

    expect(await position(page, 'item-2')).toEqual([195, 140]);
    expect(await historyState(page)).toMatchObject({ length: 1 });
  });

  test('a drag spanning many frames commits exactly one snapshot', async ({ page }) => {
    const box = await itemLocator(page, 'item-2').boundingBox();
    await page.mouse.move(box.x + 30, box.y + 30);
    await page.mouse.down();
    await page.mouse.move(box.x + 130, box.y + 80, { steps: 25 });
    await page.mouse.up();

    expect(await historyState(page)).toEqual({ index: 1, length: 2, undoDisabled: false, redoDisabled: true });
  });

  test('rapid nudges fold into one step and a pause starts a new one', async ({ page }) => {
    await page.click('.wall-item[data-id="item-2"]');
    for (let n = 0; n < 5; n++) await page.keyboard.press('ArrowRight');

    expect(await historyState(page)).toMatchObject({ length: 2 });
    expect(await position(page, 'item-2')).toEqual([207.5, 140]);

    await page.waitForTimeout(700);
    await page.keyboard.press('ArrowDown');
    expect(await historyState(page)).toMatchObject({ length: 3 });
  });

  test('history keeps the newest 30 snapshots', async ({ page }) => {
    await page.click('.wall-item[data-id="item-1"]');
    for (let n = 0; n < 40; n++) await page.locator('.btn-finish:not(.active)').first().click();

    expect(await historyState(page)).toMatchObject({ index: 29, length: 30 });

    for (let n = 0; n < 35; n++) await page.keyboard.press('Control+z');
    expect(await historyState(page)).toMatchObject({ index: 0, undoDisabled: true });
  });
});

test.describe('undo and redo', () => {
  test('undo walks back step by step and stops at the oldest snapshot', async ({ page }) => {
    const afterDrag = await recordThreeSteps(page);

    await page.keyboard.press('Control+z');
    expect(await position(page, 'item-2')).toEqual([afterDrag[0] + 12.5, afterDrag[1]]);
    await page.keyboard.press('Control+z');
    expect(await position(page, 'item-2')).toEqual(afterDrag);
    await page.keyboard.press('Control+z');
    expect(await position(page, 'item-2')).toEqual([195, 140]);
    expect(await historyState(page)).toMatchObject({ index: 0, undoDisabled: true, redoDisabled: false });

    await page.keyboard.press('Control+z');
    expect(await historyState(page)).toMatchObject({ index: 0 });
  });

  test('redo works with Ctrl+Y, Ctrl+Shift+Z and Cmd+Shift+Z', async ({ page }) => {
    const afterDrag = await recordThreeSteps(page);
    for (let n = 0; n < 3; n++) await page.keyboard.press('Control+z');

    await page.keyboard.press('Control+y');
    expect(await position(page, 'item-2')).toEqual(afterDrag);
    await page.keyboard.press('Control+Shift+z');
    expect(await position(page, 'item-2')).toEqual([afterDrag[0] + 12.5, afterDrag[1]]);
    await page.keyboard.press('Meta+Shift+z');
    expect(await position(page, 'item-2')).toEqual([afterDrag[0] + 12.5, afterDrag[1] + 2.5]);

    expect(await historyState(page)).toMatchObject({ redoDisabled: true });
  });

  test('a new action after undo truncates the redo branch and repeats add nothing', async ({ page }) => {
    await recordThreeSteps(page);
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+z');
    const beforeEdit = await historyState(page);

    await page.click('.btn-finish[data-finish="white"]');
    const afterEdit = await historyState(page);
    expect(afterEdit).toMatchObject({ length: beforeEdit.index + 2, redoDisabled: true });

    await page.click('.btn-finish[data-finish="white"]');
    expect(await historyState(page)).toMatchObject({ length: afterEdit.length });
  });

  test('toolbar Undo and Redo buttons mirror the shortcuts', async ({ page }) => {
    await page.click('.wall-item[data-id="item-2"]');
    await page.click('.btn-finish[data-finish="white"]');

    await page.click('#undo-btn');
    expect(await getItem(page, 'item-2')).toMatchObject({ finish: 'black' });
    await page.click('#redo-btn');
    expect(await getItem(page, 'item-2')).toMatchObject({ finish: 'white' });
  });
});

test.describe('undoable actions', () => {
  test('mounting and removing items are single undoable steps', async ({ page }) => {
    await page.click('.catalog-item[data-name="Modular Cube"]');
    expect(await historyState(page)).toMatchObject({ length: 2 });

    await page.click('#delete-item-btn');
    expect(await historyState(page)).toMatchObject({ length: 3 });
    expect((await getItems(page)).some((item) => item.type === 'cube')).toBe(false);

    await page.keyboard.press('Control+z');
    expect((await getItems(page)).some((item) => item.type === 'cube')).toBe(true);
  });

  test('Ctrl+Z right after clicking the attic checkbox undoes the toggle', async ({ page }) => {
    await page.click('#attic-slope-toggle');
    expect(await historyState(page)).toMatchObject({ index: 1 });
    await expect(page.locator('#attic-slope-toggle')).toBeChecked();

    await page.keyboard.press('Control+z');

    await expect(page.locator('#attic-slope-toggle')).not.toBeChecked();
    await expect(page.locator('#attic-zone')).toBeHidden();
  });

  test('inspector size edits are undoable', async ({ page }) => {
    await page.click('.wall-item[data-id="item-2"]');
    await page.fill('#edit-width-cm', '77');
    await page.press('#edit-width-cm', 'Enter');
    expect(await getItem(page, 'item-2')).toMatchObject({ width: 192.5 });

    await blurActiveElement(page);
    await page.keyboard.press('Control+z');
    expect(await getItem(page, 'item-2')).toMatchObject({ width: 125 });
  });

  test('Reset Layout is one undoable step', async ({ page }) => {
    await page.click('.wall-item[data-id="item-2"]');
    await page.keyboard.press('ArrowRight');
    await page.click('#reset-wall-btn');
    expect(await position(page, 'item-2')).toEqual([195, 140]);

    await page.keyboard.press('Control+z');
    expect(await position(page, 'item-2')).toEqual([197.5, 140]);
  });
});

test.describe('text fields', () => {
  test('layout shortcuts stay out of inspector inputs, where native text undo keeps working', async ({ page }) => {
    await page.click('.wall-item[data-id="item-2"]');
    await page.fill('#edit-width-cm', '77');
    const before = await historyState(page);

    await page.focus('#edit-width-cm');
    await page.keyboard.press('Control+z');
    expect(await historyState(page)).toEqual(before);
    await expect(page.locator('#edit-width-cm')).not.toHaveValue('77');

    await page.keyboard.press('Control+d');
    expect(await getItems(page)).toHaveLength(2);
  });

  test('committing a field edit records one step and clears the redo branch', async ({ page }) => {
    await page.click('.wall-item[data-id="item-2"]');
    await page.keyboard.press('ArrowRight');
    await page.click('#undo-btn');
    const before = await historyState(page);
    expect(before.redoDisabled).toBe(false);

    await page.fill('#edit-width-cm', '77');
    await page.press('#edit-width-cm', 'Enter');

    expect(await historyState(page)).toMatchObject({
      index: before.index + 1,
      length: before.index + 2,
      redoDisabled: true,
    });
  });
});

test.describe('persistence', () => {
  test('the layout survives a reload while history starts fresh', async ({ page }) => {
    await page.click('.wall-item[data-id="item-1"]');
    await page.keyboard.press('ArrowRight');

    await page.reload();

    expect(await position(page, 'item-1')).toEqual([122.5, 380]);
    expect(await historyState(page)).toEqual({ index: 0, length: 1, undoDisabled: true, redoDisabled: true });
    expect(await selectedItem(page)).toBeNull();
  });

  test('a corrupt saved state falls back to the starter layout', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('spatial_studio_state_v1', '{bad json'));
    await page.reload();

    expect((await getItems(page)).map((item) => item.id)).toEqual(['item-1', 'item-2']);
  });
});
