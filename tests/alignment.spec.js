import { test, expect } from './support/fixtures.js';
import {
  alignmentLines,
  allRulersHidden,
  clickWallAt,
  dragBy,
  getItem,
  getItems,
  loadLayout,
  nextFrame,
  releaseDrag,
  rulerLabelsOverlap,
  rulerState,
  selectItemById,
  topSnapshots,
  wallItem,
} from './support/planner.js';

const SIDES = ['gapLeft', 'gapRight', 'gapUp', 'gapDown'];
const SIZES = {
  shelf: [275, 20],
  cube: [90, 90],
  storage: [187.5, 95],
  poster: [125, 175],
  spotlight: [40, 40],
  'corner-lamp': [50, 350],
};

// Independent oracle for the ruler readouts: nearest neighbor per side whose projection overlaps the item
function expectedReadouts(items, id) {
  const active = items.find((item) => item.id === id);
  const right = active.left + active.width;
  const bottom = active.top + active.height;
  const nearest = {};
  const consider = (side, gap) => {
    if (nearest[side] === undefined || gap < nearest[side]) nearest[side] = gap;
  };

  for (const other of items) {
    if (other.id === id) continue;
    const otherRight = other.left + other.width;
    const otherBottom = other.top + other.height;
    const sharesRows = other.top < bottom && otherBottom > active.top;
    const sharesColumns = other.left < right && otherRight > active.left;
    if (sharesRows && otherRight <= active.left) consider('gapLeft', active.left - otherRight);
    if (sharesRows && other.left >= right) consider('gapRight', other.left - right);
    if (sharesColumns && otherBottom <= active.top) consider('gapUp', active.top - otherBottom);
    if (sharesColumns && other.top >= bottom) consider('gapDown', other.top - bottom);
  }

  const readout = (px) => (px > 0 ? `${Math.round(px / 2.5)} cm` : null);
  return {
    wallX: readout(active.left),
    wallY: readout(active.top),
    ...Object.fromEntries(SIDES.map((side) => [side, readout(nearest[side])])),
  };
}

const visibleReadouts = (page) =>
  page.evaluate(() =>
    Object.fromEntries(
      Object.entries(rulers).map(([key, ruler]) => [key, ruler.el.hidden ? null : ruler.label.textContent]),
    ),
  );

