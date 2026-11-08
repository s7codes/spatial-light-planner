import { test, expect } from './support/fixtures.js';
import { downloadFrom, importFile, loadLayout, wallItem } from './support/planner.js';

const BOM_HEADER = 'Item,Width (cm),Height (cm),Finish,Qty,Unit Price (USD),Subtotal (USD)';
const MOUNT_HEADER = 'Item,Width (cm),Height (cm),From Left (cm),From Ceiling (cm),From Floor (cm)';
const UTF8_BOM = [0xef, 0xbb, 0xbf];

// A strict RFC 4180 reader, so the tests check the file the way a spreadsheet would read it
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field === '') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\r' && text[i + 1] === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length) throw new Error('CSV must end with CRLF');
  return rows;
}

async function exportCsv(page) {
  await page.click('#view-spec-btn');
  const { name, buffer } = await downloadFrom(page, '#export-csv-btn');
  expect(name).toBe('spatial-studio-specs.csv');
  expect([...buffer.subarray(0, 3)]).toEqual(UTF8_BOM);
  return buffer.subarray(3).toString('utf8');
}

const tableRows = (page, selector) =>
  page.evaluate(
    (query) =>
      [...document.querySelectorAll(`${query} tr`)].map((tr) =>
        [...tr.children].map((cell) => cell.textContent.trim()),
      ),
    selector,
  );

