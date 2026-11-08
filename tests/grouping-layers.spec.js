import { test, expect } from './support/fixtures.js';
import {
  clickWallAt,
  contextMenuItem,
  downloadFrom,
  dragBy,
  drawMarquee,
  getItem,
  getItems,
  historyState,
  importFile,
  itemLocator,
  itemOrder,
  loadLayout,
  openContextMenu,
  readPixels,
  selectedIds,
  selectItemsById,
  wallItem,
  wallScreenPixels,
} from './support/planner.js';

// a and c share a group, so loading gathers them into one block at c's place: b, a, c, d
const GROUPED = {
  items: [
    wallItem('item-a', 'cube', 100, 100, { groupId: 'tv' }),
    wallItem('item-b', 'cube', 250, 100),
    wallItem('item-c', 'cube', 100, 300, { groupId: 'tv' }),
    wallItem('item-d', 'shelf', 400, 450),
  ],
};

const LOOSE = {
  items: [
    wallItem('item-a', 'cube', 100, 100),
    wallItem('item-b', 'cube', 250, 100),
    wallItem('item-c', 'cube', 100, 300),
    wallItem('item-d', 'shelf', 400, 450),
  ],
};

const row = (page, key) => page.locator(`#layer-list [data-layer="${key}"]`);
const layerKeys = (page) =>
  page.evaluate(() => [...document.querySelectorAll('#layer-list .layer-row')].map((el) => el.dataset.layer));
const paintOrder = (page) =>
  page.evaluate(() => [...document.querySelectorAll('#wall-items .wall-item')].map((el) => el.dataset.id));
const groupOf = async (page, id) => (await getItem(page, id)).groupId;

// Fires the same HTML5 drag events a browser would, with the pointer near the top or bottom edge of the target
function dragLayer(page, fromKey, toKey, place) {
  return page.evaluate(
    ([from, to, where]) => {
      const source = document.querySelector(`#layer-list [data-layer="${from}"]`);
      const target = document.querySelector(`#layer-list [data-layer="${to}"]`);
      const rect = target.getBoundingClientRect();
      const point = { clientX: rect.left + 30, clientY: where === 'above' ? rect.top + 3 : rect.bottom - 3 };
      const dataTransfer = new DataTransfer();
      const fire = (node, type) => {
        const event = new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer, ...point });
        node.dispatchEvent(event);
        return event.defaultPrevented;
      };
      fire(source, 'dragstart');
      const accepted = fire(target, 'dragover');
      fire(target, 'drop');
      fire(source, 'dragend');
      return accepted;
    },
    [fromKey, toKey, place],
  );
}

