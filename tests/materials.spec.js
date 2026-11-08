import { test, expect } from './support/fixtures.js';
import {
  downloadFrom,
  getItems,
  itemLocator,
  loadLayout,
  readPixels,
  selectItemById,
  wallItem,
  wallScreenPixels,
} from './support/planner.js';

const PIXEL_RATIO = 2;
const MAT = [38, 41, 48];
const ART = [26, 29, 36];
const UNLIT_DIFFUSER = [59, 70, 86];

// The starter shelf and poster plus a lamp and a spotlight, so every new material is on the wall
const MATERIAL_LAYOUT = {
  items: [
    wallItem('item-1', 'shelf', 120, 380),
    wallItem('item-2', 'poster', 195, 140),
    wallItem('item-lamp', 'corner-lamp', 650, 260),
    wallItem('item-spot', 'spotlight', 520, 60),
  ],
};

const SAMPLE_POINTS = {
  posterFrame: [197, 200],
  mat: [205, 160],
  artCenter: [257, 290],
  artTopEdge: [257, 157],
  shelfTopBand: [130, 381],
  shelfMiddle: [130, 390],
  shelfBottomBand: [130, 398],
  lampCore: [675, 320],
  spotlightWash: [540, 130],
};

async function exportPixels(page, points) {
  const { buffer } = await downloadFrom(page, '#export-png-btn');
  return readPixels(page, buffer, points, PIXEL_RATIO);
}

const named = (values) => Object.fromEntries(Object.keys(SAMPLE_POINTS).map((key, i) => [key, values[i]]));

const coneOpacity = (page, id) =>
  page.evaluate((itemId) => getComputedStyle(getItemElement(itemId), '::after').opacity, id);

test.describe('wall item materials', () => {
  test.beforeEach(async ({ page }) => {
    await loadLayout(page, MATERIAL_LAYOUT);
  });

  test('the PNG export matches the live wall on every new material', async ({ page }) => {
    const points = Object.values(SAMPLE_POINTS);
    const screen = named(await wallScreenPixels(page, points));
    const exported = named(await exportPixels(page, points));

    for (const key of Object.keys(SAMPLE_POINTS)) {
      expect(exported[key], key).toBeNearColor(screen[key], 6);
    }
  });

  test('finishes catch light on the top edge and fall into shade at the bottom', async ({ page }) => {
    const { shelfTopBand, shelfMiddle, shelfBottomBand } = named(
      await exportPixels(page, Object.values(SAMPLE_POINTS)),
    );

    expect(shelfMiddle).toBeNearColor([92, 64, 51]);
    shelfTopBand.forEach((channel, i) => expect(channel).toBeGreaterThan(shelfMiddle[i] + 8));
    shelfBottomBand.forEach((channel, i) => expect(channel).toBeLessThan(shelfMiddle[i] - 6));
  });

  test('a framed poster keeps its black frame and sets the artwork back behind a mat', async ({ page }) => {
    const { posterFrame, mat, artCenter, artTopEdge } = named(
      await wallScreenPixels(page, Object.values(SAMPLE_POINTS)),
    );

    expect(posterFrame).toBeNearColor([17, 19, 23], 4);
    expect(mat).toBeNearColor(MAT);
    expect(artCenter).toBeNearColor(ART);
    artTopEdge.forEach((channel, i) => expect(channel).toBeLessThan(artCenter[i]));
  });

  test('item labels stay above the poster artwork', async ({ page }) => {
    const labelWidth = await page.evaluate(() => getItemElement('item-2').querySelector('.item-label').offsetWidth);
    const [pill] = await wallScreenPixels(page, [[257.5 - labelWidth / 2 + 2, 227.5]]);

    for (const channel of pill) expect(channel).toBeLessThan(16);
  });

  test('the lamp diffuser glows in the corner color and goes unlit in daylight or with its LED off', async ({
    page,
  }) => {
    let [core] = await exportPixels(page, [SAMPLE_POINTS.lampCore]);
    expect(core).toBeNearColor([139, 92, 246], 10);

    await page.click('#theme-toggle-btn');
    [core] = await exportPixels(page, [SAMPLE_POINTS.lampCore]);
    expect(core).toBeNearColor(UNLIT_DIFFUSER, 8);

    await page.click('#theme-toggle-btn');
    await selectItemById(page, 'item-lamp');
    await page.click('#led-toggle-btn');
    [core] = await exportPixels(page, [SAMPLE_POINTS.lampCore]);
    expect(core).toBeNearColor(UNLIT_DIFFUSER, 8);
  });

  test('a lit spotlight casts a wash below it, and only in Ambient Mode with its LED on', async ({ page }) => {
    expect(Number(await coneOpacity(page, 'item-spot'))).toBeCloseTo(0.22, 2);
    const [lit] = await exportPixels(page, [SAMPLE_POINTS.spotlightWash]);

    await page.click('#theme-toggle-btn');
    await expect.poll(() => coneOpacity(page, 'item-spot')).toBe('0');
    const [daylight] = await exportPixels(page, [SAMPLE_POINTS.spotlightWash]);
    expect(daylight).toBeNearColor([229, 231, 235], 4);

    await page.click('#theme-toggle-btn');
    await selectItemById(page, 'item-spot');
    await page.click('#led-toggle-btn');
    await expect.poll(() => coneOpacity(page, 'item-spot')).toBe('0');
    const [unlit] = await exportPixels(page, [SAMPLE_POINTS.spotlightWash]);

    // The default accent is orange, so the wash shows up as extra red over the unlit wall
    expect(lit[0]).toBeGreaterThan(unlit[0] + 12);
  });

  test('the wash and diffuser follow the master dimmer', async ({ page }) => {
    await page.evaluate(() => {
      const slider = document.getElementById('brightness-slider');
      slider.value = '0';
      slider.dispatchEvent(new Event('input'));
    });

    await expect.poll(() => coneOpacity(page, 'item-spot')).toBe('0');
    await expect.poll(() => coneOpacity(page, 'item-lamp')).toBe('0');
    expect((await getItems(page)).length).toBe(4);
    await expect(itemLocator(page, 'item-lamp')).toBeVisible();
  });
});
