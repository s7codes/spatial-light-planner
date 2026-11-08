import { test, expect } from './support/fixtures.js';
import {
  allRulersHidden,
  blurActiveElement,
  getItem,
  getItems,
  historyState,
  isModalWithFocus,
  itemLocator,
  loadLayout,
  nextFrame,
  selectItemById,
  selectedItem,
  topbarOverflow,
  wallItem,
} from './support/planner.js';

const SHORTCUT_ROWS = [
  ['Drag item', 'Move item on wall (with 1 cm magnetic alignment)'],
  ['Hold Alt / Option while dragging', 'Temporarily bypass magnetic alignment guides'],
  ['Arrow Keys', 'Nudge selected item by 1 cm'],
  ['Ctrl + Z / Cmd + Z', 'Undo last layout action (up to 30 steps)'],
  ['Ctrl + Y / Ctrl + Shift + Z', 'Redo layout action (Cmd + Shift + Z on Mac)'],
  ['Ctrl + D / Cmd + D', 'Duplicate selected item (+4 cm offset)'],
  ['L', 'Lock or unlock selected item position and properties'],
  ['Delete / Backspace', 'Remove selected unlocked item'],
  ['?', 'Toggle Keyboard Shortcuts guide'],
  ['Escape', 'Close open modal or deselect active item'],
];

const isGuideOpen = (page) => page.evaluate(() => shortcutsModal.open);
const isSpecOpen = (page) => page.evaluate(() => specModal.open);

test.describe('page shell', () => {
  test('loads every resource without a failed request and never asks for favicon.ico', async ({ context }) => {
    const page = await context.newPage();
    const failures = [];
    const paths = [];
    page.on('response', (response) => {
      if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
    });
    page.on('requestfailed', (request) => failures.push(`failed ${request.url()}`));
    page.on('request', (request) => paths.push(new URL(request.url()).pathname));

    await page.goto('/', { waitUntil: 'networkidle' });

    expect(failures).toEqual([]);
    expect(paths).toEqual(expect.arrayContaining(['/', '/styles/studio-workspace.css', '/scripts/planner-engine.js']));
    expect(paths).not.toContain('/favicon.ico');
  });

  test('ships a title and an inline SVG favicon that decodes', async ({ page }) => {
    await expect(page).toHaveTitle('Spatial & Ambient Light Planner');

    const icon = await page.evaluate(async () => {
      const link = document.querySelector('link[rel="icon"]');
      const image = new Image();
      image.src = link.href;
      await image.decode();
      return {
        type: link.type,
        inline: link.getAttribute('href').startsWith('data:image/svg+xml,'),
        width: image.naturalWidth,
      };
    });
    expect(icon.type).toBe('image/svg+xml');
    expect(icon.inline).toBe(true);
    expect(icon.width).toBeGreaterThan(0);
  });

  test('the logo mark follows the live lighting colors', async ({ page }) => {
    const logoColors = () =>
      page.evaluate(() => {
        const read = (selector, property) => getComputedStyle(document.querySelector(selector))[property];
        return {
          accentStop: read('.logo-stop-accent', 'stopColor'),
          cornerStop: read('.logo-stop-corner', 'stopColor'),
          beam: read('.logo-beam', 'stroke'),
        };
      });
    expect(await logoColors()).toEqual({
      accentStop: 'rgb(255, 157, 66)',
      cornerStop: 'rgb(139, 92, 246)',
      beam: 'rgb(255, 157, 66)',
    });

    await page.getByRole('button', { name: 'Neon Contrast' }).click();

    expect(await logoColors()).toEqual({
      accentStop: 'rgb(0, 242, 254)',
      cornerStop: 'rgb(255, 8, 68)',
      beam: 'rgb(0, 242, 254)',
    });
  });
});

