import { test, expect } from './support/fixtures.js';
import {
  WALL_BORDER,
  clickWallAt,
  dragBy,
  getItem,
  loadLayout,
  nextFrame,
  releaseDrag,
  selectItemById,
  selectItemsById,
  setWallSize,
  wallItem,
  wallPoint,
  wallState,
} from './support/planner.js';

const SCALE = 2.5;
const RULER_SIZE = 16;
const RULER_GAP = 4;

const rulerMarks = (page, axis) =>
  page.evaluate((key) => {
    const ruler = document.getElementById(`ruler-${key}`);
    return {
      ticks: ruler.querySelectorAll('.ruler-tick').length,
      majors: ruler.querySelectorAll('.ruler-tick.is-major').length,
      labels: [...ruler.querySelectorAll('.ruler-label')].map((label) => label.textContent),
      endLabels: [...ruler.querySelectorAll('.ruler-label.is-end')].map((label) => label.textContent),
    };
  }, axis);

// Screen offset of a tick from the wall's content corner, the point the rulers measure from
const tickOffset = (page, axis, cm) =>
  page.evaluate(
    ({ key, index, border }) => {
      const wall = wallCanvas.getBoundingClientRect();
      const tick = document.querySelectorAll(`#ruler-${key} .ruler-tick`)[index].getBoundingClientRect();
      return key === 'x' ? tick.left - (wall.left + border * viewScale) : tick.top - (wall.top + border * viewScale);
    },
    { key: axis, index: cm / 10, border: WALL_BORDER },
  );

// Labels poking past the end of their ruler would be cut off by its rounded clip
const clippedRulerLabels = (page) =>
  page.evaluate(() =>
    ['x', 'y'].flatMap((key) => {
      const ruler = document.getElementById(`ruler-${key}`).getBoundingClientRect();
      return [...document.querySelectorAll(`#ruler-${key} .ruler-label`)]
        .filter((label) => {
          const box = label.getBoundingClientRect();
          return (
            box.left < ruler.left - 0.5 ||
            box.right > ruler.right + 0.5 ||
            box.top < ruler.top - 0.5 ||
            box.bottom > ruler.bottom + 0.5
          );
        })
        .map((label) => `${key}:${label.textContent}`);
    }),
  );

const hairlines = (page) =>
  page.evaluate(() =>
    Object.fromEntries(
      ['x', 'y'].map((key) => {
        const line = document.querySelector(`#ruler-${key} .ruler-hairline`);
        return [
          key,
          {
            visible: !line.hidden,
            readout: line.textContent,
            transform: line.style.transform,
            flipped: line.classList.contains('is-flipped'),
            box: line.hidden ? null : line.getBoundingClientRect().toJSON(),
          },
        ];
      }),
    ),
  );

const spans = (page) =>
  page.evaluate(() =>
    Object.fromEntries(
      ['x', 'y'].map((key) => {
        const span = document.querySelector(`#ruler-${key} .ruler-span`);
        return [
          key,
          span.hidden
            ? null
            : { left: span.style.left, width: span.style.width, top: span.style.top, height: span.style.height },
        ];
      }),
    ),
  );

async function hover(page, x, y) {
  const point = await wallPoint(page, x, y);
  await page.mouse.move(point.x, point.y);
  await nextFrame(page);
  return point;
}