test.describe('grouping', () => {
  test('Ctrl+G groups the selection, a click picks the whole group, and Ctrl+Shift+G dissolves it', async ({
    page,
  }) => {
    await loadLayout(page, LOOSE);
    await selectItemsById(page, ['item-a', 'item-c']);
    const before = await historyState(page);

    await page.keyboard.press('Control+g');

    const groupId = await groupOf(page, 'item-a');
    expect(groupId).toMatch(/^group-/);
    expect(await groupOf(page, 'item-c')).toBe(groupId);
    expect(await itemOrder(page)).toEqual(['item-b', 'item-a', 'item-c', 'item-d']);
    await expect(page.locator('#batch-count')).toHaveText('Group 1');
    await expect(page.locator('.group-count')).toHaveText('2 items grouped');
    expect((await historyState(page)).index).toBe(before.index + 1);

    await clickWallAt(page, 700, 40);
    await page.click('.wall-item[data-id="item-c"]');
    expect(await selectedIds(page)).toEqual(['item-a', 'item-c']);
    await expect(page.locator('#selection-bounds')).toBeVisible();

    await page.keyboard.press('Control+Shift+G');

    expect(await groupOf(page, 'item-a')).toBeNull();
    expect(await groupOf(page, 'item-c')).toBeNull();
    expect(await selectedIds(page)).toEqual(['item-a', 'item-c']);
    expect((await historyState(page)).index).toBe(before.index + 2);

    await page.keyboard.press('Control+z');
    expect(await groupOf(page, 'item-c')).toBe(groupId);
  });

  test('the marquee and Shift+click take a group as one piece; double-click picks a single member', async ({
    page,
  }) => {
    await loadLayout(page, GROUPED);

    await drawMarquee(page, [80, 80], [120, 120]);
    expect(await selectedIds(page)).toEqual(['item-a', 'item-c']);

    await page.click('.wall-item[data-id="item-b"]', { modifiers: ['Shift'] });
    expect(await selectedIds(page)).toEqual(['item-a', 'item-b', 'item-c']);
    await page.click('.wall-item[data-id="item-c"]', { modifiers: ['Shift'] });
    expect(await selectedIds(page)).toEqual(['item-b']);

    await page.dblclick('.wall-item[data-id="item-c"]');
    expect(await selectedIds(page)).toEqual(['item-c']);
    await expect(page.locator('#group-note')).toContainText('Part of Group 1');

    // A member picked on its own moves on its own
    await dragBy(page, 'item-c', 40, 0, { alt: true });
    expect(await getItem(page, 'item-c')).toMatchObject({ left: 140, top: 300 });
    expect(await getItem(page, 'item-a')).toMatchObject({ left: 100, top: 100 });

    await page.click('#select-group-btn');
    expect(await selectedIds(page)).toEqual(['item-a', 'item-c']);
  });

  test('a group drags, nudges and duplicates as one, and its copies form a new group', async ({ page }) => {
    await loadLayout(page, GROUPED);
    await page.click('.wall-item[data-id="item-a"]');
    const before = await historyState(page);

    await dragBy(page, 'item-a', 50, 0, { alt: true });
    expect(await getItem(page, 'item-a')).toMatchObject({ left: 150, top: 100 });
    expect(await getItem(page, 'item-c')).toMatchObject({ left: 150, top: 300 });
    expect((await historyState(page)).index).toBe(before.index + 1);

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    expect(await getItem(page, 'item-c')).toMatchObject({ top: 305 });

    await page.keyboard.press('Control+d');
    const copies = (await getItems(page)).slice(-2);
    expect(copies.map(({ left, top }) => [left, top])).toEqual([
      [160, 115],
      [160, 315],
    ]);
    expect(copies[0].groupId).toMatch(/^group-/);
    expect(copies[1].groupId).toBe(copies[0].groupId);
    expect(copies[0].groupId).not.toBe('tv');
    expect(await selectedIds(page)).toEqual(copies.map((copy) => copy.id).sort());
    await expect(page.locator('#batch-count')).toHaveText('Group 2');
  });

  test('a group turns as one rigid block and four turns bring it home', async ({ page }) => {
    await loadLayout(page, {
      items: [
        wallItem('item-a', 'cube', 100, 100, { groupId: 'set' }),
        wallItem('item-s', 'shelf', 100, 250, { groupId: 'set' }),
      ],
    });
    await page.click('.wall-item[data-id="item-a"]');

    await page.keyboard.press('r');

    // The shelf along the bottom swings round to the left side, the cube to the top right
    expect(await getItem(page, 'item-a')).toMatchObject({
      left: 232.5,
      top: 47.5,
      width: 90,
      height: 90,
      rotation: 90,
    });
    expect(await getItem(page, 'item-s')).toMatchObject({
      left: 152.5,
      top: 47.5,
      width: 20,
      height: 275,
      rotation: 90,
    });

    for (let turn = 0; turn < 3; turn++) await page.keyboard.press('r');
    expect(await getItem(page, 'item-a')).toMatchObject({ left: 100, top: 100, rotation: 0 });
    expect(await getItem(page, 'item-s')).toMatchObject({ left: 100, top: 250, width: 275, height: 20, rotation: 0 });
  });

  test('layer moves shift a group as one block, and a member picked alone reorders inside it', async ({ page }) => {
    await loadLayout(page, GROUPED);
    expect(await itemOrder(page)).toEqual(['item-b', 'item-a', 'item-c', 'item-d']);

    await page.click('.wall-item[data-id="item-d"]');
    await page.click('#send-backward-btn');
    expect(await itemOrder(page)).toEqual(['item-b', 'item-d', 'item-a', 'item-c']);

    await page.dblclick('.wall-item[data-id="item-c"]');
    await page.click('#send-backward-btn');
    expect(await itemOrder(page)).toEqual(['item-b', 'item-d', 'item-c', 'item-a']);
    await expect(page.locator('#send-backward-btn')).toBeDisabled();
  });

  test('the context menu and the Inspector both group and ungroup', async ({ page }) => {
    await loadLayout(page, LOOSE);
    await selectItemsById(page, ['item-a', 'item-b']);

    await openContextMenu(page, 'item-a');
    await expect(contextMenuItem(page, 'group')).toBeEnabled();
    await expect(contextMenuItem(page, 'ungroup')).toBeDisabled();
    await contextMenuItem(page, 'group').click();
    expect(await groupOf(page, 'item-b')).toBe(await groupOf(page, 'item-a'));

    await openContextMenu(page, 'item-b');
    await expect(page.locator('#context-menu-title')).toHaveText('Group 1');
    await expect(contextMenuItem(page, 'group')).toBeDisabled();
    await contextMenuItem(page, 'ungroup').click();
    expect(await groupOf(page, 'item-a')).toBeNull();

    await expect(page.locator('#group-toggle-btn')).toHaveText('Group Selection');
    await page.click('#group-toggle-btn');
    await expect(page.locator('#group-toggle-btn')).toHaveText('Ungroup');
    await expect(page.locator('#batch-count')).toHaveText('Group 1');
    await page.click('#group-toggle-btn');
    expect(await groupOf(page, 'item-a')).toBeNull();
  });

  test('a locked member keeps its group from turning or moving', async ({ page }) => {
    await loadLayout(page, {
      items: [
        wallItem('item-a', 'cube', 100, 100, { groupId: 'set', locked: true }),
        wallItem('item-b', 'cube', 250, 100, { groupId: 'set' }),
      ],
    });
    await page.click('.wall-item[data-id="item-b"]');

    await expect(page.locator('#rotate-item-btn')).toBeDisabled();
    await dragBy(page, 'item-b', 40, 40, { alt: true });
    expect(await getItem(page, 'item-b')).toMatchObject({ left: 250, top: 100 });
  });

  test('groups survive export and reload; lone or malformed ids dissolve and scattered members gather', async ({
    page,
  }) => {
    const status = await importFile(
      page,
      'groups.json',
      JSON.stringify({
        version: '1.5',
        wallItems: [
          wallItem('item-x', 'cube', 0, 0, { groupId: 'solo' }),
          wallItem('item-a', 'cube', 100, 0, { groupId: 'g1' }),
          wallItem('item-b', 'cube', 200, 0),
          wallItem('item-c', 'cube', 300, 0, { groupId: 'g1' }),
          wallItem('item-d', 'cube', 400, 0, { groupId: 'bad id"]' }),
        ],
      }),
    );
    await expect(status).toHaveText('Imported 5 items.');

    expect(await itemOrder(page)).toEqual(['item-x', 'item-b', 'item-a', 'item-c', 'item-d']);
    expect((await getItems(page)).map((item) => item.groupId)).toEqual([null, null, 'g1', 'g1', null]);

    const { buffer } = await downloadFrom(page, '#export-json-btn');
    const file = JSON.parse(buffer.toString('utf8'));
    expect(file.version).toBe('1.7');
    expect(file.wallItems.find((item) => item.id === 'item-c')).toMatchObject({ groupId: 'g1', hidden: false });

    await page.reload();
    expect(await groupOf(page, 'item-a')).toBe('g1');

    await page.dblclick('.wall-item[data-id="item-c"]');
    await page.keyboard.press('Delete');
    expect(await groupOf(page, 'item-a')).toBeNull();
  });
});

