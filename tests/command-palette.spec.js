import { test, expect } from './support/fixtures.js';
import {
  blurActiveElement,
  downloadFrom,
  dragBy,
  dragHandle,
  getItem,
  getItems,
  historyState,
  isModalWithFocus,
  itemLocator,
  loadLayout,
  nextFrame,
  releaseDrag,
  rulerState,
  selectedIds,
  selectItemById,
  selectItemsById,
  wallItem,
} from './support/planner.js';

const SCALE = 2.5;
const leftField = (page) => page.locator('#edit-left-cm');
const topField = (page) => page.locator('#edit-top-cm');
const centerH = (page) => page.locator('#center-wall-h-btn');
const centerV = (page) => page.locator('#center-wall-v-btn');

async function typePosition(page, field, value) {
  await page.fill(field, value);
  await page.press(field, 'Enter');
}

// Cube is 36 x 36 cm (90 x 90 px), the shelf 110 x 8 cm, the storage unit 75 x 38 cm
const COORD_LAYOUT = {
  items: [wallItem('item-a', 'cube', 100, 100), wallItem('item-b', 'shelf', 300, 450)],
};

test.describe('coordinate inputs', () => {
  test.beforeEach(async ({ page }) => {
    await loadLayout(page, COORD_LAYOUT);
    await selectItemById(page, 'item-a');
  });

  test('show the offset in labelled Left X and Top Y fields, limited to the wall, beside the unchanged readout', async ({
    page,
  }) => {
    await expect(page.getByLabel('Left X (cm)')).toHaveValue('40');
    await expect(page.getByLabel('Top Y (cm)')).toHaveValue('40');
    await expect(leftField(page)).toHaveAttribute('min', '0');
    await expect(leftField(page)).toHaveAttribute('max', '264');
    await expect(topField(page)).toHaveAttribute('max', '214');
    await expect(page.locator('#inspector-pos-readout')).toHaveText('40 cm (X), 40 cm (Y)');
  });

  test('typing a position moves the item, updates the readout and rulers, and is one undo step', async ({ page }) => {
    const before = await historyState(page);

    await typePosition(page, '#edit-left-cm', '120');

    expect(await getItem(page, 'item-a')).toMatchObject({ left: 300, top: 100 });
    expect(await page.evaluate(() => getItemElement('item-a').style.left)).toBe('300px');
    await expect(page.locator('#inspector-pos-readout')).toHaveText('120 cm (X), 40 cm (Y)');
    expect((await rulerState(page, 'wallX')).text).toBe('120 cm');
    expect(await page.evaluate(() => rulerX.querySelector('.ruler-span').style.left)).toBe(
      `${300 * (await page.evaluate(() => viewScale))}px`,
    );
    expect((await historyState(page)).index).toBe(before.index + 1);
    await expect(leftField(page)).toBeFocused();

    await typePosition(page, '#edit-top-cm', '160');
    expect(await getItem(page, 'item-a')).toMatchObject({ left: 300, top: 400 });
    expect((await historyState(page)).index).toBe(before.index + 2);

    await blurActiveElement(page);
    await page.keyboard.press('Control+z');
    expect(await getItem(page, 'item-a')).toMatchObject({ left: 300, top: 100 });
    await expect(topField(page)).toHaveValue('40');
    await page.keyboard.press('Control+z');
    expect(await getItem(page, 'item-a')).toMatchObject({ left: 100, top: 100 });
    await expect(leftField(page)).toHaveValue('40');
    await page.keyboard.press('Control+y');
    expect(await getItem(page, 'item-a')).toMatchObject({ left: 300, top: 100 });
  });

  test('typed values are clamped to the wall, rounded to whole centimeters and written back', async ({ page }) => {
    await typePosition(page, '#edit-top-cm', '999');
    expect(await getItem(page, 'item-a')).toMatchObject({ top: 214 * SCALE });
    await expect(topField(page)).toHaveValue('214');

    await typePosition(page, '#edit-left-cm', '-30');
    expect(await getItem(page, 'item-a')).toMatchObject({ left: 0 });
    await expect(leftField(page)).toHaveValue('0');

    await typePosition(page, '#edit-left-cm', '50.6');
    expect(await getItem(page, 'item-a')).toMatchObject({ left: 51 * SCALE });
    await expect(leftField(page)).toHaveValue('51');

    // An empty field falls back to the current offset, and an unchanged value records nothing
    const settled = await historyState(page);
    await typePosition(page, '#edit-left-cm', '');
    await expect(leftField(page)).toHaveValue('51');
    await typePosition(page, '#edit-left-cm', '51');
    expect(await historyState(page)).toEqual(settled);
  });

  test('stay live during drags, nudges and grip resizes without rebuilding the panel or stealing focus', async ({
    page,
  }) => {
    await page.evaluate(() => {
      document.getElementById('edit-left-cm').dataset.tag = 'kept';
    });

    await dragBy(page, 'item-a', 50, 25, { hold: true });
    await expect(leftField(page)).toHaveValue('60');
    await expect(topField(page)).toHaveValue('50');
    await releaseDrag(page);

    await blurActiveElement(page);
    for (let n = 0; n < 3; n++) await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    await expect(leftField(page)).toHaveValue('63');
    await expect(topField(page)).toHaveValue('51');
    await expect(leftField(page)).toHaveAttribute('data-tag', 'kept');

    // 25 px is 10 cm wider, so the item can travel 10 cm less before it meets the right edge
    await dragHandle(page, 'item-a', 'e', 25, 0, { hold: true });
    await expect(leftField(page)).toHaveAttribute('max', '254');
    await page.mouse.up();

    await page.fill('#edit-width-cm', '50');
    await page.press('#edit-width-cm', 'Enter');
    await expect(leftField(page)).toHaveAttribute('max', '250');
    await expect(page.locator('#edit-width-cm')).toBeFocused();
  });

  test('are disabled on a locked item, which also has no centering row', async ({ page }) => {
    await loadLayout(page, { items: [wallItem('item-a', 'cube', 100, 100, { locked: true })] });
    await selectItemById(page, 'item-a');

    await expect(leftField(page)).toBeDisabled();
    await expect(topField(page)).toBeDisabled();
    await expect(centerH(page)).toHaveCount(0);
    await expect(centerV(page)).toHaveCount(0);
  });
});

