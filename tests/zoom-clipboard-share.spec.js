import { test, expect } from './support/fixtures.js';
import {
  WALL_BORDER,
  dragBy,
  dragFromCatalog,
  drawMarquee,
  getItem,
  getItems,
  historyState,
  itemLocator,
  loadLayout,
  nextFrame,
  releaseDrag,
  selectedIds,
  selectItemById,
  selectItemsById,
  wallItem,
  wallPoint,
  wallState,
} from './support/planner.js';

const INDEX_KEY = 'spatial_studio_projects_v1';

const viewState = (page) =>
  page.evaluate(() => ({
    zoom: userZoom,
    panX,
    panY,
    scale: viewScale,
    transform: wallCanvas.style.transform,
    label: document.getElementById('zoom-reset-btn').textContent,
  }));

const boxOf = async (page, selector) => {
  const { x, y, width, height } = await page.locator(selector).boundingBox();
  return { x, y, width, height };
};

const ids = async (page) => (await getItems(page)).map((item) => item.id);
const positions = async (page) => (await getItems(page)).map(({ left, top }) => [left, top]);

async function spacePan(page, from, dx, dy) {
  await page.mouse.move(from.x, from.y);
  await page.keyboard.down('Space');
  await page.mouse.down();
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 6 });
  await nextFrame(page);
  await page.mouse.up();
  await page.keyboard.up('Space');
}

// Fresh pages opened by a test are not covered by the fixture, so they get their own error log
function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

async function copyShareLink(page) {
  await page.evaluate(() => {
    window.copiedLink = null;
    navigator.clipboard.writeText = async (text) => {
      window.copiedLink = text;
    };
  });
  await page.click('#projects-btn');
  await page.click('#copy-share-link-btn');
  await expect(page.locator('#copy-share-link-btn')).toHaveText('Link Copied');
  return page.evaluate(() => window.copiedLink);
}

