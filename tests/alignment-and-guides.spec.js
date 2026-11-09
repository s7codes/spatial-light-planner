import { test, expect } from './support/fixtures.js';
import {
  alignmentLines,
  clickWallAt,
  downloadFrom,
  dragBy,
  getItem,
  getItems,
  historyState,
  importFile,
  loadLayout,
  nextFrame,
  readPixels,
  releaseDrag,
  selectedIds,
  selectItemById,
  selectItemsById,
  setWallSize,
  wallItem,
  wallPoint,
  wallScreenPixels,
  wallState,
} from './support/planner.js';

const ARRANGE_LABELS = [
  'Align Left',
  'Align Center',
  'Align Right',
  'Distribute Horizontally',
  'Align Top',
  'Align Middle',
  'Align Bottom',
  'Distribute Vertically',
];

// Box of the three pieces: left 100, right 610, top 40, bottom 290 (wall pixels)
const ALIGN_LAYOUT = {
  items: [
    wallItem('item-a', 'cube', 100, 100),
    wallItem('item-b', 'poster', 300, 40),
    wallItem('item-c', 'cube', 520, 200),
  ],
};

const PAINTS = {
  charcoal: { ambient: [28, 31, 38], daylight: [229, 231, 235] },
  sage: { ambient: [40, 49, 43], daylight: [223, 231, 224] },
  navy: { ambient: [24, 33, 51], daylight: [220, 227, 238] },
};
const rgb = ([r, g, b]) => `rgb(${r}, ${g}, ${b})`;

const arrangeButton = (page, id) => page.locator(`#${id}-btn`);
const positions = async (page, key) => (await getItems(page)).map((item) => item[key]);
const guides = (page) => page.evaluate(() => wallGuides.map(({ axis, cm }) => ({ axis, cm })));
const guideLine = (page, axis) => page.locator(`.wall-guide.axis-${axis}`);

async function arrange(page, ids, action) {
  await selectItemsById(page, ids);
  const before = await historyState(page);
  await arrangeButton(page, action).click();
  return before;
}

// Presses the middle of a ruler and drags out to a wall coordinate, the way a designer pulls a guide
async function pullGuide(page, ruler, to, { release = true } = {}) {
  const box = await page.locator(`#ruler-${ruler}`).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  const target = await wallPoint(page, to[0], to[1]);
  await page.mouse.move(target.x, target.y, { steps: 8 });
  await nextFrame(page);
  if (release) await page.mouse.up();
}