test.describe('layer explorer', () => {
  test.beforeEach(async ({ page }) => {
    await loadLayout(page, GROUPED);
  });

  test('lists the stack top to bottom with groups and their members, and collapses', async ({ page }) => {
    expect(await layerKeys(page)).toEqual(['item:item-d', 'group:tv', 'item:item-c', 'item:item-a', 'item:item-b']);
    await expect(page.locator('#layers-count')).toHaveText('4');
    await expect(row(page, 'group:tv').locator('.layer-text')).toHaveText('Group 1');
    await expect(row(page, 'group:tv').locator('.layer-count')).toHaveText('2');
    await expect(row(page, 'item:item-a')).toHaveAttribute('aria-level', '2');

    await page.click('.catalog-item[data-name="Modular Cube"]');
    expect((await layerKeys(page))[0]).toBe(`item:${(await getItems(page)).at(-1).id}`);

    await row(page, 'group:tv').locator('.layer-caret').click();
    await expect(row(page, 'item:item-a')).toHaveCount(0);
    await expect(row(page, 'group:tv')).toHaveAttribute('aria-expanded', 'false');
    await row(page, 'group:tv').locator('.layer-caret').click();
    await expect(row(page, 'item:item-a')).toHaveCount(1);

    await page.click('#layers-toggle');
    await expect(page.locator('#layer-list')).toBeHidden();
    await expect(page.locator('#layers-toggle')).toHaveAttribute('aria-expanded', 'false');
    await page.click('#layers-toggle');
    await expect(page.locator('#layer-list')).toBeVisible();
  });

  test('clicking rows selects on the wall, and selecting on the wall highlights rows', async ({ page }) => {
    await row(page, 'item:item-d').locator('.layer-name').click();
    expect(await selectedIds(page)).toEqual(['item-d']);

    await row(page, 'group:tv').locator('.layer-name').click();
    expect(await selectedIds(page)).toEqual(['item-a', 'item-c']);

    await row(page, 'item:item-a').locator('.layer-name').click();
    expect(await selectedIds(page)).toEqual(['item-a']);

    await row(page, 'item:item-b')
      .locator('.layer-name')
      .click({ modifiers: ['Shift'] });
    expect(await selectedIds(page)).toEqual(['item-a', 'item-b']);

    await page.click('.wall-item[data-id="item-c"]');
    for (const key of ['group:tv', 'item:item-a', 'item:item-c']) {
      await expect(row(page, key)).toContainClass('is-selected');
      await expect(row(page, key)).toHaveAttribute('aria-selected', 'true');
    }
    await expect(row(page, 'item:item-b')).not.toContainClass('is-selected');
  });

  test('dragging rows reorders the stack and the paint order in one undo step each', async ({ page }) => {
    const before = await historyState(page);

    expect(await dragLayer(page, 'item:item-b', 'item:item-d', 'above')).toBe(true);
    expect(await itemOrder(page)).toEqual(['item-a', 'item-c', 'item-d', 'item-b']);
    expect(await paintOrder(page)).toEqual(['item-a', 'item-c', 'item-d', 'item-b']);
    expect((await historyState(page)).index).toBe(before.index + 1);

    // A group row carries its whole block
    expect(await dragLayer(page, 'group:tv', 'item:item-b', 'above')).toBe(true);
    expect(await itemOrder(page)).toEqual(['item-d', 'item-b', 'item-a', 'item-c']);

    // A member row only moves inside its own group
    expect(await dragLayer(page, 'item:item-a', 'item:item-c', 'above')).toBe(true);
    expect(await itemOrder(page)).toEqual(['item-d', 'item-b', 'item-c', 'item-a']);
    expect(await dragLayer(page, 'item:item-a', 'item:item-d', 'below')).toBe(false);
    expect(await itemOrder(page)).toEqual(['item-d', 'item-b', 'item-c', 'item-a']);
    expect((await historyState(page)).index).toBe(before.index + 3);

    await page.keyboard.press('Control+z');
    expect(await itemOrder(page)).toEqual(['item-d', 'item-b', 'item-a', 'item-c']);
  });

  test('a real pointer drag in the browser reorders rows too', async ({ page }) => {
    await row(page, 'item:item-d').dragTo(row(page, 'item:item-b'), { targetPosition: { x: 40, y: 24 } });

    expect(await itemOrder(page)).toEqual(['item-d', 'item-b', 'item-a', 'item-c']);
    expect((await layerKeys(page)).at(-1)).toBe('item:item-d');
  });

  test('the eye hides a layer from the wall, collisions, the marquee and the PNG, but not the budget', async ({
    page,
  }) => {
    await loadLayout(page, { items: [wallItem('item-a', 'cube', 100, 100), wallItem('item-b', 'cube', 150, 100)] });
    await expect(itemLocator(page, 'item-a')).toContainClass('colliding');

    await row(page, 'item:item-b').locator('.layer-eye').click();

    expect(await getItem(page, 'item-b')).toMatchObject({ hidden: true });
    await expect(itemLocator(page, 'item-b')).toHaveCSS('opacity', '0');
    await expect(itemLocator(page, 'item-b')).toHaveCSS('pointer-events', 'none');
    await expect(itemLocator(page, 'item-a')).not.toContainClass('colliding');
    await expect(itemLocator(page, 'item-b')).not.toContainClass('colliding');
    await expect(row(page, 'item:item-b').locator('.layer-eye')).toHaveAttribute('aria-label', 'Show Modular Cube');
    await expect(page.locator('#total-price')).toHaveText('$60.00');

    await drawMarquee(page, [200, 80], [230, 120]);
    expect(await selectedIds(page)).toEqual([]);

    const { buffer } = await downloadFrom(page, '#export-png-btn');
    const [hiddenSpot] = await readPixels(page, buffer, [[220, 180]], 2);
    const [screenSpot] = await wallScreenPixels(page, [[220, 180]]);
    expect(hiddenSpot).toBeNearColor(screenSpot, 6);
    expect(hiddenSpot).toBeNearColor([28, 31, 38], 6);

    await page.keyboard.press('Control+z');
    expect(await getItem(page, 'item-b')).toMatchObject({ hidden: false });
    await expect(itemLocator(page, 'item-a')).toContainClass('colliding');
  });

  test('the eye and padlock on a group row switch every member', async ({ page }) => {
    await row(page, 'group:tv').locator('.layer-lock').click();
    expect(await getItem(page, 'item-a')).toMatchObject({ locked: true });
    expect(await getItem(page, 'item-c')).toMatchObject({ locked: true });
    await expect(row(page, 'group:tv').locator('.layer-lock')).toHaveAttribute('aria-pressed', 'true');

    await row(page, 'item:item-a').locator('.layer-lock').click();
    expect(await getItem(page, 'item-a')).toMatchObject({ locked: false });
    await expect(row(page, 'group:tv').locator('.layer-lock')).toHaveAttribute('aria-pressed', 'false');

    await row(page, 'group:tv').locator('.layer-eye').click();
    expect((await getItems(page)).filter((item) => item.hidden).map((item) => item.id)).toEqual(['item-a', 'item-c']);
    await row(page, 'group:tv').locator('.layer-eye').click();
    expect((await getItems(page)).some((item) => item.hidden)).toBe(false);
  });
});