test.describe('keyboard shortcuts guide', () => {
  test('the ? button opens a modal guide that lists every shortcut', async ({ page }) => {
    await page.getByRole('button', { name: 'Keyboard shortcuts' }).click();

    expect(await isModalWithFocus(page, '#shortcuts-modal')).toBe(true);
    const rows = await page.evaluate(() =>
      [...document.querySelectorAll('#shortcuts-modal tbody tr')].map((row) =>
        [...row.cells].map((cell) => cell.textContent.replace(/\s+/g, ' ').trim()),
      ),
    );
    expect(rows).toEqual(SHORTCUT_ROWS);

    const box = await page.locator('#shortcuts-modal').boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(820);
  });

  test('Escape closes the guide and hands focus back to the ? button', async ({ page }) => {
    await page.click('#shortcuts-btn');
    await page.keyboard.press('Escape');

    expect(await isGuideOpen(page)).toBe(false);
    await expect(page.locator('#shortcuts-btn')).toBeFocused();
  });

  test('the ? key toggles the guide, except while typing or with a checkbox focused', async ({ page }) => {
    await page.keyboard.press('?');
    expect(await isGuideOpen(page)).toBe(true);
    await page.keyboard.press('?');
    expect(await isGuideOpen(page)).toBe(false);

    await page.focus('#wall-width-input');
    await page.keyboard.press('?');
    expect(await isGuideOpen(page)).toBe(false);

    await page.focus('#snap-grid-toggle');
    await page.keyboard.press('?');
    expect(await isGuideOpen(page)).toBe(false);
  });

  test('a backdrop click or the Close button dismisses the guide', async ({ page }) => {
    await page.click('#shortcuts-btn');
    await page.mouse.click(5, 5);
    expect(await isGuideOpen(page)).toBe(false);

    await page.click('#shortcuts-btn');
    await page.click('#close-shortcuts-btn');
    expect(await isGuideOpen(page)).toBe(false);
  });

  test('only one dialog can be open at a time', async ({ page }) => {
    await page.click('#view-spec-btn');
    await page.keyboard.press('?');
    expect(await isSpecOpen(page)).toBe(true);
    expect(await isGuideOpen(page)).toBe(false);
    await page.keyboard.press('Escape');

    await page.click('#shortcuts-btn');
    await page.evaluate(() => openSpecSheet());
    expect(await isGuideOpen(page)).toBe(true);
    expect(await isSpecOpen(page)).toBe(false);
  });

  test('editor shortcuts are inert while the guide is open and closing it keeps the selection', async ({ page }) => {
    await selectItemById(page, 'item-2');
    const before = await historyState(page);
    await page.click('#shortcuts-btn');

    for (const key of ['Delete', 'l', 'Control+z', 'ArrowRight']) await page.keyboard.press(key);

    expect(await isGuideOpen(page)).toBe(true);
    expect(await getItems(page)).toHaveLength(2);
    expect(await getItem(page, 'item-2')).toMatchObject({ left: 195, locked: false });
    expect(await historyState(page)).toEqual(before);

    await page.keyboard.press('Escape');
    expect(await selectedItem(page)).toMatchObject({ id: 'item-2' });
  });
});

test.describe('Escape', () => {
  test('deselects the item and hides the rulers when no dialog is open', async ({ page }) => {
    await page.click('.wall-item[data-id="item-2"]');
    await blurActiveElement(page);

    await page.keyboard.press('Escape');

    expect(await selectedItem(page)).toBeNull();
    expect(await allRulersHidden(page)).toBe(true);
    await expect(page.locator('#inspector-box')).toContainText('Select or drag an item');

    await page.keyboard.press('Escape');
    expect(await selectedItem(page)).toBeNull();
  });

  test('keeps the selection while an inspector field has focus', async ({ page }) => {
    await page.click('.wall-item[data-id="item-2"]');
    await page.focus('#edit-width-cm');

    await page.keyboard.press('Escape');

    expect(await selectedItem(page)).toMatchObject({ id: 'item-2' });
  });

  test('mid-drag neither drops nor deselects the item', async ({ page }) => {
    const box = await itemLocator(page, 'item-2').boundingBox();
    const x = Math.round(box.x + box.width / 2);
    const y = Math.round(box.y + box.height / 2);
    await page.mouse.move(x, y);
    await page.keyboard.down('Alt');
    await page.mouse.down();
    await page.mouse.move(x - 40, y, { steps: 4 });

    await page.keyboard.press('Escape');
    await page.mouse.move(x - 60, y, { steps: 4 });
    await nextFrame(page);
    await page.mouse.up();
    await page.keyboard.up('Alt');

    expect(await selectedItem(page)).toMatchObject({ id: 'item-2', left: 135 });
  });
});

