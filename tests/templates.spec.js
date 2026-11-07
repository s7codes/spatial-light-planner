import { test, expect } from './support/fixtures.js';
import {
  allRulersHidden,
  blurActiveElement,
  clippedLabels,
  getItems,
  loadLayout,
  selectItemById,
  selectedItem,
  toCm,
  topSnapshots,
  wallItem,
  wallState,
} from './support/planner.js';

const TEMPLATES = [
  { key: 'studio-default', label: 'Studio Default', widthCm: 300, heightCm: 250, atticSlope: false, count: 2 },
  { key: 'gallery-storage', label: 'Gallery & Storage', widthCm: 320, heightCm: 250, atticSlope: false, count: 7 },
  { key: 'attic-corner', label: 'Attic Corner', widthCm: 300, heightCm: 240, atticSlope: true, count: 5 },
];

// A layout no template matches, so loading any template is a real change
const SCRATCH_LAYOUT = { items: [wallItem('item-scratch', 'cube', 0, 0)] };

const layoutHealth = (page) =>
  page.evaluate(() => {
    const onWholeCm = (value) => Math.abs(value / 2.5 - Math.round(value / 2.5)) < 1e-9;
    const isOutside = (item) =>
      item.left < 0 || item.top < 0 || item.left + item.width > wallWidthPx || item.top + item.height > wallHeightPx;
    const idsWhere = (predicate) => wallItems.filter(predicate).map((item) => item.id);
    return {
      outside: idsWhere(isOutside),
      offGrid: idsWhere((item) => !['left', 'top', 'width', 'height'].every((key) => onWholeCm(item[key]))),
      overlapping: idsWhere((item) => hasOverlap(item)),
      intruding: idsWhere((item) => intrudesAtticSlope(item)),
      flagged: document.querySelectorAll('.wall-item.colliding').length,
    };
  });

const centimeterItems = async (page) =>
  (await getItems(page)).map((item) => ({
    type: item.type,
    finish: item.finish,
    left: toCm(item.left),
    top: toCm(item.top),
    width: toCm(item.width),
    height: toCm(item.height),
  }));

for (const template of TEMPLATES) {
  test.describe(`${template.label} template`, () => {
    test.beforeEach(async ({ page }) => {
      await loadLayout(page, SCRATCH_LAYOUT);
      await selectItemById(page, 'item-scratch');
      await page.click(`.template-btn[data-template="${template.key}"]`);
    });

    const wall = `${template.widthCm} x ${template.heightCm} cm`;
    const slope = template.atticSlope ? 'on' : 'off';

    test(`uses a ${wall} wall with the attic slope ${slope}`, async ({ page }) => {
      expect(await wallState(page)).toMatchObject({
        widthCm: template.widthCm,
        heightCm: template.heightCm,
        widthInput: String(template.widthCm),
        heightInput: String(template.heightCm),
      });
      await expect(page.locator('#attic-slope-toggle')).toBeChecked({ checked: template.atticSlope });
      await expect(page.locator('#attic-zone')).toBeVisible({ visible: template.atticSlope });
      expect(await getItems(page)).toHaveLength(template.count);
    });

    test('is collision-free, on the whole-cm grid and fully inside the wall', async ({ page }) => {
      expect(await layoutHealth(page)).toEqual({
        outside: [],
        offGrid: [],
        overlapping: [],
        intruding: [],
        flagged: 0,
      });
      expect(await clippedLabels(page)).toEqual([]);
    });

    test('clears the selection and confirms the load', async ({ page }) => {
      expect(await selectedItem(page)).toBeNull();
      expect(await allRulersHidden(page)).toBe(true);
      await expect(page.locator('#io-status')).toHaveText(`Loaded the ${template.label} template.`);
    });

    test('is exactly one undo step', async ({ page }) => {
      const [previous, current] = await topSnapshots(page);
      expect(previous.items.map((item) => item.id)).toEqual(['item-scratch']);
      expect(current.wallWidthCm).toBe(template.widthCm);

      await blurActiveElement(page);
      await page.keyboard.press('Control+z');
      expect((await getItems(page)).map((item) => item.id)).toEqual(['item-scratch']);
    });
  });
}

