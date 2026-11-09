import { readFile } from 'node:fs/promises';
import { expect } from './fixtures.js';

const SCALE = 2.5;
export const WALL_BORDER = 2;
export const toCm = (px) => px / SCALE;

// Geometry is given in wall pixels, the unit the engine stores (1 cm = 2.5 px)
export const wallItem = (id, type, left, top, extra = {}) => ({ id, type, left, top, ...extra });

export const itemLocator = (page, id) => page.locator(`.wall-item[data-id="${id}"]`);

// The module entry republishes the engine's v2.0 globals on window, so page.evaluate reaches them by name
export const loadLayout = (page, layout) =>
  page.evaluate((data) => {
    importLayoutText(JSON.stringify(data));
  }, layout);

export const selectItemById = (page, id) => page.evaluate((itemId) => selectItem(itemId), id);

export const selectItemsById = (page, ids) => page.evaluate((list) => setSelection(list), ids);

// Sorted, so assertions do not depend on the order items joined the selection
export const selectedIds = (page) => page.evaluate(() => [...selectedItemIds].sort());

export const itemOrder = (page) => page.evaluate(() => wallItems.map((item) => item.id));

export const getItem = (page, id) =>
  page.evaluate((itemId) => {
    const item = wallItems.find((entry) => entry.id === itemId);
    return item ? { ...item } : null;
  }, id);

export const getItems = (page) => page.evaluate(() => wallItems.map((item) => ({ ...item })));

export const selectedItem = (page) =>
  page.evaluate(() => {
    const item = getSelectedItem();
    return item ? { ...item } : null;
  });

export const historyState = (page) =>
  page.evaluate(() => ({
    index: historyIndex,
    length: historyStack.length,
    undoDisabled: undoBtn.disabled,
    redoDisabled: redoBtn.disabled,
  }));

export const topSnapshots = (page) =>
  page.evaluate(() =>
    [historyStack[historyIndex - 1], historyStack[historyIndex]].map((entry) => (entry ? JSON.parse(entry) : null)),
  );

export const nextFrame = (page) =>
  page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));

// True only for a dialog opened with showModal() that also holds keyboard focus
export const isModalWithFocus = (page, selector) =>
  page.evaluate((query) => {
    const dialog = document.querySelector(query);
    return dialog.open && dialog.matches(':modal') && dialog.contains(document.activeElement);
  }, selector);

export const blurActiveElement = (page) => page.evaluate(() => document.activeElement?.blur());

export const rulerState = (page, name) =>
  page.evaluate((key) => {
    const { el, label } = rulers[key];
    return {
      visible: !el.hidden,
      text: label.textContent,
      labelHidden: label.hidden,
      left: el.style.left,
      top: el.style.top,
      width: el.style.width,
      height: el.style.height,
    };
  }, name);

export const allRulersHidden = (page) => page.evaluate(() => Object.values(rulers).every((ruler) => ruler.el.hidden));

export const alignmentLines = (page) =>
  page.evaluate(() =>
    [...alignLayer.children]
      .filter((line) => !line.hidden)
      .map((line) => ({
        vertical: line.classList.contains('is-vertical'),
        left: line.style.left,
        top: line.style.top,
        width: line.style.width,
        height: line.style.height,
      })),
  );

export const rulerLabelsOverlap = (page) =>
  page.evaluate(() => {
    const boxes = [...document.querySelectorAll('.distance-guide:not([hidden]) .guide-label:not([hidden])')].map(
      (label) => label.getBoundingClientRect(),
    );
    // Half a pixel of slack absorbs subpixel rounding between labels that merely touch
    return boxes.some((a, i) =>
      boxes
        .slice(i + 1)
        .some(
          (b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5,
        ),
    );
  });

// Reports labels reaching past the wall's inner edge, where its overflow clipping would cut them off
export const clippedLabels = (page) =>
  page.evaluate((border) => {
    const wall = wallCanvas.getBoundingClientRect();
    const inset = border - 0.5;
    return [...document.querySelectorAll('.item-label')]
      .filter((label) => {
        const box = label.getBoundingClientRect();
        return (
          box.left < wall.left + inset ||
          box.right > wall.right - inset ||
          box.top < wall.top + inset ||
          box.bottom > wall.bottom - inset
        );
      })
      .map((label) => label.textContent);
  }, WALL_BORDER);

export async function releaseDrag(page, { alt = false } = {}) {
  await page.mouse.up();
  if (alt) await page.keyboard.up('Alt');
}

export async function dragBy(page, id, dx, dy, { hold = false, alt = false, steps = 8 } = {}) {
  const box = await itemLocator(page, id).boundingBox();
  // Whole-pixel start points keep the screen delta exact, so the expected wall position is predictable
  const startX = Math.round(box.x + box.width / 2);
  const startY = Math.round(box.y + box.height / 2);

  await page.mouse.move(startX, startY);
  if (alt) await page.keyboard.down('Alt');
  await page.mouse.down();
  await page.mouse.move(startX + dx, startY + dy, { steps });
  await nextFrame(page);
  const guides = await alignmentLines(page);

  if (!hold) await releaseDrag(page, { alt });
  return { guides, startX, startY };
}

export async function dragHandle(page, id, handle, dx, dy, { hold = false, steps = 6 } = {}) {
  const box = await itemLocator(page, id).locator(`.handle-${handle}`).boundingBox();
  const startX = Math.round(box.x + box.width / 2);
  const startY = Math.round(box.y + box.height / 2);

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + dx, startY + dy, { steps });
  await nextFrame(page);

  if (!hold) await page.mouse.up();
  return { startX, startY };
}