test.describe('accessibility', () => {
  test('every button has an accessible name and every input a label', async ({ page }) => {
    await selectItemById(page, 'item-2');

    const audit = await page.evaluate(() => ({
      unnamedButtons: [...document.querySelectorAll('button')]
        .filter((button) => !(button.textContent.trim() || button.getAttribute('aria-label') || button.title))
        .map((button) => button.outerHTML.slice(0, 80)),
      unlabeledInputs: [...document.querySelectorAll('input')]
        .filter((input) => !(input.labels.length || input.getAttribute('aria-label') || input.title))
        .map((input) => input.id || input.outerHTML.slice(0, 60)),
    }));

    expect(audit).toEqual({ unnamedButtons: [], unlabeledInputs: [] });
    await expect(page.getByRole('button', { name: 'Keyboard shortcuts' })).toHaveAccessibleName('Keyboard shortcuts');
    await expect(page.getByRole('switch')).toHaveAccessibleName('Backlight LED: ON');
  });

  test('catalog entries are real buttons and every topbar control explains itself', async ({ page }) => {
    for (const entry of await page.locator('.catalog-item').all()) {
      await expect(entry).toHaveAttribute('type', 'button');
      await expect(entry).toHaveAttribute('title', /^Mount /);
    }
    for (const control of await page.locator('.topbar button, .topbar label').all()) {
      expect((await control.getAttribute('title')) || (await control.getAttribute('aria-label'))).toBeTruthy();
    }
  });

  test('catalog items mount from the keyboard with Enter and Space', async ({ page }) => {
    await page.focus('.catalog-item[data-name="Modular Cube"]');
    await page.keyboard.press('Enter');
    await page.focus('.catalog-item[data-name="Mini Spotlight"]');
    await page.keyboard.press(' ');

    expect((await getItems(page)).map((item) => item.type)).toEqual(['shelf', 'poster', 'cube', 'spotlight']);
  });

  test('buttons show a visible focus ring when reached with the keyboard', async ({ page }) => {
    for (let n = 0; n < 10; n++) {
      await page.keyboard.press('Tab');
      if (await page.evaluate(() => document.activeElement.tagName === 'BUTTON')) break;
    }

    // Topbar buttons transition every property, so the ring is polled until it settles
    const focusRing = () =>
      page.evaluate(() => {
        const style = getComputedStyle(document.activeElement);
        return `${document.activeElement.tagName} ${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}`;
      });
    await expect.poll(focusRing).toBe('BUTTON solid 2px rgb(255, 157, 66)');
  });
});

const topbarBoxes = (page) =>
  page.evaluate(() => {
    const box = (selector) => {
      const { left, right } = document.querySelector(selector).getBoundingClientRect();
      return { left, right, center: (left + right) / 2 };
    };
    return {
      logo: box('.logo'),
      dimensions: box('.wall-dimensions-display'),
      actions: box('.actions'),
      canvas: box('.canvas-area'),
    };
  });

test.describe('responsive layout', () => {
  // Wide enough for any fallback UI font, so the check does not depend on the fonts a CI runner has
  for (const width of [1600, 1920]) {
    test(`the wall size control sits on the canvas center line at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });

      const { dimensions, canvas } = await topbarBoxes(page);
      expect(Math.abs(dimensions.center - canvas.center)).toBeLessThanOrEqual(1);
    });
  }

  test('a narrow topbar gives the actions room instead of overlapping the wall size control', async ({ page }) => {
    await loadLayout(page, { wallWidthCm: 400, wallHeightCm: 300, items: [] });
    await page.setViewportSize({ width: 1300, height: 700 });
    await nextFrame(page);

    const { logo, dimensions, actions } = await topbarBoxes(page);
    expect(logo.right).toBeLessThanOrEqual(dimensions.left);
    expect(dimensions.right).toBeLessThanOrEqual(actions.left);
  });

  for (const width of [1300, 1400, 1440]) {
    test(`the topbar fits at ${width} px, even with the fit note showing`, async ({ page }) => {
      await loadLayout(page, { wallWidthCm: 400, wallHeightCm: 300, items: [] });
      await page.setViewportSize({ width, height: 700 });
      await nextFrame(page);

      await expect(page.locator('#scale-note')).toContainText('fit');
      expect(await topbarOverflow(page)).toBeLessThanOrEqual(0);
    });
  }

  test('both sidebars fit at 1400 x 820 without scrolling', async ({ page }) => {
    const overflow = await page.evaluate(() =>
      [...document.querySelectorAll('.sidebar')].map((sidebar) => sidebar.scrollHeight - sidebar.clientHeight),
    );
    expect(overflow.every((value) => value <= 0)).toBe(true);

    const budget = await page.locator('.budget-box').boundingBox();
    expect(budget.y + budget.height).toBeLessThanOrEqual(820);
    await expect(page.locator('#view-spec-btn')).toBeInViewport();
  });

  test('the status toast floats above the footer without reflowing the catalog', async ({ page }) => {
    await page.click('.template-btn[data-template="gallery-storage"]');

    const toast = await page.evaluate(() => {
      const catalog = document.querySelector('.catalog');
      const footer = document.querySelector('.catalog-footer').getBoundingClientRect();
      return {
        visible: !ioStatus.hidden,
        catalogOverflow: catalog.scrollHeight - catalog.clientHeight,
        above: ioStatus.getBoundingClientRect().bottom <= footer.top,
        passThrough: getComputedStyle(ioStatus).pointerEvents === 'none',
      };
    });
    expect(toast).toMatchObject({ visible: true, above: true, passThrough: true });
    expect(toast.catalogOverflow).toBeLessThanOrEqual(0);
  });

  test('the inspector scrolls internally instead of pushing the budget box off screen', async ({ page }) => {
    await loadLayout(page, { items: [wallItem('item-a', 'cube', 100, 100, { locked: true })] });
    await selectItemById(page, 'item-a');

    await expect(page.locator('#view-spec-btn')).toBeInViewport();
    const budget = await page.locator('.budget-box').boundingBox();
    expect(budget.y + budget.height).toBeLessThanOrEqual(820);
  });
});