test.describe('viewport zoom and pan', () => {
  test('the HUD zooms in quarter steps about the canvas center and resets to the exact fitted view', async ({
    page,
  }) => {
    const restingWall = await boxOf(page, '#wall');
    const restingRuler = await boxOf(page, '#ruler-x');
    expect(await viewState(page)).toMatchObject({ zoom: 1, panX: 0, panY: 0, transform: '', label: '100%' });
    await expect(page.locator('.zoom-hud')).toHaveCSS('position', 'absolute');
    await expect(page.locator('#zoom-out-btn')).toHaveAttribute('aria-label', 'Zoom out');
    await expect(page.locator('#zoom-in-btn')).toHaveAttribute('title', 'Zoom in (Ctrl+=)');

    await page.click('#zoom-in-btn');
    expect(await viewState(page)).toMatchObject({
      zoom: 1.25,
      scale: 1.25,
      transform: 'translate(0px, 0px) scale(1.25)',
      label: '125%',
    });
    const zoomed = await boxOf(page, '#wall');
    expect(zoomed.x + zoomed.width / 2).toBeCloseTo(restingWall.x + restingWall.width / 2, 0);
    expect(zoomed.width).toBeCloseTo(restingWall.width * 1.25, 0);
    // The note describes the fit, so the topbar text never changes width while zooming
    await expect(page.locator('#scale-note')).toHaveText('(1 cm = 2.5 px)');

    // Ruler ticks scale with the wall: the 100 cm tick sits 312.5 px from the wall's content edge
    const tick = await page.evaluate(() => {
      const mark = document.querySelectorAll('#ruler-x .ruler-tick')[10].getBoundingClientRect();
      return mark.left - (wallCanvas.getBoundingClientRect().left + 2 * viewScale);
    });
    expect(tick).toBeCloseTo(312.5, 1);

    for (let i = 0; i < 5; i++) await page.click('#zoom-in-btn');
    expect((await viewState(page)).label).toBe('250%');
    await expect(page.locator('#zoom-in-btn')).toBeDisabled();

    await page.click('#zoom-reset-btn');
    expect(await viewState(page)).toMatchObject({ zoom: 1, panX: 0, panY: 0, transform: '', label: '100%' });
    expect(await boxOf(page, '#wall')).toEqual(restingWall);
    expect(await boxOf(page, '#ruler-x')).toEqual(restingRuler);

    await page.keyboard.press('Control+-');
    await page.keyboard.press('Control+-');
    expect((await viewState(page)).label).toBe('50%');
    await expect(page.locator('#zoom-out-btn')).toBeDisabled();
    await page.keyboard.press('Control+=');
    expect((await viewState(page)).label).toBe('75%');
    await page.keyboard.press('Control+0');
    expect(await viewState(page)).toMatchObject({ zoom: 1, transform: '' });

    // A fitted wall keeps its exact v1.7 transform and note at rest
    await loadLayout(page, { wallWidthCm: 400, wallHeightCm: 300, items: [] });
    const fitted = await wallState(page);
    expect(fitted.transform).toMatch(/^scale\(0\.\d+\)$/);
    await page.click('#zoom-in-btn');
    expect((await viewState(page)).scale).toBeCloseTo(fitted.scale * 1.25, 6);
    await expect(page.locator('#scale-note')).toHaveText(fitted.note);
    await page.keyboard.press('Control+0');
    expect((await wallState(page)).transform).toBe(fitted.transform);
  });

  test('Ctrl + wheel zooms about the pointer, and a plain wheel leaves the view alone', async ({ page }) => {
    const anchor = await wallPoint(page, 100, 100);
    await page.mouse.move(anchor.x, anchor.y);
    await page.mouse.wheel(0, -100);
    expect((await viewState(page)).zoom).toBe(1);

    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -100);
    await page.mouse.wheel(0, -100);
    await page.keyboard.up('Control');

    const view = await viewState(page);
    expect(view.zoom).toBe(1.2);
    expect(view.label).toBe('120%');
    // The wall point that was under the pointer is still under it, give or take the pan's whole pixel
    const after = await wallPoint(page, 100, 100);
    expect(Math.abs(after.x - anchor.x)).toBeLessThanOrEqual(1.5);
    expect(Math.abs(after.y - anchor.y)).toBeLessThanOrEqual(1.5);

    // The buttons step to the next quarter from there
    await page.click('#zoom-in-btn');
    expect((await viewState(page)).zoom).toBe(1.25);
  });

  test('Space + drag and a middle-button drag pan without moving, selecting or deselecting items', async ({ page }) => {
    await selectItemById(page, 'item-1');
    const before = await historyState(page);
    const items = await positions(page);
    const canvas = page.locator('.canvas-area');

    await page.keyboard.down('Space');
    await expect(canvas).toContainClass('is-pan-ready');
    const poster = await itemLocator(page, 'item-2').boundingBox();
    await page.mouse.move(poster.x + poster.width / 2, poster.y + poster.height / 2);
    await page.mouse.down();
    await page.mouse.move(poster.x + poster.width / 2 + 60, poster.y + poster.height / 2 + 40, { steps: 6 });
    await nextFrame(page);
    await expect(canvas).toContainClass('is-panning');
    await page.mouse.up();
    await page.keyboard.up('Space');
    await expect(canvas).not.toContainClass('is-pan-ready');

    expect(await viewState(page)).toMatchObject({ panX: 60, panY: 40, transform: 'translate(60px, 40px) scale(1)' });
    expect(await positions(page)).toEqual(items);
    expect(await selectedIds(page)).toEqual(['item-1']);
    expect(await historyState(page)).toEqual(before);

    // Middle drag from bare wall: no selection box, and the click guard keeps the selection
    const bare = await wallPoint(page, 650, 80);
    await page.mouse.move(bare.x, bare.y);
    await page.mouse.down({ button: 'middle' });
    await page.mouse.move(bare.x - 30, bare.y + 20, { steps: 5 });
    await nextFrame(page);
    await page.mouse.up({ button: 'middle' });
    expect(await viewState(page)).toMatchObject({ panX: 30, panY: 60 });
    expect(await selectedIds(page)).toEqual(['item-1']);
    await expect(page.locator('#selection-marquee')).toBeHidden();

    // A Space pan that starts and ends on bare wall is not a click that clears the selection
    const open = await wallPoint(page, 640, 560);
    await spacePan(page, open, -10, -10);
    expect(await viewState(page)).toMatchObject({ panX: 20, panY: 50 });
    expect(await selectedIds(page)).toEqual(['item-1']);

    // Escape mid-pan puts the view back
    await page.mouse.move(bare.x, bare.y);
    await page.mouse.down({ button: 'middle' });
    await page.mouse.move(bare.x + 100, bare.y, { steps: 4 });
    await nextFrame(page);
    await page.keyboard.press('Escape');
    await page.mouse.up({ button: 'middle' });
    expect(await viewState(page)).toMatchObject({ panX: 20, panY: 50 });

    // In a text field Space types a space
    await page.evaluate(() => document.getElementById('wall-width-input').focus());
    await page.keyboard.down('Space');
    await expect(canvas).not.toContainClass('is-pan-ready');
    await page.keyboard.up('Space');
  });

  test('items, selection boxes, catalog drops and guides land on exact centimeters at 150% and panned', async ({
    page,
  }) => {
    await page.click('#zoom-in-btn');
    await page.click('#zoom-in-btn');
    const canvas = await page.locator('.canvas-area').boundingBox();
    await spacePan(page, { x: canvas.x + 300, y: canvas.y + 500 }, 60, 40);
    expect(await viewState(page)).toMatchObject({ zoom: 1.5, scale: 1.5, panX: 60, panY: 40 });

    // 75 x 45 screen px is 50 x 30 wall px at 1.5x: 20 cm right, 12 cm down
    const { startX, startY } = await dragBy(page, 'item-2', 75, 45, { hold: true });
    const hairlines = await page.evaluate(() =>
      ['x', 'y'].map((key) => {
        const line = document.querySelector(`#ruler-${key} .ruler-hairline`);
        return { box: line.getBoundingClientRect().toJSON(), text: line.textContent };
      }),
    );
    const origin = await page.evaluate((border) => {
      const rect = wallCanvas.getBoundingClientRect();
      return { left: rect.left + border * viewScale, top: rect.top + border * viewScale };
    }, WALL_BORDER);
    expect(Math.abs(hairlines[0].box.x - (startX + 75))).toBeLessThanOrEqual(1);
    expect(Math.abs(hairlines[1].box.y - (startY + 45))).toBeLessThanOrEqual(1);
    expect(Number(hairlines[0].text)).toBe(Math.round((startX + 75 - origin.left) / 1.5 / 2.5));
    expect(Number(hairlines[1].text)).toBe(Math.round((startY + 45 - origin.top) / 1.5 / 2.5));
    await releaseDrag(page);
    expect(await getItem(page, 'item-2')).toMatchObject({ left: 245, top: 170 });

    // A selection box drawn between two zoomed wall points picks exactly what it crosses
    await drawMarquee(page, [100, 360], [300, 420]);
    expect(await selectedIds(page)).toEqual(['item-1']);

    // A catalog card dropped on a zoomed point is centered there: a 36 cm cube at 400, 100 px
    await dragFromCatalog(page, 'Modular Cube', await wallPoint(page, 400, 100));
    expect((await getItems(page)).at(-1)).toMatchObject({ type: 'cube', left: 355, top: 55 });

    // The top ruler is parked over the zoomed wall now, and still pulls a guide to the exact cm
    const ruler = await page.locator('#ruler-x').boundingBox();
    const target = await wallPoint(page, 500, 250);
    await page.mouse.move(target.x, ruler.y + ruler.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 8 });
    await page.mouse.up();
    expect(await page.evaluate(() => wallGuides.map(({ axis, cm }) => ({ axis, cm })))).toEqual([
      { axis: 'y', cm: 100 },
    ]);
  });
});

