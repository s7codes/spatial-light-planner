import { test, expect } from './support/fixtures.js';
import {
  WALL_BORDER,
  blurActiveElement,
  downloadFrom,
  dragBy,
  getItem,
  historyState,
  itemLocator,
  loadLayout,
  readPixels,
  selectedIds,
  selectItemById,
  selectItemsById,
  wallItem,
  wallScreenPixels,
} from './support/planner.js';

const SCALE = 2.5;
const PIXEL_RATIO = 2;
const palette = (page) => page.locator('#command-palette');
const searchInput = (page) => page.locator('#command-search-input');
const backdrop = (page) => page.locator('#floor-backdrop');
const alignRow = (page) => page.locator('#backdrop-align-row');
const artButton = (page, art) => page.locator(`.btn-poster-art[data-poster-art="${art}"]`);

async function runCommand(page, query) {
  await page.keyboard.press('Control+k');
  await expect(palette(page)).toHaveAttribute('open', '');
  await page.keyboard.type(query);
  await page.keyboard.press('Enter');
  await expect(palette(page)).not.toHaveAttribute('open');
}

test.describe('command palette focus release', () => {
  test.beforeEach(async ({ page }) => {
    await loadLayout(page, { items: [wallItem('item-a', 'cube', 100, 100)] });
  });

  test('Escape followed straight away by Ctrl+Z undoes the last layout move, every time', async ({ page }) => {
    let left = 100;
    for (let round = 0; round < 5; round++) {
      await dragBy(page, 'item-a', 25, 0);
      expect((await getItem(page, 'item-a')).left).toBe(left + 25);
      await blurActiveElement(page);

      await page.keyboard.press('Control+k');
      await expect(searchInput(page)).toBeFocused();
      // No waiting between the two keys: the undo must not depend on the queued close event
      await page.keyboard.press('Escape');
      await page.keyboard.press('Control+z');

      await expect(palette(page)).not.toHaveAttribute('open');
      expect((await getItem(page, 'item-a')).left).toBe(left);
      await expect(searchInput(page)).not.toBeFocused();
      // Escape inside the palette only closes it, the wall selection stays
      expect(await selectedIds(page)).toEqual(['item-a']);
      left = (await getItem(page, 'item-a')).left;
    }
  });

  test('a shortcut landing on the search field after the dialog shut still reaches the planner', async ({ page }) => {
    await dragBy(page, 'item-a', 50, 0);
    await blurActiveElement(page);
    const before = await historyState(page);

    await page.keyboard.press('Control+k');
    await expect(palette(page)).toHaveAttribute('open', '');

    // Closes the dialog without the blur and fires Ctrl+Z at the field in the same task, which is exactly
    // the window the old race left open
    const after = await page.evaluate(() => {
      const field = document.getElementById('command-search-input');
      commandPalette.close();
      field.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }));
      return historyIndex;
    });
    expect(after).toBe(before.index - 1);
    expect((await getItem(page, 'item-a')).left).toBe(100);
  });

  test('isTextEntry ignores fields inside a closed dialog and still guards open ones', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { isTextEntry } = await import(new URL('scripts/core/constants.js', document.baseURI).href);
      const field = document.getElementById('command-search-input');
      const closed = isTextEntry(field);
      commandPalette.showModal();
      const open = isTextEntry(field);
      commandPalette.close();
      return { closed, open, wallField: isTextEntry(wallWidthInput), button: isTextEntry(undoBtn) };
    });
    expect(result).toEqual({ closed: false, open: true, wallField: true, button: false });
  });

  test('closing with Ctrl+K or by running a command also lets go of focus at once', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await expect(searchInput(page)).toBeFocused();
    await page.keyboard.press('Control+k');
    await expect(palette(page)).not.toHaveAttribute('open');
    await expect(searchInput(page)).not.toBeFocused();

    await runCommand(page, 'toggle snap');
    await expect(page.locator('#snap-grid-toggle')).toBeChecked();
    await expect(searchInput(page)).not.toBeFocused();
  });
});

