import { test, expect } from './support/fixtures.js';
import {
  downloadFrom,
  dragBy,
  getItem,
  getItems,
  historyState,
  pngInfo,
  rulerState,
  selectItemById,
  selectedItem,
} from './support/planner.js';

const MODULES = [
  'scripts/planner-engine.js',
  'scripts/core/constants.js',
  'scripts/core/dom.js',
  'scripts/core/state.js',
  'scripts/core/geometry.js',
  'scripts/ui/viewport-rulers.js',
  'scripts/ui/inspector-layers.js',
  'scripts/io/export-png.js',
  'scripts/io/projects-spec.js',
];

const viewScale = (page) => page.evaluate(() => viewScale);

// Resolves a module the way the entry imported it, so the browser hands back the already-evaluated instance
const fromModule = (page, file, read) =>
  page.evaluate(
    async ({ path, body }) => {
      const mod = await import(new URL(path, document.baseURI).href);
      return new Function('mod', `return (${body})(mod);`)(mod);
    },
    { path: file, body: read.toString() },
  );

test.describe('module entry', () => {
  test('index.html loads the engine as a single ES module and shows v2.6', async ({ page, request }) => {
    const html = await (await request.get('/index.html')).text();
    expect(html).toContain('<script type="module" src="scripts/planner-engine.js"></script>');
    expect(html).not.toMatch(/<script[^>]*\bdefer\b/);

    const scripts = await page.evaluate(() =>
      [...document.scripts].map((script) => ({ type: script.type, src: script.getAttribute('src') })),
    );
    expect(scripts).toEqual([{ type: 'module', src: 'scripts/planner-engine.js' }]);
    await expect(page.locator('.badge')).toHaveText('v2.6');
  });

  test('fetches every module of the tree once as JavaScript and boots without a single error', async ({ context }) => {
    const page = await context.newPage();
    const errors = [];
    const fetched = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('response', (response) => {
      const path = new URL(response.url()).pathname.slice(1);
      if (path.startsWith('scripts/')) fetched.push({ path, status: response.status(), type: response.headers()['content-type'] });
    });

    await page.goto('/');
    await expect(page.locator('.wall-item')).toHaveCount(2);

    expect(fetched.map((entry) => entry.path).sort()).toEqual([...MODULES].sort());
    for (const entry of fetched) {
      expect(entry.status, entry.path).toBe(200);
      expect(entry.type, entry.path).toContain('text/javascript');
    }
    await expect(page.locator('#total-price')).toHaveText('$70.00');
    await expect(page.locator('#undo-btn')).toBeDisabled();
    expect(errors).toEqual([]);
    await page.close();
  });

  test('module scope keeps internals off window while the console bridge reads live state', async ({ page }) => {
    expect(
      await page.evaluate(() => ['SCALE', 'state', 'normalizeLayout', 'startDrag', 'paintItem'].map((name) => name in window)),
    ).toEqual([false, false, false, false, false]);
    expect(await page.evaluate(() => typeof Object.getOwnPropertyDescriptor(window, 'wallItems').get)).toBe('function');

    await page.click('.catalog-item[data-type="cube"]');
    expect(await page.evaluate(() => wallItems.length)).toBe(3);
    expect(await page.evaluate(() => selectedItemIds.length)).toBe(1);
  });

  test('dynamic imports return the same live instances the entry wired together', async ({ page }) => {
    await page.click('.catalog-item[data-type="cube"]');

    expect(await fromModule(page, 'scripts/core/state.js', (mod) => mod.state.wallItems === window.wallItems)).toBe(true);
    expect(await fromModule(page, 'scripts/core/constants.js', (mod) => [mod.EXPORT_VERSION, mod.SCALE])).toEqual([
      '1.8',
      2.5,
    ]);
    expect(
      await fromModule(page, 'scripts/core/geometry.js', (mod) =>
        mod.isOverlapping({ left: 0, top: 0, width: 10, height: 10 }, { left: 5, top: 5, width: 10, height: 10 }),
      ),
    ).toBe(true);
    expect(
      await fromModule(page, 'scripts/core/dom.js', (mod) => mod.wallCanvas === document.getElementById('wall')),
    ).toBe(true);
  });

  test('a write through one module is seen by every other module', async ({ page }) => {
    // The state module owns the binding; the inspector module renders it and the bridge reads it back
    await fromModule(page, 'scripts/core/state.js', (mod) => {
      mod.state.wallItems.find((item) => item.id === 'item-2').left = 300;
    });
    await fromModule(page, 'scripts/ui/inspector-layers.js', (mod) => mod.renderPlanner());

    await expect(page.locator('.wall-item[data-id="item-2"]')).toHaveCSS('left', '300px');
    expect((await getItem(page, 'item-2')).left).toBe(300);
  });
});