async function dragFromWall(page, from, to, { release = true } = {}) {
  const start = await wallPoint(page, ...from);
  const end = await wallPoint(page, ...to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await nextFrame(page);
  if (release) await page.mouse.up();
}

test.describe('align and distribute', () => {
  test('the controls appear for two or more units with something movable', async ({ page }) => {
    await loadLayout(page, {
      items: [
        wallItem('item-a', 'cube', 100, 100),
        wallItem('item-b', 'cube', 300, 100),
        wallItem('item-c', 'cube', 500, 100),
        wallItem('item-g1', 'cube', 100, 400, { groupId: 'grp' }),
        wallItem('item-g2', 'cube', 200, 400, { groupId: 'grp' }),
        wallItem('item-l1', 'shelf', 300, 500, { locked: true }),
        wallItem('item-l2', 'shelf', 300, 560, { locked: true }),
      ],
    });

    await selectItemById(page, 'item-a');
    await expect(page.locator('.arrange-grid')).toHaveCount(0);

    await selectItemsById(page, ['item-a', 'item-b']);
    const labels = await page.locator('.arrange-btn').evaluateAll((buttons) => buttons.map((b) => b.ariaLabel));
    expect(labels).toEqual(ARRANGE_LABELS);
    await expect(page.locator('.arrange-grid')).toHaveAttribute('role', 'group');
    await expect(arrangeButton(page, 'align-left')).toBeEnabled();
    await expect(arrangeButton(page, 'distribute-h')).toBeDisabled();
    await expect(arrangeButton(page, 'distribute-v')).toHaveAttribute('title', /select 3 or more movable items/);

    await selectItemsById(page, ['item-a', 'item-b', 'item-c']);
    await expect(arrangeButton(page, 'distribute-h')).toBeEnabled();

    // One complete group is a single rigid unit, and an all-locked selection has nothing to move
    await selectItemsById(page, ['item-g1', 'item-g2']);
    await expect(page.locator('#batch-count')).toHaveText('Group 1');
    await expect(page.locator('.arrange-grid')).toHaveCount(0);
    await selectItemsById(page, ['item-l1', 'item-l2']);
    await expect(page.locator('.arrange-grid')).toHaveCount(0);

    // Two movable units plus a locked one can align, but distribution needs three that can move
    await selectItemsById(page, ['item-a', 'item-b', 'item-l1']);
    await expect(arrangeButton(page, 'align-top')).toBeEnabled();
    await expect(arrangeButton(page, 'distribute-h')).toBeDisabled();
  });

  test('each alignment lines up on the selection box as one undo step', async ({ page }) => {
    const cases = [
      ['align-left', 'left', [100, 100, 100]],
      ['align-center', 'left', [310, 292.5, 310]],
      ['align-right', 'left', [520, 485, 520]],
      ['align-top', 'top', [40, 40, 40]],
      ['align-middle', 'top', [120, 77.5, 120]],
      ['align-bottom', 'top', [200, 115, 200]],
    ];

    for (const [action, key, expected] of cases) {
      await loadLayout(page, ALIGN_LAYOUT);
      const other = key === 'left' ? 'top' : 'left';
      const untouched = await positions(page, other);
      const before = await arrange(page, ['item-a', 'item-b', 'item-c'], action);

      expect(await positions(page, key), action).toEqual(expected);
      expect(await positions(page, other)).toEqual(untouched);
      expect((await historyState(page)).index).toBe(before.index + 1);
      expect(await selectedIds(page)).toEqual(['item-a', 'item-b', 'item-c']);

      await page.keyboard.press('Control+z');
      expect(await getItems(page)).toMatchObject(ALIGN_LAYOUT.items.map(({ id, left, top }) => ({ id, left, top })));
    }
  });

  test('centering rounds to whole centimeters, a repeat costs nothing, and the ruler bands follow', async ({
    page,
  }) => {
    // The box is 0 to 101 cm, so a 36 cm cube centers at 32.5 cm and rounds to 33 cm
    await loadLayout(page, { items: [wallItem('item-a', 'cube', 0, 0), wallItem('item-b', 'cube', 162.5, 200)] });
    await selectItemsById(page, ['item-a', 'item-b']);
    await arrangeButton(page, 'align-center').focus();
    await page.keyboard.press('Enter');
    expect(await positions(page, 'left')).toEqual([82.5, 82.5]);
    // The Inspector is rebuilt after the move and hands focus back to the same button
    await expect(arrangeButton(page, 'align-center')).toBeFocused();

    const { scale } = await wallState(page);
    const band = await page.evaluate(() => {
      const span = document.querySelector('#ruler-x .ruler-span');
      return { hidden: span.hidden, left: span.style.left, width: span.style.width };
    });
    expect(band).toEqual({ hidden: false, left: `${82.5 * scale}px`, width: `${90 * scale}px` });

    // Already aligned, so a second press records nothing
    const before = await historyState(page);
    await page.keyboard.press('Enter');
    expect(await historyState(page)).toEqual(before);
  });

  test('groups move as rigid blocks, locked units anchor, and the attic slope holds pieces back', async ({ page }) => {
    await loadLayout(page, {
      items: [
        wallItem('item-g1', 'cube', 100, 300, { groupId: 'grp' }),
        wallItem('item-g2', 'cube', 200, 340, { groupId: 'grp' }),
        wallItem('item-free', 'cube', 400, 200),
        wallItem('item-anchor', 'cube', 600, 100, { locked: true }),
      ],
    });
    await arrange(page, ['item-g1', 'item-g2', 'item-free', 'item-anchor'], 'align-top');
    expect(await positions(page, 'top')).toEqual([100, 140, 100, 100]);

    // The locked cube reaches lowest, so it sets the bottom line without moving itself
    await page.evaluate(() => {
      wallItems.find((item) => item.id === 'item-anchor').top = 400;
      renderPlanner();
    });
    await arrange(page, ['item-g1', 'item-g2', 'item-free', 'item-anchor'], 'align-bottom');
    expect(await getItem(page, 'item-anchor')).toMatchObject({ top: 400 });
    expect(await positions(page, 'top')).toEqual([360, 400, 400, 400]);

    // The slope starts at x = 525 px. Raised to the top, the right cube would cut into it, so it stops
    // at the first whole-centimeter height that keeps it clear: top >= right edge - 525 = 165 px
    await loadLayout(page, {
      atticSlope: true,
      items: [wallItem('item-left', 'cube', 100, 20), wallItem('item-right', 'cube', 600, 300)],
    });
    const before = await arrange(page, ['item-left', 'item-right'], 'align-top');
    expect(await getItem(page, 'item-right')).toMatchObject({ left: 600, top: 165 });
    expect(await getItem(page, 'item-left')).toMatchObject({ top: 20 });
    await expect(page.locator('#io-status')).toHaveText('Kept 1 item clear of the attic slope.');
    await expect(page.locator('.wall-item[data-id="item-right"]')).not.toContainClass('colliding');
    expect((await historyState(page)).index).toBe(before.index + 1);
  });

  test('distribution leaves equal gaps between outer edges, groups included', async ({ page }) => {
    await loadLayout(page, {
      items: [
        wallItem('item-a', 'cube', 0, 100),
        wallItem('item-b', 'cube', 100, 300),
        wallItem('item-c', 'cube', 400, 200),
      ],
    });
    let before = await arrange(page, ['item-a', 'item-b', 'item-c'], 'distribute-h');
    expect(await positions(page, 'left')).toEqual([0, 200, 400]);
    expect(await positions(page, 'top')).toEqual([100, 300, 200]);
    expect((await historyState(page)).index).toBe(before.index + 1);

    await loadLayout(page, {
      items: [
        wallItem('item-a', 'cube', 100, 0),
        wallItem('item-b', 'cube', 300, 50),
        wallItem('item-c', 'cube', 500, 500),
      ],
    });
    await arrange(page, ['item-a', 'item-b', 'item-c'], 'distribute-v');
    expect(await positions(page, 'top')).toEqual([0, 250, 500]);

    // A two-cube group spans 190 px and is spaced as one block between the outer cubes
    await loadLayout(page, {
      items: [
        wallItem('item-a', 'cube', 0, 0),
        wallItem('item-g1', 'cube', 100, 200, { groupId: 'grp' }),
        wallItem('item-g2', 'cube', 200, 260, { groupId: 'grp' }),
        wallItem('item-c', 'cube', 600, 0),
      ],
    });
    await arrange(page, ['item-a', 'item-g1', 'item-g2', 'item-c'], 'distribute-h');
    expect(await positions(page, 'left')).toEqual([0, 250, 350, 600]);

    // 14.5 cm gaps cannot sit on the grid, so the middle cube rounds to 51 cm: gaps of 15 and 14 cm
    await loadLayout(page, {
      items: [
        wallItem('item-a', 'cube', 0, 0),
        wallItem('item-b', 'cube', 100, 200),
        wallItem('item-c', 'cube', 252.5, 400),
      ],
    });
    before = await arrange(page, ['item-a', 'item-b', 'item-c'], 'distribute-h');
    const lefts = await positions(page, 'left');
    expect(lefts).toEqual([0, 127.5, 252.5]);
    expect([(lefts[1] - 90) / 2.5, (lefts[2] - lefts[1] - 90) / 2.5]).toEqual([15, 14]);

    await page.keyboard.press('Control+z');
    expect(await positions(page, 'left')).toEqual([0, 100, 252.5]);
  });
});

test.describe('ruler guides', () => {
  test('dragging from the rulers drops guides onto the wall as single undo steps', async ({ page }) => {
    const before = await historyState(page);

    // While the pointer is still on the ruler the guide waits out of sight
    const box = await page.locator('#ruler-x').boundingBox();
    await page.mouse.move(box.x + 200, box.y + 8);
    await page.mouse.down();
    await page.mouse.move(box.x + 220, box.y + 10);
    await nextFrame(page);
    await expect(guideLine(page, 'y')).toBeHidden();

    const target = await wallPoint(page, 300, 200);
    await page.mouse.move(target.x, target.y, { steps: 6 });
    await nextFrame(page);
    await expect(guideLine(page, 'y')).toBeVisible();
    await expect(guideLine(page, 'y')).toContainClass('is-active');
    await expect(guideLine(page, 'y').locator('.wall-guide-tag')).toHaveText('80 cm');
    await page.mouse.up();

    expect(await guides(page)).toEqual([{ axis: 'y', cm: 80 }]);
    await expect(guideLine(page, 'y')).toHaveAttribute('style', /top: 200px/);
    await expect(guideLine(page, 'y')).not.toContainClass('is-active');
    await expect(page.locator('.guide-hit.axis-y')).toHaveCount(1);
    expect((await historyState(page)).index).toBe(before.index + 1);

    await pullGuide(page, 'y', [412, 300]);
    expect(await guides(page)).toEqual([
      { axis: 'y', cm: 80 },
      { axis: 'x', cm: 165 },
    ]);
    await expect(page.locator('.canvas-rulers')).toHaveCSS('pointer-events', 'none');

    await page.keyboard.press('Control+z');
    expect(await guides(page)).toEqual([{ axis: 'y', cm: 80 }]);
    await page.keyboard.press('Control+y');
    expect(await guides(page)).toHaveLength(2);
  });

  test('a pull that never reaches the wall, or ends with Escape, leaves nothing behind', async ({ page }) => {
    const before = await historyState(page);
    const box = await page.locator('#ruler-y').boundingBox();
    await page.mouse.move(box.x + 8, box.y + 100);
    await page.mouse.down();
    await page.mouse.move(box.x + 6, box.y + 300, { steps: 4 });
    await page.mouse.up();
    expect(await guides(page)).toEqual([]);

    await pullGuide(page, 'x', [300, 300], { release: false });
    await expect(guideLine(page, 'y')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.mouse.up();
    expect(await guides(page)).toEqual([]);
    await expect(page.locator('.wall-guide')).toHaveCount(0);
    expect(await historyState(page)).toEqual(before);

    // Snap 5cm applies to guides as well: 83 cm lands on 85 cm
    await page.click('#snap-grid-toggle');
    await pullGuide(page, 'x', [300, 207.5]);
    expect(await guides(page)).toEqual([{ axis: 'y', cm: 85 }]);
  });

  test('a guide moves by dragging, merges with a twin, and leaves when dragged off or double-clicked', async ({
    page,
  }) => {
    await loadLayout(page, {
      items: [wallItem('item-a', 'cube', 270, 100)],
      wallGuides: [
        { id: 'guide-v', axis: 'x', cm: 100 },
        { id: 'guide-h', axis: 'y', cm: 200 },
        { id: 'guide-w', axis: 'x', cm: 40 },
      ],
    });
    await selectItemById(page, 'item-a');
    const before = await historyState(page);

    await dragFromWall(page, [250, 400], [325, 410]);
    expect(await guides(page)).toEqual([
      { axis: 'x', cm: 130 },
      { axis: 'y', cm: 200 },
      { axis: 'x', cm: 40 },
    ]);
    expect((await historyState(page)).index).toBe(before.index + 1);
    // The release lands on bare wall, yet it is not a click that clears the selection
    expect(await selectedIds(page)).toEqual(['item-a']);

    // The cube sits over the 130 cm line, yet a press on the cube still moves the cube
    await dragBy(page, 'item-a', 40, 0);
    expect(await getItem(page, 'item-a')).toMatchObject({ left: 310 });
    expect((await guides(page))[0]).toEqual({ axis: 'x', cm: 130 });

    // The tag is a handle of its own, even where it sits over furniture
    const tag = await page.locator('.wall-guide[data-guide-id="guide-w"] .wall-guide-tag').boundingBox();
    const twin = await wallPoint(page, 325, 0);
    await page.mouse.move(tag.x + tag.width / 2, tag.y + tag.height / 2);
    await page.mouse.down();
    await page.mouse.move(twin.x, tag.y + tag.height / 2, { steps: 8 });
    await page.mouse.up();
    expect(await guides(page)).toEqual([
      { axis: 'x', cm: 130 },
      { axis: 'y', cm: 200 },
    ]);

    await dragFromWall(page, [600, 500], [600, -20]);
    expect(await guides(page)).toEqual([{ axis: 'x', cm: 130 }]);

    const line = await wallPoint(page, 325, 560);
    await page.mouse.dblclick(line.x, line.y);
    expect(await guides(page)).toEqual([]);
    await expect(page.locator('.guide-hit, .wall-guide')).toHaveCount(0);

    await page.keyboard.press('Control+z');
    expect(await guides(page)).toEqual([{ axis: 'x', cm: 130 }]);
  });

  test('items and whole selections snap to guides within 1 cm', async ({ page }) => {
    await loadLayout(page, {
      items: [
        wallItem('item-a', 'cube', 300, 400),
        wallItem('item-b', 'cube', 100, 100),
        wallItem('item-c', 'cube', 200, 140),
      ],
      wallGuides: [
        { axis: 'x', cm: 200 },
        { axis: 'y', cm: 120 },
      ],
    });

    // 107 px brings the right edge to 497.5 px, half a centimeter short of the 500 px guide
    await dragBy(page, 'item-a', 107, 0, { hold: true });
    expect(await alignmentLines(page)).toContainEqual({
      vertical: true,
      left: '500px',
      top: '0px',
      width: '',
      height: '625px',
    });
    await releaseDrag(page);
    expect(await getItem(page, 'item-a')).toMatchObject({ left: 410, top: 400 });

    // The pair's box ends at 297.5 px after the drag, so it snaps down onto the 300 px guide
    await selectItemsById(page, ['item-b', 'item-c']);
    await dragBy(page, 'item-b', 0, 68);
    expect(await getItem(page, 'item-b')).toMatchObject({ top: 170 });
    expect(await getItem(page, 'item-c')).toMatchObject({ top: 210 });

    // Clicking bare wall still clears the selection, and a box drawn there still selects
    await clickWallAt(page, 700, 600);
    expect(await selectedIds(page)).toEqual([]);
  });

  test('guides travel through export, import, reload and wall resizes, and old files load without them', async ({
    page,
  }) => {
    const status = await importFile(
      page,
      'guides.json',
      JSON.stringify({
        version: '1.7',
        wallItems: [wallItem('item-a', 'cube', 0, 0)],
        wallGuides: [
          { id: 'guide-keep', axis: 'x', cm: 120.4 },
          { axis: 'y', cm: 80 },
          { axis: 'x', cm: 120 },
          { axis: 'z', cm: 10 },
          { axis: 'x', cm: 999 },
          { axis: 'y', cm: -5 },
          { id: '<b>bad</b>', axis: 'y', cm: '240' },
          null,
        ],
      }),
    );
    await expect(status).toHaveText('Imported 1 item.');
    const imported = await page.evaluate(() => wallGuides.map((guide) => ({ ...guide })));
    expect(imported.map(({ axis, cm }) => ({ axis, cm }))).toEqual([
      { axis: 'x', cm: 120 },
      { axis: 'y', cm: 80 },
      { axis: 'y', cm: 240 },
    ]);
    expect(imported[0].id).toBe('guide-keep');
    imported.slice(1).forEach((guide) => expect(guide.id).toMatch(/^guide-[a-z0-9-]+$/));

    const { buffer } = await downloadFrom(page, '#export-json-btn');
    const file = JSON.parse(buffer.toString('utf8'));
    expect(file.version).toBe('1.8');
    expect(file.wallGuides).toEqual(imported);

    await page.reload();
    expect(await guides(page)).toEqual(imported.map(({ axis, cm }) => ({ axis, cm })));
    await expect(page.locator('.wall-guide')).toHaveCount(3);

    // A smaller wall drops only the guides that no longer lie on it
    await setWallSize(page, { width: 150, height: 200 });
    expect(await guides(page)).toEqual([
      { axis: 'x', cm: 120 },
      { axis: 'y', cm: 80 },
    ]);
    await page.keyboard.press('Control+z');
    expect(await guides(page)).toHaveLength(3);

    const capped = Array.from({ length: 15 }, (_, i) => ({ axis: 'x', cm: i * 10 }));
    await loadLayout(page, { items: [], wallGuides: capped });
    expect(await guides(page)).toHaveLength(12);

    // Twelve is the limit, so a thirteenth pull only explains why
    await pullGuide(page, 'x', [300, 300]);
    expect(await guides(page)).toHaveLength(12);
    await expect(page.locator('#io-status')).toHaveText('A wall holds up to 12 guides. Remove one to add another.');

    await importFile(
      page,
      'old.json',
      JSON.stringify({ version: '1.5', wallItems: [wallItem('item-old', 'shelf', 0, 0)] }),
    );
    expect(await guides(page)).toEqual([]);
    expect((await getItems(page)).map((item) => item.id)).toEqual(['item-old']);
  });
});

test.describe('wall paint', () => {
  test('swatches repaint the wall as undo steps and keep Daylight Grid readable', async ({ page }) => {
    const wall = page.locator('#wall');
    await expect(page.locator('.paint-swatch.active')).toHaveAttribute('data-paint', 'charcoal');
    await expect(page.locator('#wall-paint-name')).toHaveText('Charcoal');
    await expect(wall).toHaveCSS('background-color', rgb(PAINTS.charcoal.ambient));
    const labels = await page.locator('.paint-swatch').evaluateAll((buttons) => buttons.map((b) => b.ariaLabel));
    expect(labels).toEqual([
      'Charcoal wall paint',
      'Greige wall paint',
      'Sage wall paint',
      'Navy wall paint',
      'Concrete wall paint',
    ]);

    const before = await historyState(page);
    await page.click('.paint-swatch[data-paint="sage"]');
    await expect(wall).toHaveCSS('background-color', rgb(PAINTS.sage.ambient));
    await expect(page.locator('#wall-paint-name')).toHaveText('Sage');
    await expect(page.locator('.paint-swatch[data-paint="sage"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.paint-swatch[data-paint="charcoal"]')).toHaveAttribute('aria-pressed', 'false');
    expect((await historyState(page)).index).toBe(before.index + 1);

    await page.click('.paint-swatch[data-paint="sage"]');
    expect((await historyState(page)).index).toBe(before.index + 1);

    await page.click('#theme-toggle-btn');
    await expect(wall).toHaveCSS('background-color', rgb(PAINTS.sage.daylight));
    await page.click('#theme-toggle-btn');

    await page.keyboard.press('Control+z');
    await expect(wall).toHaveCSS('background-color', rgb(PAINTS.charcoal.ambient));
    await expect(page.locator('#wall-paint-name')).toHaveText('Charcoal');
    await page.keyboard.press('Control+y');
    await expect(page.locator('#wall-paint-name')).toHaveText('Sage');
  });

  test('the PNG export paints the chosen wall in both modes, matching the screen', async ({ page }) => {
    await loadLayout(page, { items: [] });
    await page.click('.paint-swatch[data-paint="navy"]');

    // Top left is far from the corner glow, and 12 px sits between Daylight Grid lines
    const point = [[12, 12]];
    let screen = await wallScreenPixels(page, point);
    let { buffer } = await downloadFrom(page, '#export-png-btn');
    let [pixel] = await readPixels(page, buffer, point, 2);
    expect(pixel).toBeNearColor(PAINTS.navy.ambient, 3);
    expect(pixel).toBeNearColor(screen[0], 3);

    await page.click('#theme-toggle-btn');
    screen = await wallScreenPixels(page, point);
    ({ buffer } = await downloadFrom(page, '#export-png-btn'));
    [pixel] = await readPixels(page, buffer, point, 2);
    expect(pixel).toBeNearColor(PAINTS.navy.daylight, 3);
    expect(pixel).toBeNearColor(screen[0], 3);
  });

  test('the paint persists per project, survives reloads and templates, and resets with the layout', async ({
    page,
  }) => {
    await page.click('.paint-swatch[data-paint="sage"]');
    await page.reload();
    await expect(page.locator('#wall-paint-name')).toHaveText('Sage');

    await page.click('#projects-btn');
    await page.fill('#new-project-name', 'Navy room');
    await page.click('#save-project-btn');
    await page.click('#close-projects-btn');
    await page.click('.paint-swatch[data-paint="navy"]');

    await page.click('#projects-btn');
    const thumbFill = (name) =>
      page
        .locator('.project-card')
        .filter({ has: page.locator('.project-name').getByText(name, { exact: true }) })
        .locator('.project-thumb-wall')
        .getAttribute('fill');
    expect(await thumbFill('Navy room')).toBe('#182133');
    expect(await thumbFill('Default Project')).toBe('#28312b');
    await page
      .locator('.project-card')
      .filter({ has: page.locator('.project-name').getByText('Default Project', { exact: true }) })
      .locator('[data-action="load"]')
      .click();
    await expect(page.locator('#wall-paint-name')).toHaveText('Sage');

    // A template swaps the composition and its guides, but keeps the look
    await loadLayout(page, { items: [], wallPaint: 'sage', wallGuides: [{ axis: 'x', cm: 50 }] });
    await page.click('.template-btn[data-template="gallery-storage"]');
    await expect(page.locator('#wall-paint-name')).toHaveText('Sage');
    expect(await guides(page)).toEqual([]);

    const { buffer } = await downloadFrom(page, '#export-json-btn');
    expect(JSON.parse(buffer.toString('utf8')).wallPaint).toBe('sage');

    await page.click('#reset-wall-btn');
    await expect(page.locator('#wall-paint-name')).toHaveText('Charcoal');

    await loadLayout(page, { items: [], wallPaint: 'hotpink' });
    await expect(page.locator('#wall-paint-name')).toHaveText('Charcoal');
    await loadLayout(page, { items: [], wallPaint: 'navy' });
    await importFile(page, 'old.json', JSON.stringify({ version: '1.5', wallItems: [] }));
    await expect(page.locator('#wall-paint-name')).toHaveText('Charcoal');
  });
});