test.describe('gap rulers', () => {
  test('show the 26 cm gap between the starter poster and shelf', async ({ page }) => {
    await selectItemById(page, 'item-2');

    expect(await rulerState(page, 'gapDown')).toMatchObject({
      visible: true,
      text: '26 cm',
      left: '258px',
      top: '315px',
      height: '65px',
    });
    for (const side of ['gapLeft', 'gapRight', 'gapUp']) {
      expect(await rulerState(page, side)).toMatchObject({ visible: false });
    }
    expect(await rulerState(page, 'wallX')).toMatchObject({ top: '228px', width: '195px', text: '78 cm' });
    expect(await rulerState(page, 'wallY')).toMatchObject({ text: '56 cm' });

    await selectItemById(page, 'item-1');
    expect(await rulerState(page, 'gapUp')).toMatchObject({ visible: true, text: '26 cm' });
  });

  test('measure a left neighbor along the shared overlap and push the wall ruler outward', async ({ page }) => {
    await loadLayout(page, { items: [wallItem('item-a', 'cube', 300, 200), wallItem('item-b', 'poster', 100, 150)] });
    await selectItemById(page, 'item-a');

    expect(await rulerState(page, 'gapLeft')).toMatchObject({
      visible: true,
      text: '30 cm',
      left: '225px',
      width: '75px',
      top: '245px',
    });
    expect(await rulerState(page, 'wallX')).toMatchObject({ visible: true, text: '120 cm', top: '200px' });
    expect(await rulerLabelsOverlap(page)).toBe(false);
  });

  test('measure a top neighbor the same way', async ({ page }) => {
    await loadLayout(page, { items: [wallItem('item-a', 'cube', 300, 300), wallItem('item-b', 'shelf', 250, 200)] });
    await selectItemById(page, 'item-a');

    expect(await rulerState(page, 'gapUp')).toMatchObject({
      visible: true,
      text: '32 cm',
      top: '220px',
      height: '80px',
      left: '345px',
    });
    expect(await rulerState(page, 'wallY')).toMatchObject({ visible: true, text: '120 cm', left: '300px' });
    expect(await rulerLabelsOverlap(page)).toBe(false);
  });

  test('pick the nearest neighbor and ignore touching ones', async ({ page }) => {
    await loadLayout(page, {
      items: [
        wallItem('item-a', 'cube', 400, 200),
        wallItem('item-b', 'cube', 100, 200),
        wallItem('item-c', 'cube', 250, 220),
      ],
    });
    await selectItemById(page, 'item-a');
    expect(await rulerState(page, 'gapLeft')).toMatchObject({ text: '24 cm' });

    await loadLayout(page, { items: [wallItem('item-a', 'cube', 300, 200), wallItem('item-b', 'cube', 210, 200)] });
    await selectItemById(page, 'item-a');
    expect(await rulerState(page, 'gapLeft')).toMatchObject({ visible: false });
    expect(await rulerState(page, 'wallX')).toMatchObject({ top: '245px' });
  });

  test('right and down rulers update live during drags and nudges', async ({ page }) => {
    await loadLayout(page, {
      items: [
        wallItem('item-a', 'cube', 100, 100),
        wallItem('item-r', 'cube', 300, 120),
        wallItem('item-d', 'shelf', 50, 300),
      ],
    });
    await selectItemById(page, 'item-a');
    expect(await rulerState(page, 'gapRight')).toMatchObject({
      visible: true,
      text: '44 cm',
      left: '190px',
      width: '110px',
      top: '155px',
    });
    expect(await rulerState(page, 'gapDown')).toMatchObject({
      visible: true,
      text: '44 cm',
      top: '190px',
      height: '110px',
      left: '145px',
    });
    expect(await rulerLabelsOverlap(page)).toBe(false);

    await dragBy(page, 'item-a', 40, 0, { hold: true, alt: true });
    expect(await rulerState(page, 'gapRight')).toMatchObject({ text: '28 cm' });
    expect(await rulerState(page, 'wallX')).toMatchObject({ text: '56 cm' });
    await releaseDrag(page, { alt: true });
    expect(await rulerState(page, 'gapRight')).toMatchObject({ visible: true });
    expect(await rulerState(page, 'gapDown')).toMatchObject({ visible: true });

    await page.keyboard.press('ArrowRight');
    expect(await rulerState(page, 'gapRight')).toMatchObject({ text: '27 cm' });

    await clickWallAt(page, 28, 598);
    expect(await allRulersHidden(page)).toBe(true);
  });

  test('random layouts: readouts match an independent computation and labels never overlap', async ({ page }) => {
    let seed = 20261107;
    const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const types = Object.keys(SIZES);
    const mismatches = [];
    const overlaps = [];
    let selections = 0;

    for (let layout = 0; layout < 40; layout++) {
      const items = Array.from({ length: 3 + Math.floor(random() * 4) }, (_, n) => {
        const type = types[Math.floor(random() * types.length)];
        const [width, height] = SIZES[type];
        const left = Math.floor(random() * ((750 - width) / 2.5 + 1)) * 2.5;
        const top = Math.floor(random() * ((625 - height) / 2.5 + 1)) * 2.5;
        return wallItem(`item-r${n}`, type, left, top);
      });
      await loadLayout(page, { items });
      const placed = await getItems(page);

      for (const { id } of items) {
        await selectItemById(page, id);
        selections++;
        const expected = expectedReadouts(placed, id);
        const actual = await visibleReadouts(page);
        if (Object.keys(expected).some((key) => actual[key] !== expected[key])) {
          mismatches.push({ layout, id, expected, actual });
        }
        if (await rulerLabelsOverlap(page)) overlaps.push({ layout, id });
      }
    }

    expect(selections).toBeGreaterThan(150);
    expect(mismatches).toEqual([]);
    expect(overlaps).toEqual([]);
  });
});