test.describe('wall centering', () => {
  test('Center H and Center V put a single item on the wall center lines as one undo step each', async ({ page }) => {
    await loadLayout(page, {
      items: [wallItem('item-a', 'cube', 100, 100), wallItem('item-s', 'storage', 50, 400)],
    });
    await selectItemById(page, 'item-a');
    const before = await historyState(page);

    await centerH(page).click();
    expect(await getItem(page, 'item-a')).toMatchObject({ left: 132 * SCALE, top: 100 });
    await expect(leftField(page)).toHaveValue('132');
    await expect(centerH(page)).toBeFocused();

    await centerV(page).click();
    expect(await getItem(page, 'item-a')).toMatchObject({ left: 132 * SCALE, top: 107 * SCALE });
    expect((await historyState(page)).index).toBe(before.index + 2);

    // Already centered: nothing moves and nothing is recorded
    await centerH(page).click();
    expect((await historyState(page)).index).toBe(before.index + 2);

    // (300 - 75) / 2 is 112.5 cm, which rounds onto the whole-cm grid
    await selectItemById(page, 'item-s');
    await centerH(page).click();
    expect(await getItem(page, 'item-s')).toMatchObject({ left: 113 * SCALE, top: 400 });

    await blurActiveElement(page);
    await page.keyboard.press('Control+z');
    expect(await getItem(page, 'item-s')).toMatchObject({ left: 50 });
  });

  test('a multi-selection centers as one rigid block of its movable units, leaving locked ones in place', async ({
    page,
  }) => {
    // Movable box: left 100, right 390, top 100, bottom 240
    await loadLayout(page, {
      items: [
        wallItem('item-a', 'cube', 100, 100),
        wallItem('item-b', 'cube', 300, 150),
        wallItem('item-c', 'cube', 600, 400, { locked: true }),
      ],
    });
    await selectItemsById(page, ['item-a', 'item-b', 'item-c']);
    const before = await historyState(page);

    await centerH(page).click();
    const afterH = await getItems(page);
    expect(afterH.map(({ left, top }) => [left, top])).toEqual([
      [230, 100],
      [430, 150],
      [600, 400],
    ]);
    expect((await historyState(page)).index).toBe(before.index + 1);
    expect(await selectedIds(page)).toEqual(['item-a', 'item-b', 'item-c']);

    // (625 - 140) / 2 = 242.5 px, exactly 97 cm
    await centerV(page).click();
    expect((await getItems(page)).map(({ top }) => top)).toEqual([242.5, 292.5, 400]);
    expect((await historyState(page)).index).toBe(before.index + 2);

    await page.evaluate(() => {
      wallItems.forEach((item) => {
        item.locked = true;
      });
      updateInspectorPanel();
    });
    await expect(centerH(page)).toHaveCount(0);
  });

  test('a centered block stops short of the attic slope and says so', async ({ page }) => {
    // The slope starts 225 px from the right edge, at x = 525 on the 750 px wall
    await loadLayout(page, {
      atticSlope: true,
      items: [wallItem('item-a', 'cube', 0, 0), wallItem('item-b', 'cube', 400, 0)],
    });
    await selectItemsById(page, ['item-a', 'item-b']);

    await centerH(page).click();

    expect((await getItems(page)).map(({ left }) => left)).toEqual([35, 435]);
    expect(await page.evaluate(() => wallItems.some(intrudesAtticSlope))).toBe(false);
    await expect(page.locator('#io-status')).toHaveText('Kept 2 items clear of the attic slope.');
  });
});

