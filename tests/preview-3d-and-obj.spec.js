import { test, expect } from './support/fixtures.js';
import { downloadFrom, getItem, historyState, loadLayout, selectedItem, wallItem } from './support/planner.js';

const modal = (page) => page.locator('#preview-3d-modal');
const depthInput = (page) => page.locator('.inspector-content #edit-depth-cm');

async function setDepth(page, value) {
  await depthInput(page).fill(String(value));
  await depthInput(page).press('Enter');
}

// Counts pixels that differ from the top-left background sample, and hashes the bitmap to spot redraws
const canvasStats = (page) =>
  page.evaluate(() => {
    const canvas = document.getElementById('preview-3d-canvas');
    const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    let painted = 0;
    let hash = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (Math.abs(data[i] - data[0]) + Math.abs(data[i + 1] - data[1]) + Math.abs(data[i + 2] - data[2]) > 24) painted++;
      hash = (hash * 31 + data[i] + data[i + 1] * 7 + data[i + 2] * 13) % 1000000007;
    }
    return { painted, hash, width: canvas.width, height: canvas.height };
  });

test.describe('editable z-depth', () => {
  test('typing a depth on a Floating Shelf updates it as one undo step', async ({ page }) => {
    await page.click('.catalog-item[data-type="shelf"]');
    await expect(depthInput(page)).toHaveValue('25');
    await expect(depthInput(page)).toHaveAttribute('min', '2');
    await expect(depthInput(page)).toHaveAttribute('max', '60');
    await expect(depthInput(page)).toBeEditable();
    const before = await historyState(page);

    await setDepth(page, 32);
    const shelf = await selectedItem(page);
    expect(shelf.depth).toBe(32);
    expect(await page.evaluate((id) => wallItems.findIndex((item) => item.id === id), shelf.id)).toBe(2);
    expect((await historyState(page)).index).toBe(before.index + 1);

    await page.evaluate(() => document.activeElement.blur());
    await page.keyboard.press('Control+z');
    expect((await getItem(page, shelf.id)).depth).toBe(25);
    await expect(depthInput(page)).toHaveValue('25');
    await page.keyboard.press('Control+y');
    expect((await getItem(page, shelf.id)).depth).toBe(32);
  });

  test('the starter shelf edits through wallItems[0], clamps to 2-60 cm and ignores unchanged values', async ({ page }) => {
    await page.click('.wall-item[data-id="item-1"]');
    await setDepth(page, 32);
    expect(await page.evaluate(() => wallItems[0].depth)).toBe(32);

    await setDepth(page, 99);
    await expect(depthInput(page)).toHaveValue('60');
    expect(await page.evaluate(() => wallItems[0].depth)).toBe(60);

    await setDepth(page, 0.4);
    await expect(depthInput(page)).toHaveValue('2');
    expect(await page.evaluate(() => wallItems[0].depth)).toBe(2);

    const steps = (await historyState(page)).index;
    await setDepth(page, 2);
    expect((await historyState(page)).index).toBe(steps);
  });

  test('locked furniture and room features keep their depth read-only', async ({ page }) => {
    await page.click('.wall-item[data-id="item-1"]');
    await page.keyboard.press('l');
    await expect(depthInput(page)).toBeDisabled();

    await page.click('.catalog-item[data-type="window"]');
    await expect(depthInput(page)).toHaveValue('0');
    await expect(depthInput(page)).not.toBeEditable();
  });
});

test.describe('3D room preview', () => {
  test('opens from the HUD button and with V, orbits and toggles wireframe', async ({ page }) => {
    const button = page.locator('.zoom-hud #preview-3d-btn');
    await expect(button).toHaveText('3D');
    await expect(button).toHaveAttribute('title', '3D Room Preview (V)');

    await button.click();
    await expect(modal(page)).toHaveAttribute('open', '');
    await expect(page.locator('#preview-3d-title')).toHaveText('3D Room Preview');
    const first = await canvasStats(page);
    expect(first).toMatchObject({ width: 760, height: 460 });
    expect(first.painted).toBeGreaterThan(5000);

    await expect(page.locator('#orbit-yaw-value')).toHaveText('-28 deg');
    await expect(page.locator('#orbit-pitch-value')).toHaveText('22 deg');
    await page.locator('#orbit-yaw-slider').fill('40');
    await expect(page.locator('#orbit-yaw-value')).toHaveText('40 deg');
    const turned = await canvasStats(page);
    expect(turned.hash).not.toBe(first.hash);

    // Dragging right turns the yaw up and dragging down tilts the pitch, both clamped to the slider range
    const box = await page.locator('#preview-3d-canvas').boundingBox();
    await page.mouse.move(box.x + 300, box.y + 200);
    await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y + 240, { steps: 6 });
    await page.mouse.up();
    const yaw = Number(await page.locator('#orbit-yaw-slider').inputValue());
    const pitch = Number(await page.locator('#orbit-pitch-slider').inputValue());
    expect(yaw).toBeLessThan(40);
    expect(pitch).toBeGreaterThan(22);
    expect(pitch).toBeLessThanOrEqual(45);
    await expect(page.locator('#orbit-yaw-value')).toHaveText(`${yaw} deg`);

    const wireframe = page.locator('#wireframe-3d-toggle');
    await expect(wireframe).toHaveAttribute('aria-pressed', 'false');
    const shaded = await canvasStats(page);
    await wireframe.click();
    await expect(wireframe).toHaveAttribute('aria-pressed', 'true');
    const lines = await canvasStats(page);
    expect(lines.painted).toBeGreaterThan(500);
    expect(lines.hash).not.toBe(shaded.hash);

    await page.click('#reset-3d-camera-btn');
    await expect(page.locator('#orbit-yaw-slider')).toHaveValue('-28');
    await expect(page.locator('#orbit-pitch-slider')).toHaveValue('22');

    await page.click('#close-3d-btn');
    await expect(modal(page)).not.toHaveAttribute('open');

    await page.keyboard.press('v');
    await expect(modal(page)).toHaveAttribute('open', '');
    await page.keyboard.press('v');
    await expect(modal(page)).not.toHaveAttribute('open');
  });

  test('V is ignored in form fields and over other dialogs, and the preview blocks wall shortcuts', async ({ page }) => {
    await page.focus('#wall-width-input');
    await page.keyboard.press('v');
    await expect(modal(page)).not.toHaveAttribute('open');
    await page.evaluate(() => document.activeElement.blur());

    await page.click('#view-spec-btn');
    await page.keyboard.press('v');
    await expect(modal(page)).not.toHaveAttribute('open');
    await page.keyboard.press('Escape');

    await page.click('.wall-item[data-id="item-1"]');
    await page.keyboard.press('v');
    await expect(modal(page)).toHaveAttribute('open', '');
    await page.keyboard.press('Delete');
    expect(await page.evaluate(() => wallItems.length)).toBe(2);
    await page.keyboard.press('Escape');
    await expect(modal(page)).not.toHaveAttribute('open');
  });

  test('the command palette opens the preview from Project & Export', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await page.fill('#command-search-input', '3d room preview');
    await page.keyboard.press('Enter');
    await expect(modal(page)).toHaveAttribute('open', '');
  });
});