test.describe('studio clipboard', () => {
  test('copy and repeated pastes cascade by 4 cm with fresh, unlocked, selected copies', async ({ page }) => {
    await loadLayout(page, { items: [wallItem('item-a', 'shelf', 120, 380, { locked: true })] });
    await selectItemById(page, 'item-a');
    await page.keyboard.press('Control+c');
    await expect(page.locator('#io-status')).toHaveText('Copied 1 item.');

    const before = await historyState(page);
    for (let paste = 1; paste <= 3; paste++) {
      await page.keyboard.press('Control+v');
      const copy = (await getItems(page)).at(-1);
      expect(copy).toMatchObject({ type: 'shelf', left: 120 + 10 * paste, top: 380 + 10 * paste, locked: false });
      expect(await selectedIds(page)).toEqual([copy.id]);
    }
    const all = await ids(page);
    expect(new Set(all).size).toBe(4);
    all.slice(1).forEach((id) => expect(id).toMatch(/^item-[a-z0-9-]+$/));
    expect((await historyState(page)).index).toBe(before.index + 3);

    // A fresh copy starts the cascade over
    await selectItemById(page, 'item-a');
    await page.keyboard.press('Control+c');
    await page.keyboard.press('Control+v');
    expect((await getItems(page)).at(-1)).toMatchObject({ left: 130, top: 390 });

    await page.keyboard.press('Control+z');
    expect(await getItems(page)).toHaveLength(4);
  });

  test('pasted groups come back as new, independent groups in the same stacking order', async ({ page }) => {
    await loadLayout(page, {
      items: [
        wallItem('item-g1', 'cube', 100, 100, { groupId: 'grp' }),
        wallItem('item-g2', 'cube', 200, 100, { groupId: 'grp' }),
        wallItem('item-free', 'shelf', 100, 300),
      ],
    });
    await selectItemsById(page, ['item-g1', 'item-g2', 'item-free']);
    await page.keyboard.press('Control+c');

    await page.keyboard.press('Control+v');
    const first = (await getItems(page)).slice(3);
    expect(first.map(({ type, left, top }) => [type, left, top])).toEqual([
      ['cube', 110, 110],
      ['cube', 210, 110],
      ['shelf', 110, 310],
    ]);
    expect(first[0].groupId).toBeTruthy();
    expect(first[0].groupId).not.toBe('grp');
    expect(first[1].groupId).toBe(first[0].groupId);
    expect(first[2].groupId).toBeNull();

    await page.keyboard.press('Control+v');
    const second = (await getItems(page)).slice(6);
    expect(second[0]).toMatchObject({ left: 120, top: 120 });
    expect(second[0].groupId).not.toBe(first[0].groupId);
    expect(second[1].groupId).toBe(second[0].groupId);
    expect((await getItem(page, 'item-g1')).groupId).toBe('grp');

    // Pasted groups are real groups: one click on a member picks the whole pasted group
    await page.click(`.wall-item[data-id="${second[1].id}"]`);
    expect(await selectedIds(page)).toEqual([second[0].id, second[1].id].sort());

    // A lone member copied on its own pastes as a plain item
    await selectItemsById(page, ['item-g1']);
    await page.keyboard.press('Control+c');
    await page.keyboard.press('Control+v');
    expect((await getItems(page)).at(-1).groupId).toBeNull();
  });

  test('cut removes the unlocked items in one step and keeps locked ones selected on the wall', async ({ page }) => {
    await loadLayout(page, {
      items: [
        wallItem('item-a', 'cube', 100, 100),
        wallItem('item-b', 'cube', 250, 100),
        wallItem('item-l', 'cube', 400, 100, { locked: true }),
      ],
    });
    await selectItemsById(page, ['item-a', 'item-b', 'item-l']);
    const before = await historyState(page);

    await page.keyboard.press('Control+x');
    expect(await ids(page)).toEqual(['item-l']);
    expect(await selectedIds(page)).toEqual(['item-l']);
    expect((await historyState(page)).index).toBe(before.index + 1);
    await expect(page.locator('#io-status')).toHaveText('Cut 2 items; 1 locked stayed on the wall.');

    await page.keyboard.press('Control+v');
    const pasted = (await getItems(page)).slice(1);
    expect(pasted.map(({ left, top, locked }) => [left, top, locked])).toEqual([
      [110, 110, false],
      [260, 110, false],
      [410, 110, false],
    ]);

    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+z');
    expect(await ids(page)).toEqual(['item-a', 'item-b', 'item-l']);
  });

  test('pastes stay on the wall, slide a block clear of the slope, and leave text fields alone', async ({ page }) => {
    // At the bottom-right corner the offset clamps to zero on both axes
    await loadLayout(page, { items: [wallItem('item-edge', 'shelf', 475, 605)] });
    await selectItemById(page, 'item-edge');
    await page.keyboard.press('Control+c');
    await page.keyboard.press('Control+v');
    expect((await getItems(page)).at(-1)).toMatchObject({ left: 475, top: 605 });

    // This block already touches the floor, so its copy can only move right, which would push the
    // shelf 2.5 px into the slope. It slides back to the first clear whole centimeter instead.
    await loadLayout(page, {
      atticSlope: true,
      items: [wallItem('item-shelf', 'shelf', 325, 80), wallItem('item-cube', 'cube', 325, 535)],
    });
    await selectItemsById(page, ['item-shelf', 'item-cube']);
    await page.keyboard.press('Control+c');
    await page.keyboard.press('Control+v');
    const [shelf, cube] = (await getItems(page)).slice(2);
    expect([shelf.left, shelf.top, cube.left, cube.top]).toEqual([330, 80, 330, 535]);
    // The copy overlaps its original, so the slope itself is checked rather than the red flag
    expect(await page.evaluate((id) => intrudesAtticSlope(wallItems.find((item) => item.id === id)), shelf.id)).toBe(
      false,
    );

    // Copy shortcuts inside a field, or with page text selected, stay with the browser
    await page.evaluate(() => {
      clipboardState = { items: [], pasteCount: 0 };
    });
    await page.focus('#wall-width-input');
    await page.keyboard.press('Control+c');
    await page.evaluate(() => {
      document.activeElement.blur();
      const range = document.createRange();
      range.selectNodeContents(document.querySelector('.logo h1'));
      getSelection().removeAllRanges();
      getSelection().addRange(range);
    });
    expect(await page.evaluate(() => getSelection().toString())).toContain('Spatial Studio');
    await page.keyboard.press('Control+c');
    expect(await page.evaluate(() => clipboardState.items.length)).toBe(0);
  });
});