const palette = (page) => page.locator('#command-palette');
const options = (page) => page.locator('#command-list [role="option"]');
const optionLabels = (page) => page.locator('#command-list [role="option"] .command-label').allTextContents();
const activeOption = (page) => page.locator('#command-list [role="option"].is-active');

async function openPalette(page) {
  await page.keyboard.press('Control+k');
  await expect(palette(page)).toHaveAttribute('open', '');
}

async function runCommand(page, query) {
  await openPalette(page);
  await page.keyboard.type(query);
  await page.keyboard.press('Enter');
  await expect(palette(page)).not.toHaveAttribute('open');
}

test.describe('command palette', () => {
  test('Ctrl+K, Cmd+K and the HUD button open it with the search focused, and Ctrl+K or Escape close it', async ({
    page,
  }) => {
    await expect(page.locator('.zoom-hud #command-palette-btn')).toHaveAttribute('title', 'Command Palette (Ctrl+K)');

    await openPalette(page);
    expect(await isModalWithFocus(page, '#command-palette')).toBe(true);
    await expect(page.locator('#command-search-input')).toBeFocused();
    await expect(options(page).first()).toContainClass('is-active');
    await expect(options(page).first()).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#command-list')).toHaveAttribute('role', 'listbox');

    await page.keyboard.press('Control+k');
    await expect(palette(page)).not.toHaveAttribute('open');

    await page.keyboard.press('Meta+k');
    await expect(palette(page)).toHaveAttribute('open', '');
    await page.keyboard.press('Escape');
    await expect(palette(page)).not.toHaveAttribute('open');

    await page.click('#command-palette-btn');
    expect(await isModalWithFocus(page, '#command-palette')).toBe(true);
    await page.keyboard.press('Escape');

    // Never stacked on another dialog
    await page.click('#view-spec-btn');
    await page.keyboard.press('Control+k');
    await expect(palette(page)).not.toHaveAttribute('open');
    await expect(page.locator('#spec-modal')).toHaveAttribute('open', '');
  });

  test('a backdrop click or Escape closes it and keeps the wall selection', async ({ page }) => {
    await selectItemById(page, 'item-2');
    await openPalette(page);
    await page.keyboard.press('Escape');
    expect(await selectedIds(page)).toEqual(['item-2']);

    await openPalette(page);
    await page.mouse.click(10, 10);
    await expect(palette(page)).not.toHaveAttribute('open');
    expect(await selectedIds(page)).toEqual(['item-2']);
  });

  test('lists studio actions by category, with selection actions only while something is selected', async ({
    page,
  }) => {
    await openPalette(page);
    await expect(page.locator('.command-group-label')).toHaveText([
      'Mount',
      'Wall & View',
      'Lighting & Paint',
      'Project & Export',
    ]);
    const labels = await optionLabels(page);
    expect(labels.filter((label) => label.startsWith('Mount: '))).toHaveLength(12);
    expect(labels).toEqual(
      expect.arrayContaining([
        'Mount: Floating Shelf',
        'Mount: Wall Socket',
        'Toggle Ambient / Daylight Mode',
        'Toggle Snap 5cm Grid',
        'Toggle Attic Slope',
        'Toggle Power Routing Overlay',
        'Reset Zoom & Pan',
        'Clear Reference Guides',
        'Preset: Warm Walnut',
        'Wall Paint: Sage',
        'Open My Projects',
        'Open Installation Spec Sheet',
        'Export Layout JSON',
        'Export Plan PNG',
        'Export Spec Sheet CSV',
      ]),
    );
    expect(labels).not.toContain('Duplicate Selection');
    await page.keyboard.press('Escape');

    await selectItemById(page, 'item-2');
    await openPalette(page);
    await expect(page.locator('.command-group-label').first()).toHaveText('Selection');
    expect((await optionLabels(page)).slice(0, 5)).toEqual([
      'Center Horizontally on Wall',
      'Center Vertically on Wall',
      'Duplicate Selection',
      'Lock / Unlock Selection',
      'Remove Selection',
    ]);
  });

  test('typing filters by every word across label and category, keeping the first match active', async ({ page }) => {
    await openPalette(page);
    const total = await options(page).count();

    await page.keyboard.type('export png');
    expect(await optionLabels(page)).toEqual(['Export Plan PNG']);
    await expect(activeOption(page)).toHaveText(/Export Plan PNG/);

    // The category counts too: every Project & Export command matches "export"
    await page.fill('#command-search-input', 'EXPORT');
    expect(await optionLabels(page)).toHaveLength(7);
    await expect(options(page).first()).toHaveAttribute('aria-selected', 'true');

    await page.fill('#command-search-input', 'lamp mount');
    expect(await optionLabels(page)).toEqual(['Mount: Corner Floor Lamp']);

    await page.fill('#command-search-input', 'zzz');
    await expect(options(page)).toHaveCount(0);
    await expect(page.locator('#command-empty')).toBeVisible();
    await expect(page.locator('#command-empty')).toHaveText('No commands match "zzz"');
    await page.keyboard.press('Enter');
    await expect(palette(page)).toHaveAttribute('open', '');

    await page.fill('#command-search-input', '');
    await expect(options(page)).toHaveCount(total);
    await expect(page.locator('#command-empty')).toBeHidden();
  });

  test('ArrowDown and ArrowUp cycle the highlight with wrap-around, and Enter runs it', async ({ page }) => {
    await openPalette(page);
    await page.keyboard.type('toggle');
    expect(await optionLabels(page)).toEqual([
      'Toggle Ambient / Daylight Mode',
      'Toggle Snap 5cm Grid',
      'Toggle Attic Slope',
      'Toggle Power Routing Overlay',
    ]);

    await page.keyboard.press('ArrowUp');
    await expect(activeOption(page)).toHaveText(/Power Routing/);
    await page.keyboard.press('ArrowDown');
    await expect(activeOption(page)).toHaveText(/Ambient/);
    await page.keyboard.press('ArrowDown');
    await expect(activeOption(page)).toHaveText(/Snap 5cm/);
    await expect(activeOption(page)).toHaveAttribute('aria-selected', 'true');
    const activeId = await activeOption(page).getAttribute('id');
    await expect(page.locator('#command-search-input')).toHaveAttribute('aria-activedescendant', activeId);
    await expect(page.locator('#command-list [aria-selected="true"]')).toHaveCount(1);

    await page.keyboard.press('Enter');
    await expect(palette(page)).not.toHaveAttribute('open');
    await expect(page.locator('#snap-grid-toggle')).toBeChecked();
  });

  test('hovering moves the highlight and a click runs the row, mounting exactly like the catalog card', async ({
    page,
  }) => {
    await openPalette(page);
    await page.keyboard.type('mount');
    await options(page).nth(2).hover();
    await expect(activeOption(page)).toHaveText(/Compact Storage/);

    await page.fill('#command-search-input', 'mount cube');
    const before = await historyState(page);
    await options(page).first().click();

    await expect(palette(page)).not.toHaveAttribute('open');
    const cube = (await getItems(page)).at(-1);
    // Same cascade as a catalog click: two items on the wall put it at 200 + 40, 220 + 40
    expect(cube).toMatchObject({ type: 'cube', left: 240, top: 260, width: 90, height: 90 });
    expect(await selectedIds(page)).toEqual([cube.id]);
    expect((await historyState(page)).index).toBe(before.index + 1);
  });

  test('commands drive the studio: view toggles, paint, guides, selection, dialogs and exports', async ({ page }) => {
    await loadLayout(page, {
      wallGuides: [{ axis: 'x', cm: 100 }],
      items: [wallItem('item-a', 'cube', 100, 100)],
    });

    await runCommand(page, 'daylight');
    await expect(page.locator('#wall')).toContainClass('daylight-mode');
    await expect(page.locator('#theme-toggle-btn')).toHaveText('Daylight Grid: ON');

    const before = await historyState(page);
    await runCommand(page, 'attic');
    await expect(page.locator('#attic-slope-toggle')).toBeChecked();
    await expect(page.locator('#attic-zone')).toBeVisible();

    await runCommand(page, 'paint navy');
    await expect(page.locator('#wall-paint-name')).toHaveText('Navy');

    await runCommand(page, 'clear guides');
    await expect(page.locator('.wall-guide')).toHaveCount(0);
    expect((await historyState(page)).index).toBe(before.index + 3);
    // Focus does not linger in the closed palette, so the very next shortcut reaches the planner
    expect(await page.evaluate(() => commandPalette.contains(document.activeElement))).toBe(false);
    await page.keyboard.press('Control+z');
    await expect(page.locator('.wall-guide')).toHaveCount(1);

    await runCommand(page, 'power');
    await expect(page.locator('#power-routing-toggle')).toHaveAttribute('aria-checked', 'true');

    await selectItemById(page, 'item-a');
    await runCommand(page, 'center horizontally');
    expect(await getItem(page, 'item-a')).toMatchObject({ left: 132 * SCALE });
    await runCommand(page, 'lock');
    expect(await getItem(page, 'item-a')).toMatchObject({ locked: true });

    await openPalette(page);
    await page.keyboard.type('export layout json');
    const [download] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Enter')]);
    expect(download.suggestedFilename()).toBe('spatial-studio-layout.json');

    await runCommand(page, 'open my projects');
    expect(await isModalWithFocus(page, '#projects-modal')).toBe(true);
    await page.keyboard.press('Escape');

    await runCommand(page, 'spec sheet');
    expect(await isModalWithFocus(page, '#spec-modal')).toBe(true);
  });
});

