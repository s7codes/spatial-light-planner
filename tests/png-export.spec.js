import { test, expect } from './support/fixtures.js';
import {
  WALL_BORDER,
  downloadFrom,
  historyState,
  loadLayout,
  pngInfo,
  readPixels,
  selectItemById,
  wallItem,
} from './support/planner.js';

const PIXEL_RATIO = 2;
const AMBIENT_BACKGROUND = [28, 31, 38];
const DAYLIGHT_BACKGROUND = [229, 231, 235];
const WALNUT = [92, 64, 51];
const OAK = [200, 157, 102];

async function exportPng(page) {
  const { name, buffer } = await downloadFrom(page, '#export-png-btn');
  return { name, buffer, ...pngInfo(buffer) };
}

// Sample points are given in wall pixels and scaled into the 2x export
const sampleExport = (page, png, points) => readPixels(page, png.buffer, points, PIXEL_RATIO);

const largestStep = (pixels) =>
  Math.max(
    ...pixels
      .slice(1)
      .map((pixel, i) => Math.max(...pixel.map((value, channel) => Math.abs(value - pixels[i][channel])))),
  );

const setBrightness = (page, percent) =>
  page.evaluate((value) => {
    const slider = document.getElementById('brightness-slider');
    slider.value = String(value);
    slider.dispatchEvent(new Event('input'));
  }, percent);

test.describe('PNG export', () => {
  test('downloads a real PNG at twice the wall size without touching history', async ({ page }) => {
    const before = await historyState(page);

    const png = await exportPng(page);

    expect(png.name).toBe('spatial-studio-plan.png');
    expect(png.signature).toBe('89504e470d0a1a0a');
    expect([png.width, png.height]).toEqual([1500, 1250]);
    await expect(page.locator('#io-status')).toHaveText('Plan exported as PNG.');
    expect(await historyState(page)).toEqual(before);
  });

  test('paints the background, finishes and glows like the live wall', async ({ page }) => {
    const png = await exportPng(page);
    const [background, shelf, posterInside, posterBorder, shelfGlow, cornerGlow] = await sampleExport(page, png, [
      [10, 10],
      [130, 390],
      [205, 160],
      [197, 200],
      [257, 365],
      [660, 375],
    ]);

    expect(background).toBeNearColor(AMBIENT_BACKGROUND);
    expect(shelf).toBeNearColor(WALNUT);
    expect(posterInside).toBeNearColor([38, 41, 48]);
    expect(posterBorder).toBeNearColor([17, 19, 23]);
    expect(shelfGlow[0]).toBeGreaterThan(120);
    expect(shelfGlow[0]).toBeGreaterThan(shelfGlow[2] + 40);
    expect(cornerGlow[2]).toBeGreaterThan(100);
    expect(cornerGlow[2]).toBeGreaterThan(cornerGlow[0]);
    expect(cornerGlow[0]).toBeGreaterThan(cornerGlow[1]);
  });

  test('draws the label pills and the dimensions caption', async ({ page }) => {
    const labelWidth = await page.evaluate(() => getItemElement('item-2').querySelector('.item-label').offsetWidth);
    const png = await exportPng(page);

    const [pill, caption] = await sampleExport(page, png, [
      [257.5 - labelWidth / 2 + 2, 227.5],
      [12, 605],
    ]);

    for (const channel of pill) expect(channel).toBeLessThan(24);
    expect(caption[0]).toBeLessThan(24);
    expect(caption[2]).toBeLessThan(32);
    expect(caption).not.toBeNearColor(AMBIENT_BACKGROUND, 2);
  });

  test('leaves out the glow of an item whose backlight is off', async ({ page }) => {
    await selectItemById(page, 'item-1');
    await page.click('#led-toggle-btn');

    const [shelfGlow] = await sampleExport(page, await exportPng(page), [[257, 365]]);

    expect(shelfGlow[0]).toBeLessThan(45);
  });

  test('brightness 0 removes every glow from the export', async ({ page }) => {
    await setBrightness(page, 0);

    const [cornerGlow, shelfGlow] = await sampleExport(page, await exportPng(page), [
      [660, 375],
      [257, 365],
    ]);

    expect(cornerGlow).toBeNearColor(AMBIENT_BACKGROUND);
    expect(shelfGlow[0]).toBeLessThan(45);
  });

  test('Daylight Grid exports draw the 10 cm grid and no glows', async ({ page }) => {
    await page.click('#theme-toggle-btn');

    const [background, gridLine, shelfGlow, cornerGlow, shelf] = await sampleExport(page, await exportPng(page), [
      [12, 12],
      [25.2, 12],
      [257, 365],
      [662, 380],
      [130, 390],
    ]);

    expect(background).toBeNearColor(DAYLIGHT_BACKGROUND);
    expect(gridLine).toBeNearColor([215, 217, 221]);
    expect(shelfGlow).toBeNearColor(DAYLIGHT_BACKGROUND, 4);
    expect(cornerGlow).toBeNearColor(DAYLIGHT_BACKGROUND, 4);
    expect(shelf).toBeNearColor(WALNUT);
  });

  test('exports the attic slope with its red border and tinted interior', async ({ page }) => {
    await page.check('#attic-slope-toggle');

    const [edge, inside] = await sampleExport(page, await exportPng(page), [
      [638.5, 111.5],
      [745, 60],
    ]);

    expect(edge[0]).toBeGreaterThan(edge[1] + 60);
    expect(inside[0]).toBeGreaterThanOrEqual(inside[1] + 5);
  });

  test('paints items in layer order', async ({ page }) => {
    await loadLayout(page, {
      items: [
        wallItem('item-x', 'cube', 100, 100, { finish: 'walnut' }),
        wallItem('item-y', 'cube', 140, 120, { finish: 'oak' }),
      ],
    });
    let [overlap] = await sampleExport(page, await exportPng(page), [[175, 125]]);
    expect(overlap).toBeNearColor(OAK);

    await selectItemById(page, 'item-y');
    await page.click('#send-backward-btn');

    [overlap] = await sampleExport(page, await exportPng(page), [[175, 125]]);
    expect(overlap).toBeNearColor(WALNUT);
  });

  test('draws storage handles, door seams and round spotlights from the computed styles', async ({ page }) => {
    await loadLayout(page, {
      items: [wallItem('item-st', 'storage', 100, 300), wallItem('item-sp', 'spotlight', 400, 100)],
    });
    const [handle, seam] = await sampleExport(page, await exportPng(page), [
      [187.75, 320],
      [193.75, 360],
    ]);
    expect(handle).toBeNearColor([137, 143, 157], 8);
    expect(seam).toBeNearColor([60, 42, 33], 6);

    await page.click('#theme-toggle-btn');
    const [spotlightCorner, spotlightBody] = await sampleExport(page, await exportPng(page), [
      [401, 101],
      [420, 108],
    ]);
    for (const channel of spotlightCorner) expect(channel).toBeGreaterThan(170);
    expect(spotlightBody).toBeNearColor([31, 34, 41], 4);
  });

  test('ignores the on-screen fit and always renders the full wall at 2x', async ({ page }) => {
    await loadLayout(page, { wallWidthCm: 400, wallHeightCm: 300, items: [wallItem('item-a', 'cube', 100, 100)] });
    expect(await page.evaluate(() => viewScale)).toBeLessThan(1);

    const png = await exportPng(page);

    expect([png.width, png.height]).toEqual([2000, 1500]);
  });
});