test.describe('cross-module workflows', () => {
  test('a catalog click mounts, selects, prices and records an undo step', async ({ page }) => {
    await page.click('.catalog-item[data-type="cube"]');

    const item = await selectedItem(page);
    expect(item).toMatchObject({ type: 'cube', width: 90, height: 90, finish: 'oak' });
    await expect(page.locator('.wall-item.selected')).toHaveAttribute('data-id', item.id);
    await expect(page.locator('.selected-item-title')).toHaveText('Modular Cube');
    await expect(page.locator('#total-price')).toHaveText('$100.00');
    expect((await historyState(page)).undoDisabled).toBe(false);

    await page.keyboard.press('Control+z');
    expect(await getItems(page)).toHaveLength(2);
  });

  test('dragging with Snap 5cm lands on the grid, drives the rulers and undoes in one step', async ({ page }) => {
    await page.check('#snap-grid-toggle');
    await dragBy(page, 'item-2', 37, 23, { alt: true });

    expect(await selectedItem(page)).toMatchObject({ left: 237.5, top: 162.5 });
    expect(await rulerState(page, 'wallX')).toMatchObject({ visible: true, text: '95 cm' });
    expect(await rulerState(page, 'wallY')).toMatchObject({ visible: true, text: '65 cm' });
    await expect(page.locator('#inspector-pos-readout')).toHaveText('95 cm (X), 65 cm (Y)');

    await page.keyboard.press('Control+z');
    expect(await getItem(page, 'item-2')).toMatchObject({ left: 195, top: 140 });
  });

  test('zooming keeps the edge rulers and the selection band in step with the wall', async ({ page }) => {
    await selectItemById(page, 'item-2');
    const fitted = await viewScale(page);

    await page.click('#zoom-in-btn');
    await expect(page.locator('#zoom-reset-btn')).toHaveText('125%');
    const zoomed = await viewScale(page);
    expect(zoomed).toBeCloseTo(fitted * 1.25, 5);

    const ruler = await page.locator('#ruler-x').boundingBox();
    expect(ruler.width).toBeCloseTo(750 * zoomed, 1);
    expect(await page.evaluate(() => document.querySelector('#ruler-x .ruler-span').style.left)).toBe(`${195 * zoomed}px`);

    await page.keyboard.press('Control+0');
    await expect(page.locator('#zoom-reset-btn')).toHaveText('100%');
    expect(await viewScale(page)).toBe(fitted);
  });

  test('Inspector edits reach the item, its element, the rulers and the history', async ({ page }) => {
    await selectItemById(page, 'item-2');
    const before = await historyState(page);

    await page.fill('#edit-width-cm', '60');
    await page.press('#edit-width-cm', 'Enter');
    expect(await getItem(page, 'item-2')).toMatchObject({ width: 150 });
    await expect(page.locator('.wall-item[data-id="item-2"]')).toHaveCSS('width', '150px');

    await page.fill('#edit-left-cm', '100');
    await page.press('#edit-left-cm', 'Enter');
    await expect(page.locator('#inspector-pos-readout')).toHaveText('100 cm (X), 56 cm (Y)');
    expect((await rulerState(page, 'wallX')).text).toBe('100 cm');

    await page.click('.btn-finish[data-finish="walnut"]');
    await expect(page.locator('.wall-item[data-id="item-2"]')).toHaveClass(/finish-walnut/);
    expect((await historyState(page)).index).toBe(before.index + 3);
  });

  test('the spec sheet copies Markdown and downloads CSV from the live layout', async ({ page }) => {
    await page.evaluate(() => {
      window.copiedText = null;
      navigator.clipboard.writeText = async (text) => {
        window.copiedText = text;
      };
    });
    await page.click('#view-spec-btn');
    await expect(page.locator('#spec-modal')).toBeVisible();
    await expect(page.locator('#spec-modal-subtitle')).toHaveText('Wall 300 x 250 cm | 2 items');

    await page.click('#copy-markdown-btn');
    await expect(page.locator('#copy-markdown-btn')).toHaveText('Copied to Clipboard');
    const markdown = await page.evaluate(() => window.copiedText);
    expect(markdown).toContain('| Floating Shelf | 110 x 8 cm | Walnut | 1 | $45.00 | $45.00 |');
    expect(markdown).toContain('| **Total** | | | **2** | | **$70.00** |');

    const { name, buffer } = await downloadFrom(page, '#export-csv-btn');
    expect(name).toBe('spatial-studio-specs.csv');
    const csv = buffer.subarray(3).toString('utf8');
    expect(csv).toContain('Poster Frame,50,70,Black,1,25.00,25.00\r\n');
    expect(csv).toContain('Total,,,,2,,70.00\r\n');
    await expect(page.locator('#export-csv-btn')).toHaveText('Downloaded!');
  });

  test('the PNG export renders the wall at 2x without touching the history', async ({ page }) => {
    const before = await historyState(page);
    const { name, buffer } = await downloadFrom(page, '#export-png-btn');

    expect(name).toBe('spatial-studio-plan.png');
    expect(pngInfo(buffer)).toEqual({ signature: '89504e470d0a1a0a', width: 1500, height: 1250 });
    await expect(page.locator('#io-status')).toHaveText('Plan exported as PNG.');
    expect(await historyState(page)).toEqual(before);
  });

  test('shortcuts handled in the entry drive the inspector, viewport and history modules', async ({ page }) => {
    await page.click('.wall-item[data-id="item-1"]');
    await page.keyboard.press('Control+d');
    expect(await getItems(page)).toHaveLength(3);

    await page.keyboard.press('r');
    expect((await selectedItem(page)).rotation).toBe(90);

    await page.keyboard.press('Alt+m');
    await expect(page.locator('body')).toHaveAttribute('data-studio-mode', 'creator');
    await page.keyboard.press('Alt+m');
    await expect(page.locator('body')).toHaveAttribute('data-studio-mode', 'engineer');

    await page.keyboard.press('Control+k');
    await expect(page.locator('#command-palette')).toHaveAttribute('open', '');
    await page.keyboard.press('Escape');
    await expect(page.locator('#command-palette')).not.toHaveAttribute('open');
    // The dialog hands focus back in its queued close event; until then Ctrl+Z belongs to the search field
    await expect(page.locator('#command-search-input')).not.toBeFocused();

    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+z');
    expect(await getItems(page)).toHaveLength(2);
  });

  test('autosave in the projects module restores the layout after a reload', async ({ page }) => {
    await page.click('.catalog-item[data-type="spotlight"]');
    await selectItemById(page, 'item-1');
    await page.click('.btn-finish[data-finish="oak"]');

    await page.reload();
    const items = await getItems(page);
    expect(items).toHaveLength(3);
    expect(items.find((item) => item.id === 'item-1').finish).toBe('oak');
    await expect(page.locator('#total-price')).toHaveText('$105.00');
  });
});