test.describe('Wavefront OBJ export', () => {
  test('the export button downloads the wall and every visible item with its depth', async ({ page }) => {
    await page.click('.wall-item[data-id="item-1"]');
    await setDepth(page, 32);
    await page.evaluate(() => document.activeElement.blur());

    await page.click('#preview-3d-btn');
    const { name, buffer } = await downloadFrom(page, '#export-obj-btn');
    expect(name).toBe('spatial-studio-model.obj');
    await expect(page.locator('#io-status')).toHaveText('3D mesh exported as OBJ.');

    const text = buffer.toString('utf8');
    const lines = text.trim().split('\n');
    const objects = lines.filter((line) => line.startsWith('o '));
    expect(objects).toEqual(['o Wall', 'o Item_item-1_shelf', 'o Item_item-2_poster']);

    const vertices = lines.filter((line) => line.startsWith('v '));
    const faces = lines.filter((line) => line.startsWith('f '));
    expect(vertices).toHaveLength(24);
    expect(faces).toHaveLength(18);
    vertices.forEach((line) => expect(line).toMatch(/^v -?\d+(\.\d+)? -?\d+(\.\d+)? -?\d+(\.\d+)?$/));
    faces.forEach((line) => {
      const indices = line.slice(2).split(' ').map(Number);
      expect(indices).toHaveLength(4);
      indices.forEach((index) => expect(index >= 1 && index <= 24).toBe(true));
    });

    // The starter shelf: 48-158 cm across, its top 152 cm below the 250 cm ceiling, 8 cm tall, 32 cm deep
    const shelf = vertices.slice(8, 16).map((line) => line.slice(2).split(' ').map(Number));
    expect(Math.min(...shelf.map(([x]) => x))).toBe(48);
    expect(Math.max(...shelf.map(([x]) => x))).toBe(158);
    expect(Math.max(...shelf.map(([, y]) => y))).toBe(98);
    expect(Math.min(...shelf.map(([, y]) => y))).toBe(90);
    expect(shelf.map(([, , z]) => z).sort((a, b) => a - b)).toEqual([0, 0, 0, 0, 32, 32, 32, 32]);
    const wall = vertices.slice(0, 8).map((line) => line.slice(2).split(' ').map(Number));
    expect(Math.max(...wall.map(([x]) => x))).toBe(300);
    expect(Math.max(...wall.map(([, y]) => y))).toBe(250);
  });

  test('hidden items stay out of the mesh, room features get 1 cm, and the palette runs the same export', async ({ page }) => {
    await loadLayout(page, {
      wallItems: [
        wallItem('item-a', 'cube', 0, 0),
        wallItem('item-b', 'window', 300, 200),
        wallItem('item-c', 'storage', 500, 300, { hidden: true }),
      ],
    });

    await page.keyboard.press('Control+k');
    await page.fill('#command-search-input', 'export 3d mesh');
    await expect(page.locator('#command-list [role="option"]')).toHaveText([/Export 3D Mesh \(\.OBJ\)/]);
    const [download] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Enter')]);
    expect(download.suggestedFilename()).toBe('spatial-studio-model.obj');

    const obj = await page.evaluate(() => buildSceneObj());
    expect(obj.match(/^o .*$/gm)).toEqual(['o Wall', 'o Item_item-a_cube', 'o Item_item-b_window']);
    const windowZ = obj.split('o Item_item-b_window\n')[1].split('\n').slice(0, 8).map((line) => Number(line.split(' ')[3]));
    expect(Math.max(...windowZ)).toBe(1);
  });
});