const powerToggle = (page) => page.locator('#power-routing-toggle');
const summary = (page) => page.locator('#power-routing-summary');
const route = (page, id) => page.locator(`#power-routes .power-route[data-item-id="${id}"]`);
const pill = (page, id) => page.locator(`#power-routes .power-badge[data-item-id="${id}"]`);

// Shelf center (95, 124) cm, poster center (205, 55) cm, lamp center (286, 170) cm with its LED off
const POWER_LAYOUT = {
  items: [
    wallItem('item-s', 'shelf', 100, 300),
    wallItem('item-p', 'poster', 450, 50),
    wallItem('item-l', 'corner-lamp', 690, 250, { ledEnabled: false }),
  ],
};

// An independent check: center-to-center Manhattan distance in whole centimeters
const manhattanCm = (a, b) =>
  Math.round((Math.abs(a.left + a.width / 2 - (b.left + b.width / 2)) + Math.abs(a.top + a.height / 2 - (b.top + b.height / 2))) / SCALE);

test.describe('power routing overlay', () => {
  test('is off by default, keeps the overlay hidden and reads as a labelled switch', async ({ page }) => {
    await expect(powerToggle(page)).toHaveAttribute('role', 'switch');
    await expect(powerToggle(page)).toHaveAttribute('aria-checked', 'false');
    await expect(powerToggle(page)).toHaveAccessibleName('Power Routing: OFF');
    await expect(page.locator('#power-routes')).toBeHidden();
    await expect(page.locator('#power-routes')).toHaveCSS('pointer-events', 'none');
    await expect(summary(page)).toHaveText('Traces each lit item to its nearest socket');
  });

  test('warns without a socket, then routes every lit item orthogonally to the socket placed', async ({ page }) => {
    await loadLayout(page, POWER_LAYOUT);

    await powerToggle(page).click();
    await expect(powerToggle(page)).toHaveAttribute('aria-checked', 'true');
    await expect(powerToggle(page)).toHaveText('Power Routing: ON');
    await expect(page.locator('#power-routes')).toBeVisible();
    await expect(summary(page)).toHaveText('No wall sockets placed (2 powered items)');
    await expect(summary(page)).toContainClass('is-warning');
    await expect(page.locator('.power-route')).toHaveCount(0);

    // Three items on the wall cascade the socket to 260, 280 px: its center is (108, 116) cm
    await page.click('.catalog-item[data-type="socket"]');
    await expect(page.locator('.power-route')).toHaveCount(2);
    await expect(route(page, 'item-s')).toHaveAttribute('d', 'M 237.5 310 V 290 H 270');
    await expect(route(page, 'item-p')).toHaveAttribute('d', 'M 512.5 137.5 V 290 H 270');
    await expect(route(page, 'item-l')).toHaveCount(0);
    await expect(pill(page, 'item-s')).toHaveText('21 cm');
    await expect(pill(page, 'item-p')).toHaveText('158 cm');
    await expect(summary(page)).toHaveText('2 powered | Total 1.8 m | Max 158 cm');
    await expect(summary(page)).not.toContainClass('is-warning');

    const items = await getItems(page);
    const socket = items.find((item) => item.type === 'socket');
    for (const id of ['item-s', 'item-p']) {
      const expected = manhattanCm(
        items.find((item) => item.id === id),
        socket,
      );
      await expect(route(page, id)).toHaveAttribute('data-length', String(expected));
      await expect(route(page, id)).toHaveAttribute('data-socket-id', socket.id);
    }
  });

  test('follows socket drags live, nudges, LED switches, rotations and hidden sockets', async ({ page }) => {
    await loadLayout(page, POWER_LAYOUT);
    await powerToggle(page).click();
    await page.click('.catalog-item[data-type="socket"]');
    const socketId = (await getItems(page)).find((item) => item.type === 'socket').id;

    // A selected 8 cm socket sits under its own resize grip, so it is pressed unselected.
    // 200 x 105 px moves its center to (188, 158) cm.
    await selectItemById(page, null);
    await dragBy(page, socketId, 200, 105, { hold: true });
    await expect(route(page, 'item-s')).toHaveAttribute('d', 'M 237.5 310 V 395 H 470');
    await expect(pill(page, 'item-s')).toHaveText('127 cm');
    await expect(pill(page, 'item-p')).toHaveText('120 cm');
    await expect(summary(page)).toHaveText('2 powered | Total 2.5 m | Max 127 cm');
    await releaseDrag(page);

    await selectItemById(page, 'item-l');
    await page.click('#led-toggle-btn');
    await expect(pill(page, 'item-l')).toHaveText('110 cm');
    await expect(summary(page)).toHaveText('3 powered | Total 3.6 m | Max 127 cm');

    // Turned against the right edge, the lamp is pushed back onto the wall and its center moves to (230, 170) cm
    await blurActiveElement(page);
    await page.keyboard.press('r');
    await expect(pill(page, 'item-l')).toHaveText('54 cm');

    await selectItemById(page, socketId);
    await page.keyboard.press('ArrowLeft');
    await expect(pill(page, 'item-s')).toHaveText('126 cm');
    await expect(route(page, 'item-s')).toHaveAttribute('d', 'M 237.5 310 V 395 H 467.5');

    await page.click(`.layer-row[data-item-id="${socketId}"] .layer-eye`);
    await expect(page.locator('.power-route')).toHaveCount(0);
    await expect(summary(page)).toHaveText('No wall sockets placed (3 powered items)');

    await powerToggle(page).click();
    await expect(page.locator('#power-routes')).toBeHidden();
    await expect(page.locator('#power-routes')).toBeEmpty();
    await expect(summary(page)).toHaveText('Traces each lit item to its nearest socket');
  });

  test('picks the nearest of several sockets and flags runs over 250 cm', async ({ page }) => {
    // Poster center (205, 55) cm; the far socket center is (4, 246) cm, a 392 cm run
    await loadLayout(page, {
      items: [wallItem('item-p', 'poster', 450, 50), wallItem('item-far', 'socket', 0, 605)],
    });
    await powerToggle(page).click();

    await expect(pill(page, 'item-p')).toHaveText('392 cm');
    await expect(pill(page, 'item-p')).toContainClass('is-long-run');
    await expect(route(page, 'item-p')).toContainClass('is-long-run');
    await expect(summary(page)).toHaveText('1 powered | Total 3.9 m | Max 392 cm');
    await expect(summary(page)).toContainClass('is-warning');

    // A second socket just below the poster wins: center (205, 98) cm is a 43 cm run
    await page.evaluate(() => {
      importLayoutText(
        JSON.stringify({
          items: [...wallItems, { id: 'item-near', type: 'socket', left: 502.5, top: 235 }],
        }),
      );
    });
    await expect(route(page, 'item-p')).toHaveAttribute('data-socket-id', 'item-near');
    await expect(pill(page, 'item-p')).toHaveText('43 cm');
    await expect(pill(page, 'item-p')).not.toContainClass('is-long-run');
  });

  test('stays a drafting aid: no history step, no layout change and nothing in the PNG export', async ({ page }) => {
    await loadLayout(page, {
      items: [wallItem('item-p', 'poster', 450, 50), wallItem('item-socket', 'socket', 200, 400)],
    });
    const before = await historyState(page);
    const off = await downloadFrom(page, '#export-png-btn');

    await powerToggle(page).click();
    await nextFrame(page);
    await expect(page.locator('.power-route')).toHaveCount(1);
    expect(await historyState(page)).toEqual(before);
    const on = await downloadFrom(page, '#export-png-btn');

    expect(on.buffer.equals(off.buffer)).toBe(true);
    await expect(itemLocator(page, 'item-p')).toBeVisible();
  });
});