// Geometry in wall px, measured from the wall's content box at whatever fit the wall is shown
const backdropBox = (page) =>
  page.evaluate((border) => {
    const wall = wallCanvas.getBoundingClientRect();
    const box = document.getElementById('floor-backdrop').getBoundingClientRect();
    const left = (box.left - wall.left) / viewScale - border;
    const width = box.width / viewScale;
    return {
      width,
      height: box.height / viewScale,
      leftGap: left,
      rightGap: wallWidthPx - left - width,
      floorGap: wallHeightPx - ((box.bottom - wall.top) / viewScale - border),
    };
  }, WALL_BORDER);

async function expectAligned(page, align) {
  const box = await backdropBox(page);
  expect(Math.abs(box.floorGap)).toBeLessThanOrEqual(0.5);
  if (align === 'left') expect(Math.abs(box.leftGap - 16)).toBeLessThanOrEqual(0.5);
  if (align === 'right') expect(Math.abs(box.rightGap - 16)).toBeLessThanOrEqual(0.5);
  if (align === 'center') expect(Math.abs(box.leftGap - box.rightGap)).toBeLessThanOrEqual(1);
  await expect(backdrop(page)).toHaveAttribute('data-align', align);
  for (const option of ['left', 'center', 'right']) {
    await expect(page.locator(`#backdrop-align-${option}-btn`)).toHaveAttribute('aria-pressed', String(option === align));
  }
}