test.describe('brand stamp', () => {
  const stamp = (page) => page.evaluate(() => currentBrandStamp());
  const today = (page) =>
    page.evaluate(() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    });

  test('signs the export with Lumen, the project name and the date in a free corner', async ({ page }) => {
    const plan = await stamp(page);
    const date = await today(page);
    expect(plan).toMatchObject({
      corner: 'bottom-right',
      brand: 'Lumen',
      project: 'Default Project',
      date,
      detail: `Default Project | ${date}`,
    });
    expect(plan.left + plan.width).toBe(740);
    expect(plan.top + plan.height).toBe(615);

    const png = await exportPng(page);
    expect([png.width, png.height]).toEqual([1500, 1250]);
    const brandRow = Array.from({ length: 40 }, (_, k) => [plan.left + 20 + k, plan.top + 16.5]);
    const brightest = Math.max(...(await sampleExport(page, png, brandRow)).map((pixel) => Math.min(...pixel)));
    expect(brightest).toBeGreaterThan(150);
    const [card] = await sampleExport(page, png, [[plan.left + 4, plan.top + plan.height - 4]]);
    expect(card).not.toBeNearColor(AMBIENT_BACKGROUND, 2);
    expect(Math.max(...card)).toBeLessThan(Math.max(...AMBIENT_BACKGROUND));
  });

  test('steps aside for items in the corner and never paints over them', async ({ page }) => {
    await loadLayout(page, { items: [wallItem('item-corner', 'storage', 562.5, 530, { finish: 'walnut' })] });
    let plan = await stamp(page);
    expect(plan).toMatchObject({ corner: 'top-left', left: 10, top: 10 });

    const [storage] = await sampleExport(page, await exportPng(page), [[700, 600]]);
    expect(storage).toBeNearColor(WALNUT, 6);

    // With the slope on, top right is off limits, so a crowded wall falls back under the items
    await loadLayout(page, {
      atticSlope: true,
      items: [wallItem('item-corner', 'storage', 562.5, 530), wallItem('item-top', 'shelf', 0, 0)],
    });
    plan = await stamp(page);
    expect(plan.corner).toBe('bottom-right');
  });

  test('a long project name is shortened, but the date always shows', async ({ page }) => {
    await page.click('#projects-btn');
    await page.fill('#new-project-name', 'Upstairs living room feature wall with the reading nook and shelving');
    await page.click('#save-project-btn');
    await page.keyboard.press('Escape');

    const plan = await stamp(page);
    expect(plan.project).toMatch(/^Upstairs living room/);
    expect(plan.detail).toMatch(new RegExp(`^Upstairs living room.*\\.\\.\\. \\| ${await today(page)}$`));
    expect(plan.width).toBeLessThanOrEqual(240 + 24 + 1);
  });
});

test.describe('corner glow', () => {
  test('fades out with no hard edge on screen and in the export', async ({ page }) => {
    const wall = await page.locator('#wall').boundingBox();
    const screenshot = await page.screenshot({ clip: wall, animations: 'disabled' });
    const row = Array.from({ length: 13 }, (_, k) => [WALL_BORDER + 444 + k, WALL_BORDER + 300]);
    expect(largestStep(await readPixels(page, screenshot, row))).toBeLessThanOrEqual(3);

    const png = await exportPng(page);
    const exportRow = Array.from({ length: 13 }, (_, k) => [444 + k, 300]);
    expect(largestStep(await sampleExport(page, png, exportRow))).toBeLessThanOrEqual(3);

    const [center] = await sampleExport(page, png, [[660, 375]]);
    expect(center[2]).toBeGreaterThan(100);
    expect(center[2]).toBeGreaterThan(center[0]);
  });
});