test.describe('horizontal symmetry', () => {
  test('Flip Horizontally mirrors the selection across its own center line in one undo step', async ({ page }) => {
    await loadLayout(page, {
      items: [
        wallItem('item-a', 'cube', 100, 100),
        wallItem('item-b', 'poster', 300, 40),
        wallItem('item-c', 'spotlight', 520, 200, { rotation: 90 }),
      ],
    });
    await selectItemsById(page, ['item-a', 'item-b', 'item-c']);
    const original = await getItems(page);
    // Each piece lands at (box left + box right) minus its own right edge
    const sum =
      Math.min(...original.map((item) => item.left)) + Math.max(...original.map((item) => item.left + item.width));
    const before = await historyState(page);

    await page.click('#flip-horizontal-btn');

    const flipped = await getItems(page);
    expect(flipped.map(({ left, top }) => [left, top])).toEqual(
      original.map((item) => [sum - item.left - item.width, item.top]),
    );
    expect(flipped[0].left).toBe(sum - 190);
    // A right-facing quarter turn becomes a left-facing one
    expect(flipped[2].rotation).toBe(270);
    expect((await historyState(page)).index).toBe(before.index + 1);
    expect(await selectedIds(page)).toEqual(['item-a', 'item-b', 'item-c']);

    await page.keyboard.press('Control+z');
    expect(await positions(page)).toEqual([
      [100, 100],
      [300, 40],
      [520, 200],
    ]);
  });

  test('groups mirror their shape, locked units anchor, and the slope holds a piece back', async ({ page }) => {
    await loadLayout(page, {
      items: [
        wallItem('item-g1', 'cube', 100, 300, { groupId: 'grp' }),
        wallItem('item-g2', 'cube', 200, 340, { groupId: 'grp' }),
        wallItem('item-free', 'cube', 500, 100),
        wallItem('item-anchor', 'cube', 300, 500, { locked: true }),
      ],
    });
    await selectItemsById(page, ['item-g1', 'item-g2', 'item-free', 'item-anchor']);
    await page.click('#flip-horizontal-btn');
    // Box 100 to 590 px: mirror sum 690
    expect(await positions(page)).toEqual([
      [500, 300],
      [400, 340],
      [100, 100],
      [300, 500],
    ]);
    expect((await getItem(page, 'item-g2')).groupId).toBe('grp');

    // Mirrored to 500 px the left cube would cut into the slope, so it stops at 455 px, the last
    // whole centimeter where its top-right corner is still clear
    await loadLayout(page, {
      atticSlope: true,
      items: [wallItem('item-left', 'cube', 100, 20), wallItem('item-right', 'cube', 500, 300)],
    });
    await selectItemsById(page, ['item-left', 'item-right']);
    await page.click('#flip-horizontal-btn');
    expect(await positions(page)).toEqual([
      [455, 20],
      [100, 300],
    ]);
    await expect(page.locator('#io-status')).toHaveText('Kept 1 item clear of the attic slope.');
    await expect(itemLocator(page, 'item-left')).not.toContainClass('colliding');

    // With every unit locked there is nothing to flip
    await loadLayout(page, {
      items: [wallItem('item-x', 'cube', 0, 0, { locked: true }), wallItem('item-y', 'cube', 200, 0, { locked: true })],
    });
    await selectItemsById(page, ['item-x', 'item-y']);
    await expect(page.locator('#flip-horizontal-btn')).toHaveCount(0);
  });

  test('Mirror Across Wall moves a single item to the opposite side, and a centered one stays put', async ({
    page,
  }) => {
    await selectItemById(page, 'item-1');
    await expect(page.locator('#flip-horizontal-btn')).toHaveCount(0);
    const before = await historyState(page);

    await page.click('#mirror-wall-btn');
    expect(await getItem(page, 'item-1')).toMatchObject({ left: 355, top: 380 });
    expect((await historyState(page)).index).toBe(before.index + 1);
    await page.keyboard.press('Control+z');
    expect(await getItem(page, 'item-1')).toMatchObject({ left: 120 });

    // 95 cm from either side of a 300 cm wall: already mirrored onto itself
    await loadLayout(page, { items: [wallItem('item-mid', 'shelf', 237.5, 100)] });
    await selectItemById(page, 'item-mid');
    const centered = await historyState(page);
    await page.click('#mirror-wall-btn');
    expect(await historyState(page)).toEqual(centered);

    await page.keyboard.press('l');
    await expect(page.locator('#mirror-wall-btn')).toBeDisabled();
  });
});