test.describe('sofa backdrop and alignment', () => {
  test('a 200 x 82 cm sofa stands on the floor and moves between left, center and right', async ({ page }) => {
    await loadLayout(page, { items: [wallItem('item-low', 'cube', 330, 520)] });
    await expect(alignRow(page)).toBeHidden();
    const before = await historyState(page);

    await page.click('#backdrop-sofa-btn');
    await expect(page.locator('#backdrop-sofa-btn')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#backdrop-none-btn')).toHaveAttribute('aria-pressed', 'false');
    await expect(backdrop(page)).toHaveAttribute('data-kind', 'sofa');
    await expect(page.locator('.floor-backdrop-tag')).toHaveText('Sofa 200 x 82 cm');
    await expect(alignRow(page)).toBeVisible();

    const box = await backdropBox(page);
    expect(Math.abs(box.width - 200 * SCALE)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(box.height - 82 * SCALE)).toBeLessThanOrEqual(0.5);
    await expectAligned(page, 'center');

    await page.click('#backdrop-align-left-btn');
    await expectAligned(page, 'left');
    await page.click('#backdrop-align-right-btn');
    await expectAligned(page, 'right');

    // The pick survives a change of piece and still lets presses through to the wall
    await page.click('#backdrop-bed-btn');
    await expectAligned(page, 'right');
    await expect(backdrop(page)).toHaveCSS('pointer-events', 'none');
    await page.click('.wall-item[data-id="item-low"]');
    expect(await selectedIds(page)).toEqual(['item-low']);

    await page.click('#backdrop-align-center-btn');
    await expectAligned(page, 'center');

    // A view aid: no undo step, nothing in the layout payload
    expect(await historyState(page)).toEqual(before);
    const payload = await page.evaluate(() => JSON.stringify(layoutPayload()));
    expect(payload).not.toMatch(/sofa|backdrop|align/i);

    await page.click('#backdrop-none-btn');
    await expect(alignRow(page)).toBeHidden();
    await expect(backdrop(page)).toBeHidden();
  });

  test('the palette mounts the sofa and aligns it, and a reload resets both', async ({ page }) => {
    await runCommand(page, 'backdrop sofa');
    await expect(backdrop(page)).toHaveAttribute('data-kind', 'sofa');

    await runCommand(page, 'backdrop align left');
    await expectAligned(page, 'left');
    await runCommand(page, 'backdrop align right');
    await expectAligned(page, 'right');

    await page.keyboard.press('Control+k');
    await page.keyboard.type('backdrop align');
    await expect(page.locator('#command-list [role="option"]').filter({ hasText: 'Backdrop Align: Right' }).locator('.command-hint')).toHaveText('Current');
    await page.keyboard.press('Escape');

    // With no piece on the floor the alignment entries step aside like the Inspector row
    await runCommand(page, 'backdrop none');
    await page.keyboard.press('Control+k');
    await page.keyboard.type('backdrop align');
    await expect(page.locator('#command-empty')).toBeVisible();
    await page.keyboard.press('Escape');

    await page.click('#backdrop-sofa-btn');
    await page.reload();
    await expect(backdrop(page)).toBeHidden();
    await expect(backdrop(page)).toHaveAttribute('data-align', 'center');
    await expect(alignRow(page)).toBeHidden();
  });

  test('the PNG export is identical with the sofa on the floor', async ({ page }) => {
    await loadLayout(page, { items: [wallItem('item-p', 'poster', 450, 50)] });
    const plain = await downloadFrom(page, '#export-png-btn');
    await page.click('#backdrop-sofa-btn');
    await page.click('#backdrop-align-left-btn');
    const withSofa = await downloadFrom(page, '#export-png-btn');
    expect(withSofa.buffer.equals(plain.buffer)).toBe(true);
  });
});

// Poster at (200, 60) px: frame 6 px, mat inset 9 px, so the artwork box spans (215, 75) to (310, 220).
// Each print is a 100 x 150 drawing scaled to cover that box.
const POSTER_LAYOUT = { items: [wallItem('item-p', 'poster', 200, 60), wallItem('item-s', 'shelf', 100, 400)] };
const NOIR = [26, 29, 36];
const ART_SAMPLES = {
  noir: { point: [262, 112], color: NOIR },
  bauhaus: { point: [262, 112], color: [209, 69, 45] },
  botanical: { point: [225, 100], color: [221, 227, 211] },
  horizon: { point: [240, 210], color: [122, 47, 43] },
};

test.describe('curated poster artworks', () => {
  test('posters default to noir and the Inspector switches prints with undo and redo', async ({ page }) => {
    await loadLayout(page, POSTER_LAYOUT);
    expect(await getItem(page, 'item-p')).toMatchObject({ posterArt: 'noir' });
    await expect(itemLocator(page, 'item-p')).toHaveAttribute('data-art', 'noir');

    await selectItemById(page, 'item-s');
    await expect(page.locator('.btn-poster-art')).toHaveCount(0);

    await selectItemById(page, 'item-p');
    await expect(page.locator('.btn-poster-art')).toHaveText(['Noir', 'Bauhaus', 'Botanical', 'Horizon']);
    await expect(artButton(page, 'noir')).toHaveAttribute('aria-pressed', 'true');
    // Still only the Power Routing and Backlight switches; the picker is aria-pressed buttons
    await expect(page.locator('.inspector-content [role="switch"]')).toHaveCount(2);
    const before = await historyState(page);

    for (const art of ['bauhaus', 'botanical', 'horizon']) {
      await artButton(page, art).click();
      expect(await getItem(page, 'item-p')).toMatchObject({ posterArt: art });
      await expect(itemLocator(page, 'item-p')).toHaveAttribute('data-art', art);
      await expect(artButton(page, art)).toHaveAttribute('aria-pressed', 'true');
      await expect(artButton(page, art)).toBeFocused();
    }
    expect((await historyState(page)).index).toBe(before.index + 3);

    // Pressing the current print again records nothing
    await artButton(page, 'horizon').click();
    expect((await historyState(page)).index).toBe(before.index + 3);

    await blurActiveElement(page);
    await page.keyboard.press('Control+z');
    await expect(itemLocator(page, 'item-p')).toHaveAttribute('data-art', 'botanical');
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+z');
    expect(await getItem(page, 'item-p')).toMatchObject({ posterArt: 'noir' });
    await expect(itemLocator(page, 'item-p')).toHaveAttribute('data-art', 'noir');
    await page.keyboard.press('Control+y');
    await expect(itemLocator(page, 'item-p')).toHaveAttribute('data-art', 'bauhaus');
  });

  test('locked posters keep their print, and a batch changes only its unlocked posters in one step', async ({ page }) => {
    await loadLayout(page, {
      items: [
        wallItem('item-p', 'poster', 200, 60),
        wallItem('item-q', 'poster', 400, 60, { locked: true, posterArt: 'horizon' }),
        wallItem('item-s', 'shelf', 100, 400),
      ],
    });

    await selectItemById(page, 'item-q');
    await expect(artButton(page, 'horizon')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.btn-poster-art:disabled')).toHaveCount(4);

    // A locked poster alone in a batch hides the picker, so it only appears for posters it can change
    await selectItemsById(page, ['item-q', 'item-s']);
    await expect(page.locator('.btn-poster-art')).toHaveCount(0);

    await selectItemsById(page, ['item-p', 'item-q', 'item-s']);
    await expect(artButton(page, 'noir')).toHaveAttribute('aria-pressed', 'true');
    const before = await historyState(page);
    await artButton(page, 'bauhaus').click();
    expect((await historyState(page)).index).toBe(before.index + 1);
    expect(await getItem(page, 'item-p')).toMatchObject({ posterArt: 'bauhaus' });
    expect(await getItem(page, 'item-q')).toMatchObject({ posterArt: 'horizon' });
    await expect(itemLocator(page, 'item-q')).toHaveAttribute('data-art', 'horizon');

    // Copies carry the print with them
    await selectItemById(page, 'item-p');
    await blurActiveElement(page);
    await page.keyboard.press('Control+d');
    const copyId = (await selectedIds(page))[0];
    expect(copyId).not.toBe('item-p');
    expect(await getItem(page, copyId)).toMatchObject({ posterArt: 'bauhaus' });
    await expect(itemLocator(page, copyId)).toHaveAttribute('data-art', 'bauhaus');
  });

  test('prints are saved, exported and sanitized on the way back in', async ({ page }) => {
    await loadLayout(page, POSTER_LAYOUT);
    await selectItemById(page, 'item-p');
    await artButton(page, 'botanical').click();

    const payload = await page.evaluate(() => layoutPayload());
    expect(payload.version).toBe('1.7');
    expect(payload.wallItems.find((item) => item.id === 'item-p').posterArt).toBe('botanical');

    await page.reload();
    expect(await getItem(page, 'item-p')).toMatchObject({ posterArt: 'botanical' });
    await expect(itemLocator(page, 'item-p')).toHaveAttribute('data-art', 'botanical');

    await loadLayout(page, {
      items: [
        wallItem('item-old', 'poster', 50, 50),
        wallItem('item-bad', 'poster', 250, 50, { posterArt: '<script>' }),
        wallItem('item-ok', 'poster', 450, 50, { posterArt: 'horizon' }),
        wallItem('item-shelf', 'shelf', 50, 400, { posterArt: 'bauhaus' }),
      ],
    });
    expect(await getItem(page, 'item-old')).toMatchObject({ posterArt: 'noir' });
    expect(await getItem(page, 'item-bad')).toMatchObject({ posterArt: 'noir' });
    expect(await getItem(page, 'item-ok')).toMatchObject({ posterArt: 'horizon' });
    expect(await getItem(page, 'item-shelf')).not.toHaveProperty('posterArt');
    await expect(itemLocator(page, 'item-shelf')).not.toHaveAttribute('data-art');
  });

  test('exportPng paints each print exactly where the wall shows it', async ({ page }) => {
    await loadLayout(page, POSTER_LAYOUT);

    for (const [art, { point, color }] of Object.entries(ART_SAMPLES)) {
      await selectItemById(page, 'item-p');
      await artButton(page, art).click();
      await selectItemById(page, null);
      await blurActiveElement(page);

      const png = await downloadFrom(page, '#export-png-btn');
      const [exported] = await readPixels(page, png.buffer, [point], PIXEL_RATIO);
      const [screen] = await wallScreenPixels(page, [point]);
      expect(exported, `${art} in the PNG`).toBeNearColor(color, 8);
      expect(screen, `${art} on the wall`).toBeNearColor(color, 8);
      if (art !== 'noir') expect(exported, `${art} differs from noir`).not.toBeNearColor(NOIR, 20);
    }
  });
});