test.describe('canvas rulers', () => {
  test('both rulers frame the wall with a tick every 10 cm and a label every 50 cm', async ({ page }) => {
    const x = await rulerMarks(page, 'x');
    const y = await rulerMarks(page, 'y');
    expect(x).toEqual({
      ticks: 31,
      majors: 7,
      labels: ['0', '50', '100', '150', '200', '250', '300'],
      endLabels: ['300'],
    });
    expect(y).toEqual({ ticks: 26, majors: 6, labels: ['0', '50', '100', '150', '200', '250'], endLabels: ['250'] });

    const { scale } = await wallState(page);
    const wall = await page.locator('#wall').boundingBox();
    const rulerX = await page.locator('#ruler-x').boundingBox();
    const rulerY = await page.locator('#ruler-y').boundingBox();
    const corner = await page.locator('#ruler-corner').boundingBox();
    const inner = WALL_BORDER * scale;

    // Each ruler spans exactly the wall's inner face and stops a small gap short of its frame
    expect(rulerX.x).toBeCloseTo(wall.x + inner, 1);
    expect(rulerX.width).toBeCloseTo(750 * scale, 1);
    expect(rulerX.height).toBe(RULER_SIZE);
    expect(rulerX.y + rulerX.height).toBeCloseTo(wall.y - RULER_GAP, 1);
    expect(rulerY.y).toBeCloseTo(wall.y + inner, 1);
    expect(rulerY.height).toBeCloseTo(625 * scale, 1);
    expect(rulerY.x + rulerY.width).toBeCloseTo(wall.x - RULER_GAP, 1);
    expect(corner.x).toBeCloseTo(rulerY.x, 1);
    expect(corner.y).toBeCloseTo(rulerX.y, 1);
    expect([corner.width, corner.height]).toEqual([RULER_SIZE, RULER_SIZE]);

    for (const cm of [0, 10, 150, 300]) expect(await tickOffset(page, 'x', cm)).toBeCloseTo(cm * SCALE * scale, 1);
    for (const cm of [0, 120, 250]) expect(await tickOffset(page, 'y', cm)).toBeCloseTo(cm * SCALE * scale, 1);
    expect(await clippedRulerLabels(page)).toEqual([]);

    const layer = page.locator('.canvas-rulers');
    await expect(layer).toHaveAttribute('aria-hidden', 'true');
    await expect(layer).toHaveCSS('pointer-events', 'none');
    await expect(page.locator('#ruler-x')).toHaveCSS('backdrop-filter', /blur/);
  });

  test('resizing the wall rebuilds the marks at the new fit scale, and end labels never clip', async ({ page }) => {
    await setWallSize(page, { width: 400, height: 300 });
    const { scale, note } = await wallState(page);
    expect(scale).toBeLessThan(1);
    expect(note).toMatch(/fit \d+%/);

    expect(await rulerMarks(page, 'x')).toMatchObject({ ticks: 41, majors: 9, endLabels: ['400'] });
    expect(await rulerMarks(page, 'y')).toMatchObject({ ticks: 31, majors: 7, endLabels: ['300'] });
    expect((await page.locator('#ruler-x').boundingBox()).width).toBeCloseTo(1000 * scale, 1);
    expect(await tickOffset(page, 'x', 200)).toBeCloseTo(200 * SCALE * scale, 1);
    expect(await tickOffset(page, 'y', 300)).toBeCloseTo(300 * SCALE * scale, 1);

    // 305 cm leaves the 300 label only 5 cm of ruler, so it flips to the near side of its tick
    await setWallSize(page, { width: 305, height: 255 });
    expect(await rulerMarks(page, 'x')).toMatchObject({ ticks: 31, endLabels: ['300'] });
    expect(await rulerMarks(page, 'y')).toMatchObject({ ticks: 26, endLabels: ['250'] });
    expect(await clippedRulerLabels(page)).toEqual([]);
  });

  test('hairlines follow the pointer with a whole-cm readout and never rebuild the scale', async ({ page }) => {
    const before = await hairlines(page);
    expect(before.x.visible).toBe(false);
    expect(before.y.visible).toBe(false);
    await page.evaluate(() => {
      document.querySelector('#ruler-x .ruler-tick').dataset.mark = 'kept';
    });
    const { scale } = await wallState(page);

    // The browser reports whole-pixel pointer positions, so a hairline may sit up to a pixel from the target
    const point = await hover(page, 300, 200);
    let lines = await hairlines(page);
    expect(lines.x).toMatchObject({ visible: true, readout: '120', flipped: false });
    expect(lines.y).toMatchObject({ visible: true, readout: '80', flipped: false });
    expect(lines.x.transform).toMatch(/^translateX\([\d.]+px\)$/);
    expect(lines.y.transform).toMatch(/^translateY\([\d.]+px\)$/);
    expect(Math.abs(lines.x.box.x - point.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(lines.y.box.y - point.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(parseFloat(lines.x.transform.slice(11)) - 300 * scale)).toBeLessThanOrEqual(1);

    // 457 px is 182.8 cm, which reads as the nearest whole centimeter
    await hover(page, 457, 33);
    lines = await hairlines(page);
    expect(lines.x.readout).toBe('183');
    expect(lines.y.readout).toBe('13');
    expect(await page.evaluate(() => document.querySelector('#ruler-x .ruler-tick').dataset.mark)).toBe('kept');

    // Near the far ends the readouts swap sides so the ruler does not clip them
    await hover(page, 745, 620);
    lines = await hairlines(page);
    expect(lines.x).toMatchObject({ readout: '298', flipped: true });
    expect(lines.y).toMatchObject({ readout: '248', flipped: true });
    const ruler = await page.locator('#ruler-y').boundingBox();
    const readout = await page.locator('#ruler-y .ruler-readout').boundingBox();
    expect(readout.y).toBeGreaterThanOrEqual(ruler.y);
    expect(readout.y + readout.height).toBeLessThanOrEqual(ruler.y + ruler.height + 0.5);
    expect(readout.x + readout.width).toBeLessThanOrEqual(ruler.x + ruler.width + 0.5);
  });

  test('hairlines hide off the wall, outside the window and behind a dialog', async ({ page }) => {
    await hover(page, 100, 100);
    expect((await hairlines(page)).x.visible).toBe(true);

    const wall = await page.locator('#wall').boundingBox();
    await page.mouse.move(wall.x - 12, wall.y + 100);
    await nextFrame(page);
    let lines = await hairlines(page);
    expect([lines.x.visible, lines.y.visible]).toEqual([false, false]);

    await hover(page, 100, 100);
    await page.evaluate(() => document.documentElement.dispatchEvent(new MouseEvent('mouseleave')));
    expect((await hairlines(page)).x.visible).toBe(false);

    await page.click('#view-spec-btn');
    await hover(page, 200, 200);
    lines = await hairlines(page);
    expect([lines.x.visible, lines.y.visible]).toEqual([false, false]);
  });

  test('the rulers shade the selection extent and track a drag without disturbing its math', async ({ page }) => {
    await loadLayout(page, {
      items: [wallItem('item-a', 'cube', 100, 100), wallItem('item-b', 'shelf', 300, 400)],
    });
    const { scale } = await wallState(page);
    const px = (value) => `${value * scale}px`;
    expect(await spans(page)).toEqual({ x: null, y: null });

    await selectItemById(page, 'item-a');
    expect(await spans(page)).toEqual({
      x: { left: px(100), width: px(90), top: '', height: '' },
      y: { left: '', width: '', top: px(100), height: px(90) },
    });

    await selectItemsById(page, ['item-a', 'item-b']);
    const both = await spans(page);
    expect([both.x.left, both.x.width]).toEqual([px(100), px(475)]);
    expect([both.y.top, both.y.height]).toEqual([px(100), px(320)]);

    await clickWallAt(page, 600, 40);
    expect(await spans(page)).toEqual({ x: null, y: null });

    // A press on the ruler band would land on the canvas; the rulers never take it
    const rulerX = await page.locator('#ruler-x').boundingBox();
    const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y).closest('.canvas-rulers'), {
      x: rulerX.x + 40,
      y: rulerX.y + 8,
    });
    expect(hit).toBeNull();

    const { startX, startY } = await dragBy(page, 'item-a', 100, 50, { hold: true });
    const lines = await hairlines(page);
    expect(Math.abs(lines.x.box.x - (startX + 100))).toBeLessThanOrEqual(1);
    expect(Math.abs(lines.y.box.y - (startY + 50))).toBeLessThanOrEqual(1);
    const during = await spans(page);
    expect(during.x.left).toBe(px(100 + 100 / scale));
    expect(during.y.top).toBe(px(100 + 50 / scale));
    await releaseDrag(page);

    expect(await getItem(page, 'item-a')).toMatchObject({ left: 100 + 100 / scale, top: 100 + 50 / scale });
  });
});