test.describe('template compositions', () => {
  test('Studio Default reproduces the starter layout', async ({ page }) => {
    await loadLayout(page, SCRATCH_LAYOUT);
    await page.click('.template-btn[data-template="studio-default"]');

    const items = await getItems(page);
    expect(items.map((item) => [item.id, item.type, item.finish, toCm(item.left), toCm(item.top)])).toEqual([
      ['item-1', 'shelf', 'walnut', 48, 152],
      ['item-2', 'poster', 'black', 78, 56],
    ]);
  });

  test('Gallery & Storage is symmetric around the wall center', async ({ page }) => {
    await page.click('.template-btn[data-template="gallery-storage"]');

    const items = await centimeterItems(page);
    const center = (item) => item.left + item.width / 2;
    const posters = items.filter((item) => item.type === 'poster');
    const spotlights = items.filter((item) => item.type === 'spotlight');
    const storage = items.find((item) => item.type === 'storage');
    const shelf = items.find((item) => item.type === 'shelf');
    const lamp = items.find((item) => item.type === 'corner-lamp');

    expect(posters).toHaveLength(2);
    expect(center(posters[0]) + center(posters[1])).toBe(320);
    expect(posters[0].top).toBe(posters[1].top);

    expect(spotlights).toHaveLength(2);
    spotlights.forEach((spotlight, n) => {
      expect(center(spotlight)).toBe(center(posters[n]));
      expect(spotlight.top + spotlight.height).toBeLessThan(posters[n].top);
    });

    expect(center(shelf)).toBe(160);
    // A 75 cm unit cannot center on a 320 cm wall without a half-centimeter position
    expect(center(storage)).toBe(159.5);
    expect(storage.finish).toBe('walnut');
    expect(250 - storage.top - storage.height).toBe(42);

    expect(lamp.top + lamp.height).toBe(250);
    expect(lamp.left + lamp.width).toBeGreaterThan(300);
  });

  test('Gallery & Storage lists the floor lamp at 0 cm from the floor in the spec sheet', async ({ page }) => {
    await page.click('.template-btn[data-template="gallery-storage"]');
    await page.click('#view-spec-btn');

    const lampRow = page.locator('#mounting-body tr', { hasText: 'Corner Floor Lamp' });
    await expect(lampRow.locator('td').nth(4)).toHaveText('0 cm');
  });

  test('Attic Corner tucks shelving, a cube and the lamp under the slope with clearance', async ({ page }) => {
    await page.click('.template-btn[data-template="attic-corner"]');

    const underSlope = await page.evaluate(() => {
      const slopeStart = wallWidthPx - 90 * 2.5;
      return wallItems
        .filter((item) => item.left + item.width > slopeStart)
        .map((item) => ({ type: item.type, clearanceCm: (item.top - (item.left + item.width - slopeStart)) / 2.5 }));
    });

    expect(underSlope.map((entry) => entry.type).sort()).toEqual(['corner-lamp', 'cube', 'shelf']);
    for (const entry of underSlope) expect(entry.clearanceCm).toBeGreaterThanOrEqual(12);
  });

  test('templates keep the lighting colors and persist across a reload', async ({ page }) => {
    await page.getByRole('button', { name: 'Neon Contrast' }).click();
    const accent = await page.inputValue('#accent-color-picker');

    await page.click('.template-btn[data-template="attic-corner"]');
    await expect(page.locator('#accent-color-picker')).toHaveValue(accent);

    await page.reload();
    expect(await wallState(page)).toMatchObject({ widthCm: 300, heightCm: 240 });
    await expect(page.locator('#attic-slope-toggle')).toBeChecked();
    expect(await getItems(page)).toHaveLength(5);
  });
});