test.describe('CSV export', () => {
  test('Export CSV downloads both spec tables as one spreadsheet-ready file', async ({ page }) => {
    await expect(page.locator('#copy-markdown-btn + #export-csv-btn')).toHaveCount(1);

    const text = await exportCsv(page);

    expect(text).toBe(
      [
        'Spatial Studio Spec Sheet',
        'Wall (cm),300 x 250',
        '',
        'Bill of Materials',
        BOM_HEADER,
        'Floating Shelf,110,8,Walnut,1,45.00,45.00',
        'Poster Frame,50,70,Black,1,25.00,25.00',
        'Total,,,,2,,70.00',
        '',
        'Mounting & Drilling Coordinates',
        MOUNT_HEADER,
        'Floating Shelf,110,8,48,152,90',
        'Poster Frame,50,70,78,56,124',
        '',
      ].join('\r\n'),
    );
    // Every line break is CRLF, the line ending RFC 4180 and Excel expect
    expect(text.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);

    const button = page.locator('#export-csv-btn');
    await expect(button).toHaveText('Downloaded!');
    await expect(page.locator('#copy-markdown-btn')).toHaveText('Copy as Markdown');
    await expect(page.locator('#spec-modal')).toBeVisible();
    await expect(button).toHaveText('Export CSV', { timeout: 3500 });

    // Reopening the sheet mid-flash starts from a clean label
    await button.click();
    await expect(button).toHaveText('Downloaded!');
    await page.click('#close-spec-btn');
    await page.click('#view-spec-btn');
    await expect(button).toHaveText('Export CSV');
  });

  test('rows follow the tables on screen, with grouped, turned and fixture-free content', async ({ page }) => {
    await loadLayout(page, {
      wallWidthCm: 360,
      wallHeightCm: 240,
      items: [
        wallItem('item-c1', 'cube', 0, 0, { finish: 'oak' }),
        wallItem('item-c2', 'cube', 200, 0, { finish: 'oak' }),
        wallItem('item-turn', 'shelf', 500, 100, { finish: 'walnut', rotation: 90, width: 20, height: 275 }),
        wallItem('item-plug', 'socket', 300, 300),
        wallItem('item-note', 'note', 600, 400),
      ],
    });

    const rows = parseCsv(await exportCsv(page));
    expect(rows.map((row) => row.join(','))).toEqual([
      'Spatial Studio Spec Sheet',
      'Wall (cm),360 x 240',
      '',
      'Bill of Materials',
      BOM_HEADER,
      // The bill lists a turned piece at its catalog size; mounting uses its size on the wall
      'Floating Shelf,110,8,Walnut,1,45.00,45.00',
      'Modular Cube,36,36,Oak,2,30.00,60.00',
      'Total,,,,3,,105.00',
      '',
      'Mounting & Drilling Coordinates',
      MOUNT_HEADER,
      'Modular Cube,36,36,0,0,204',
      'Modular Cube,36,36,80,0,204',
      'Floating Shelf,8,110,200,40,90',
    ]);

    const bom = await tableRows(page, '#bom-body');
    expect(rows.slice(5, 5 + bom.length)).toEqual(
      bom.map(([name, size, finish, qty, price, subtotal]) => [
        name,
        ...size.replace(' cm', '').split(' x '),
        finish,
        qty,
        price.slice(1),
        subtotal.slice(1),
      ]),
    );
    const [[, totalQty, , grandTotal]] = await tableRows(page, '#bom-foot');
    expect(rows[5 + bom.length]).toEqual(['Total', '', '', '', totalQty, '', grandTotal.slice(1)]);

    const mounting = await tableRows(page, '#mounting-body');
    expect(rows.slice(11)).toEqual(
      mounting.map(([name, size, left, top, floor]) => [
        name,
        ...size.replace(' cm', '').split(' x '),
        ...[left, top, floor].map((cell) => cell.replace(' cm', '')),
      ]),
    );
  });

  test('names with commas, quotes or line breaks are quoted, and formula-like text is defused', async ({ page }) => {
    const names = ['Shelf, "oak" 12in', '=HYPERLINK("http://x","go")', '+SUM(1,2)', '@cmd', '-1 spare', 'Two\nlines'];
    const status = await importFile(
      page,
      'names.json',
      JSON.stringify({
        version: '1.5',
        wallItems: names.map((name, i) => wallItem(`item-${i}`, 'cube', i * 110, 0, { name })),
      }),
    );
    await expect(status).toHaveText('Imported 6 items.');

    const text = await exportCsv(page);
    expect(text).toContain('\r\n"Shelf, ""oak"" 12in",36,36,');
    expect(text).toContain('\r\n"\'=HYPERLINK(""http://x"",""go"")",36,36,');
    expect(text).toContain('\r\n"\'+SUM(1,2)",36,36,');
    expect(text).toContain("\r\n'@cmd,36,36,");
    expect(text).toContain('\r\n"Two\nlines",36,36,');

    const rows = parseCsv(text);
    const mounting = rows.slice(rows.findIndex((row) => row[0] === 'Mounting & Drilling Coordinates') + 2);
    expect(mounting.map((row) => row[0])).toEqual([
      'Shelf, "oak" 12in',
      `'=HYPERLINK("http://x","go")`,
      "'+SUM(1,2)",
      "'@cmd",
      "'-1 spare",
      'Two\nlines',
    ]);
    // Every row still has its six columns once quoting is undone
    expect(mounting.every((row) => row.length === 6)).toBe(true);

    // Numbers are data, so a negative value would keep its sign; only text gets the guard
    const fields = await page.evaluate(() =>
      [-5, '-5', 12.5, '\tTab', '\rCR', 'plain', ''].map((value) => csvField(value)),
    );
    expect(fields).toEqual(['-5', "'-5", '12.5', "'\tTab", '"\'\rCR"', 'plain', '']);
  });

  test('an empty wall still exports both headers and a zero total', async ({ page }) => {
    await loadLayout(page, { items: [] });

    expect(parseCsv(await exportCsv(page)).map((row) => row.join(','))).toEqual([
      'Spatial Studio Spec Sheet',
      'Wall (cm),300 x 250',
      '',
      'Bill of Materials',
      BOM_HEADER,
      'Total,,,,0,,0.00',
      '',
      'Mounting & Drilling Coordinates',
      MOUNT_HEADER,
    ]);
  });
});