// Screen position of a wall coordinate, following the border and the current fit scale
export async function wallPoint(page, x, y) {
  const wall = await page.locator('#wall').boundingBox();
  const scale = await page.evaluate(() => viewScale);
  return { x: wall.x + (WALL_BORDER + x) * scale, y: wall.y + (WALL_BORDER + y) * scale };
}

export async function dragFromCatalog(page, name, target, { release = true, steps = 12 } = {}) {
  const card = await page.locator(`.catalog-item[data-name="${name}"]`).boundingBox();
  await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps });
  await nextFrame(page);
  if (release) await page.mouse.up();
}

export async function clickWallAt(page, x, y) {
  const wall = await page.locator('#wall').boundingBox();
  await page.mouse.click(wall.x + WALL_BORDER + x, wall.y + WALL_BORDER + y);
}

export async function setWallSize(page, { width, height } = {}) {
  if (width !== undefined) {
    await page.fill('#wall-width-input', String(width));
    await page.press('#wall-width-input', 'Enter');
  }
  if (height !== undefined) {
    await page.fill('#wall-height-input', String(height));
    await page.press('#wall-height-input', 'Enter');
  }
  // Focus left in a number field would turn Ctrl+Z into the browser's own text undo
  await blurActiveElement(page);
}

export const wallState = (page) =>
  page.evaluate(() => ({
    widthCm: wallWidthCm,
    heightCm: wallHeightCm,
    cssWidth: wallCanvas.style.width,
    cssHeight: wallCanvas.style.height,
    widthInput: wallWidthInput.value,
    heightInput: wallHeightInput.value,
    scale: viewScale,
    transform: wallCanvas.style.transform,
    note: scaleNote.textContent,
  }));

export const topbarOverflow = (page) =>
  page.evaluate(() => {
    const topbar = document.querySelector('.topbar');
    return topbar.scrollWidth - topbar.clientWidth;
  });

export async function downloadFrom(page, selector) {
  const [download] = await Promise.all([page.waitForEvent('download'), page.click(selector)]);
  return { name: download.suggestedFilename(), buffer: await readFile(await download.path()) };
}

export async function importFile(page, name, content) {
  // Clearing the toast first means a repeated message cannot be mistaken for the new result
  await page.evaluate(() => {
    ioStatus.textContent = '';
  });
  await page.setInputFiles('#import-file-input', {
    name,
    mimeType: 'application/json',
    buffer: Buffer.from(content),
  });
  const status = page.locator('#io-status');
  await expect(status).toHaveText(/\S/);
  return status;
}

export const pngInfo = (buffer) => ({
  signature: buffer.subarray(0, 8).toString('hex'),
  width: buffer.readUInt32BE(16),
  height: buffer.readUInt32BE(20),
});

// Decoding happens in the browser, so the suite needs no image library; points are multiplied by scale
export const readPixels = (page, buffer, points, scale = 1) =>
  page.evaluate(
    async ({ base64, coords, ratio }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      return coords.map(([x, y]) => [
        ...context.getImageData(Math.floor(x * ratio), Math.floor(y * ratio), 1, 1).data.slice(0, 3),
      ]);
    },
    { base64: buffer.toString('base64'), coords: points, ratio: scale },
  );

// Samples the live wall at wall coordinates; assumes the wall is shown at 100%
export async function wallScreenPixels(page, points) {
  const wall = await page.locator('#wall').boundingBox();
  const screenshot = await page.screenshot({ clip: wall, animations: 'disabled' });
  return readPixels(
    page,
    screenshot,
    points.map(([x, y]) => [x + WALL_BORDER, y + WALL_BORDER]),
  );
}

// Draws a selection box between two wall coordinates, optionally holding Shift or keeping the button down
export async function drawMarquee(page, from, to, { hold = false, shift = false, steps = 8 } = {}) {
  const start = await wallPoint(page, ...from);
  const end = await wallPoint(page, ...to);
  if (shift) await page.keyboard.down('Shift');
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps });
  await nextFrame(page);
  if (hold) return;
  await page.mouse.up();
  if (shift) await page.keyboard.up('Shift');
}

// Without a position Playwright presses the item's center, which also suits a 20 px tall shelf
export async function openContextMenu(page, id, position) {
  await itemLocator(page, id).click({ button: 'right', ...(position && { position }) });
  await expect(page.locator('#context-menu')).toBeVisible();
}

export const contextMenuItem = (page, action) => page.locator(`#context-menu [data-action="${action}"]`);

// Computed ::before shadows resolve var(--led-color), so this is the glow color the screen actually shows
export const glowShadow = (page, id) =>
  page.evaluate((itemId) => getComputedStyle(getItemElement(itemId), '::before').boxShadow, id);