test.describe('magnetic alignment', () => {
  const EDGE_LAYOUT = { items: [wallItem('item-a', 'shelf', 100, 450), wallItem('item-b', 'poster', 300, 100)] };

  test('snaps onto an edge within 1 cm and draws one guide spanning both items', async ({ page }) => {
    await loadLayout(page, EDGE_LAYOUT);

    const { guides } = await dragBy(page, 'item-b', -197, 0, { hold: true });
    expect(await getItem(page, 'item-b')).toMatchObject({ left: 100 });
    expect(guides).toEqual([{ vertical: true, left: '100px', top: '100px', width: '', height: '370px' }]);

    await releaseDrag(page);
    expect(await alignmentLines(page)).toEqual([]);
    expect(await rulerState(page, 'wallX')).toMatchObject({ visible: true, text: '40 cm' });
  });

  test('holding Alt places the item 1 cm away without snapping', async ({ page }) => {
    await loadLayout(page, EDGE_LAYOUT);

    const { guides } = await dragBy(page, 'item-b', -197, 0, { alt: true });

    expect(await getItem(page, 'item-b')).toMatchObject({ left: 102.5 });
    expect(guides).toEqual([]);
  });

  test('pressing Alt mid-drag releases the magnet and letting go re-engages it', async ({ page }) => {
    await loadLayout(page, EDGE_LAYOUT);
    await dragBy(page, 'item-b', -197, 0, { hold: true });

    await page.keyboard.down('Alt');
    await nextFrame(page);
    expect(await getItem(page, 'item-b')).toMatchObject({ left: 102.5 });
    expect(await alignmentLines(page)).toHaveLength(0);

    await page.keyboard.up('Alt');
    await nextFrame(page);
    expect(await getItem(page, 'item-b')).toMatchObject({ left: 100 });
    expect(await alignmentLines(page)).toHaveLength(1);

    await releaseDrag(page);
  });

  test('does not snap from 2 cm away', async ({ page }) => {
    await loadLayout(page, EDGE_LAYOUT);

    const { guides } = await dragBy(page, 'item-b', -195, 0);

    expect(await getItem(page, 'item-b')).toMatchObject({ left: 105 });
    expect(guides).toEqual([]);
  });

  test("snaps an item's center onto the wall center with a full-height guide", async ({ page }) => {
    await loadLayout(page, { items: [wallItem('item-c', 'cube', 100, 100)] });

    const { guides } = await dragBy(page, 'item-c', 233, 0);

    expect(await getItem(page, 'item-c')).toMatchObject({ left: 330 });
    expect(guides).toEqual([{ vertical: true, left: '375px', top: '0px', width: '', height: '625px' }]);
  });

  test('skips a match that would need a half-centimeter position', async ({ page }) => {
    await loadLayout(page, { items: [wallItem('item-s', 'storage', 50, 100)] });
    let { guides } = await dragBy(page, 'item-s', 232, 0);
    expect(await getItem(page, 'item-s')).toMatchObject({ left: 282.5 });
    expect(guides).toEqual([]);

    // On a 301 cm wall the 75 cm unit centers on a whole centimeter, so the same drag snaps
    await loadLayout(page, { wallWidthCm: 301, items: [wallItem('item-s', 'storage', 50, 100)] });
    ({ guides } = await dragBy(page, 'item-s', 232, 0));
    expect(await getItem(page, 'item-s')).toMatchObject({ left: 282.5 });
    expect(guides).toHaveLength(1);
    expect(guides[0].left).toBe('376.25px');
  });

  test('runs after 5 cm grid snapping', async ({ page }) => {
    await loadLayout(page, {
      items: [wallItem('item-a', 'shelf', 102.5, 450), wallItem('item-b', 'poster', 300, 100)],
    });
    await page.check('#snap-grid-toggle');

    const { guides } = await dragBy(page, 'item-b', -199, 0);

    expect(await getItem(page, 'item-b')).toMatchObject({ left: 102.5 });
    expect(guides).toHaveLength(1);
  });

  test('same-size items line up on start, center and end at once', async ({ page }) => {
    await loadLayout(page, { items: [wallItem('item-a', 'poster', 100, 400), wallItem('item-b', 'poster', 300, 100)] });

    const { guides } = await dragBy(page, 'item-b', -197, 0);

    expect(guides.every((line) => line.vertical)).toBe(true);
    expect(guides.map((line) => line.left).sort()).toEqual(['100px', '162.5px', '225px']);
  });

  test('vertical drags snap with horizontal guides', async ({ page }) => {
    await loadLayout(page, { items: [wallItem('item-a', 'cube', 100, 300), wallItem('item-b', 'cube', 400, 100)] });

    const { guides } = await dragBy(page, 'item-b', 0, 197);

    expect(await getItem(page, 'item-b')).toMatchObject({ top: 300 });
    expect(guides).toHaveLength(3);
    for (const line of guides) expect(line).toMatchObject({ vertical: false, left: '100px', width: '390px' });
  });

  test('a snapped drag commits a single history step', async ({ page }) => {
    await loadLayout(page, EDGE_LAYOUT);

    await dragBy(page, 'item-b', -197, 0);

    const [previous, current] = await topSnapshots(page);
    expect(previous.items.find((item) => item.id === 'item-b').left).toBe(300);
    expect(current.items.find((item) => item.id === 'item-b').left).toBe(100);
  });
});