test.describe('share links', () => {
  const SHARED = {
    wallWidthCm: 320,
    wallHeightCm: 240,
    atticSlope: true,
    wallPaint: 'sage',
    accentColor: '#22d3ee',
    wallGuides: [
      { id: 'guide-a', axis: 'x', cm: 100 },
      { id: 'guide-b', axis: 'y', cm: 80 },
    ],
    items: [
      wallItem('item-g1', 'cube', 100, 100, { groupId: 'pair' }),
      wallItem('item-g2', 'cube', 200, 100, { groupId: 'pair' }),
      wallItem('item-spot', 'spotlight', 400, 300, { rotation: 90 }),
      // Character codes keep this file ASCII while the note itself carries non-ASCII text through the link
      wallItem('item-note', 'note', 100, 400, {
        text: `Caf${String.fromCharCode(0xe9)} ${String.fromCharCode(0x2192)} TV`,
      }),
    ],
  };

  const sharedState = (page) =>
    page.evaluate(() => ({
      width: wallWidthCm,
      height: wallHeightCm,
      paint: wallPaint,
      slope: atticSlopeToggle.checked,
      accent: accentColorPicker.value,
      guides: wallGuides.map(({ axis, cm }) => ({ axis, cm })),
      items: wallItems.map(({ id, left, top, groupId, rotation, text }) => ({
        id,
        left,
        top,
        groupId,
        rotation,
        text,
      })),
      hash: location.hash,
    }));

  test('a copied link rebuilds the whole layout in a first-time browser and clears itself', async ({
    page,
    browser,
  }) => {
    await loadLayout(page, SHARED);
    const expected = await sharedState(page);
    const link = await copyShareLink(page);

    const origin = new URL(page.url()).origin;
    expect(link.startsWith(`${origin}/#plan=`)).toBe(true);
    expect(link.slice(link.indexOf('#plan=') + 6)).toMatch(/^[A-Za-z0-9_-]+$/);
    await expect(page.locator('#io-status')).toHaveText('Share link copied. It opens this exact wall in any browser.');
    await expect(page.locator('#copy-share-link-btn')).toHaveText('Copy Share Link', { timeout: 3500 });

    const context = await browser.newContext({ viewport: { width: 1400, height: 820 } });
    const fresh = await context.newPage();
    const errors = watchErrors(fresh);
    await fresh.goto(link);

    expect(await sharedState(fresh)).toEqual({ ...expected, hash: '' });
    expect(new URL(fresh.url()).hash).toBe('');
    await expect(fresh.locator('#io-status')).toHaveText('Opened the shared plan.');
    await expect(fresh.locator('#wall-paint-name')).toHaveText('Sage');
    // A first visit simply fills the fresh Default Project, which keeps it on reload
    const index = await fresh.evaluate((key) => JSON.parse(localStorage.getItem(key)), INDEX_KEY);
    expect(index.projects.map((project) => project.name)).toEqual(['Default Project']);
    await fresh.reload();
    expect((await sharedState(fresh)).items).toEqual(expected.items);
    expect(errors).toEqual([]);
    await context.close();
  });

  test('a returning visitor gets the link as a new project, and a pasted link opens in place', async ({ page }) => {
    await loadLayout(page, SHARED);
    const expected = await sharedState(page);
    const link = await copyShareLink(page);
    await page.click('#close-projects-btn');
    await loadLayout(page, { items: [wallItem('item-mine', 'shelf', 0, 0)] });

    // Pasted into the open tab, the link only changes the hash; it still opens, as a project of its own
    await page.evaluate(
      (hash) => {
        location.hash = hash;
      },
      link.slice(link.indexOf('#')),
    );
    await expect(page.locator('#io-status')).toHaveText('Opened Shared Plan.');
    expect(await sharedState(page)).toEqual({ ...expected, hash: '' });
    expect(await historyState(page)).toMatchObject({ index: 0, length: 1 });

    // A second tab is a returning visitor too, so the link never overwrites the project it would open
    const second = await page.context().newPage();
    const errors = watchErrors(second);
    await second.goto(link);
    expect((await sharedState(second)).items).toEqual(expected.items);
    await expect(second.locator('#io-status')).toHaveText('Opened the shared plan as Shared Plan 2.');
    const index = await second.evaluate((key) => JSON.parse(localStorage.getItem(key)), INDEX_KEY);
    expect(index.projects.map((project) => project.name)).toEqual(['Default Project', 'Shared Plan', 'Shared Plan 2']);
    const mine = index.projects.find((project) => project.name === 'Default Project');
    const saved = await second.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)),
      `spatial_studio_project_v1_${mine.id}`,
    );
    expect(saved.items.map((item) => item.id)).toEqual(['item-mine']);
    await second.close();
    expect(errors).toEqual([]);
  });

  test('a broken or truncated link is reported once and leaves the saved project in charge', async ({ page }) => {
    await loadLayout(page, { items: [wallItem('item-mine', 'shelf', 40, 40)] });
    const link = await copyShareLink(page);
    await page.click('#close-projects-btn');

    // A fresh load each time, since a hash-only change would not restart the page
    for (const hash of ['#plan=bad_data', `#plan=${link.slice(link.indexOf('#plan=') + 6, -40)}`, '#plan=']) {
      await page.goto('about:blank');
      await page.goto(`/${hash}`);
      await expect(page.locator('#io-status')).toHaveText('Share link could not be read.');
      expect(await ids(page)).toEqual(['item-mine']);
      expect(new URL(page.url()).hash).toBe('');
    }

    // A full gallery has no slot for it, so the link explains instead of overwriting anything
    const full = Array.from({ length: 24 }, (_, i) => ({
      id: `project-${i}`,
      name: `Wall ${i + 1}`,
      timestamp: 1000 + i,
    }));
    await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
      key: INDEX_KEY,
      value: { activeId: 'project-0', projects: full },
    });
    await page.goto('about:blank');
    await page.goto(link);
    await expect(page.locator('#io-status')).toHaveText(
      'The shared plan was not opened: the gallery already holds 24 projects.',
    );
    expect(await page.evaluate(() => projects.length)).toBe(24);
  });
});
