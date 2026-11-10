import { test, expect } from './support/fixtures.js';
import {
  downloadFrom, getItem, importFile, itemLocator, loadLayout, pngInfo, selectItemById, wallItem, wallState,
} from './support/planner.js';

const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; " +
  "font-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none';";

const IMG_PAYLOAD = '<img src=x onerror="window.__xss=1">';
const SCRIPT_PAYLOAD = '"><script>window.__xss=1</script>';
const FORMULA = '=HYPERLINK("http://evil")';

const POLLUTED =
  '{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"prototype":{"polluted":true},' +
  '"items":[{"id":"item-a","type":"shelf","left":25,"top":50,"__proto__":{"polluted":true,"locked":true},' +
  '"constructor":{"prototype":{"polluted":true}}}],"wallGuides":[{"axis":"x","cm":100,"__proto__":{"polluted":true}}]}';

const toBase64Url = (text) => Buffer.from(text).toString('base64url');

// Anything a payload could have planted: the flag, an element, or an inline handler
const injectionState = (page) =>
  page.evaluate(() => ({
    flag: window.__xss,
    planted: document.querySelectorAll('img[src="x"], script:not([src]), [onerror]').length,
  }));

const pollutionState = (page) =>
  page.evaluate(() => ({
    objectClean: !('polluted' in {}),
    arrayClean: !('polluted' in []),
    protoIntact: wallItems.every((item) => Object.getPrototypeOf(item) === Object.prototype),
    ownProtoKeys: wallItems.some((item) => Object.hasOwn(item, '__proto__') || Object.hasOwn(item, 'constructor')),
    locked: wallItems.some((item) => item.locked),
  }));

const CLEAN = { objectClean: true, arrayClean: true, protoIntact: true, ownProtoKeys: false, locked: false };

// Resolves a module the way the entry imported it and runs a function against the live instance
async function withModule(page, file, run, arg) {
  const mod = await page.evaluateHandle((path) => import(new URL(path, document.baseURI).href), file);
  try {
    return await mod.evaluate(run, arg);
  } finally {
    await mod.dispose();
  }
}

// Sets a raw value past Playwright's own number checks, the way a script or a pasted value reaches a field
const forceValue = (page, selector, value) =>
  page.evaluate(
    ({ query, raw }) => {
      const input = document.querySelector(query);
      input.value = raw;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    },
    { query: selector, raw: value },
  );

const FUZZ = ['-999999', '1e50', 'NaN', '', '-0', 'Infinity', '999999999', '1e-7'];

async function watchCspViolations(page) {
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__cspViolations.push(`${e.violatedDirective} ${e.blockedURI}`);
    });
  });
  await page.reload();
}

const cspViolations = (page) => page.evaluate(() => window.__cspViolations);

test.describe('content security policy', () => {
  test('a strict policy is declared before any script or stylesheet loads', async ({ page }) => {
    const head = await page.evaluate(() => {
      const children = [...document.head.children];
      const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
      return {
        content: meta?.getAttribute('content'),
        beforeStyles: children.indexOf(meta) < children.indexOf(document.querySelector('link[rel="stylesheet"]')),
        beforeScript: children.indexOf(meta) < children.indexOf(document.querySelector('script[type="module"]')),
      };
    });
    expect(head).toEqual({ content: CSP, beforeStyles: true, beforeScript: true });
  });

  test('prints, PNG export, 3D preview, dialogs and the project form run without a single violation', async ({ page }) => {
    await watchCspViolations(page);
    await loadLayout(page, {
      items: [
        wallItem('item-a', 'poster', 0, 0, { posterArt: 'noir' }),
        wallItem('item-b', 'poster', 150, 0, { posterArt: 'bauhaus' }),
        wallItem('item-c', 'poster', 300, 0, { posterArt: 'botanical' }),
        wallItem('item-d', 'poster', 450, 0, { posterArt: 'horizon' }),
        wallItem('item-e', 'shelf', 0, 400, { itemLedColor: '#22d3ee' }),
        wallItem('item-f', 'note', 400, 400, { text: 'Check the stud line' }),
      ],
    });

    const png = await downloadFrom(page, '#export-png-btn');
    expect(png.name).toBe('spatial-studio-plan.png');

    await page.click('#preview-3d-btn');
    await page.click('#close-3d-btn');
    await page.click('#view-spec-btn');
    await downloadFrom(page, '#export-csv-btn');
    await page.click('#close-spec-btn');
    await page.click('#generate-quote-btn');
    await page.click('#close-quote-btn');

    // form-action 'none' would refuse a real submission; the planner handles the submit event itself
    await page.click('#projects-btn');
    await page.fill('#new-project-name', 'CSP check');
    await page.press('#new-project-name', 'Enter');
    await expect(page.locator('.project-card.is-current .project-name')).toHaveText('CSP check');
    await page.click('#close-projects-btn');

    expect(await cspViolations(page)).toEqual([]);
  });

  test.describe('with the splash screen', () => {
    test.use({ splash: true });

    test('the cursor-reactive splash animates and fades without a violation', async ({ page }) => {
      await watchCspViolations(page);
      const splash = page.locator('#splash-screen');
      await expect(splash).toBeVisible();
      await page.mouse.move(200, 200);
      await page.mouse.move(900, 600, { steps: 6 });
      await page.click('#enter-studio-btn');
      await expect(splash).toBeHidden();
      expect(await cspViolations(page)).toEqual([]);
    });
  });
});

test.describe('markup injection', () => {
  test('markup in imported item names and note text renders as plain text everywhere', async ({ page }) => {
    await loadLayout(page, {
      items: [
        wallItem('item-a', 'shelf', 0, 0, { name: IMG_PAYLOAD }),
        wallItem('item-b', 'poster', 300, 0, { name: SCRIPT_PAYLOAD }),
        wallItem('item-n', 'note', 0, 300, { width: 250, height: 125, text: `${IMG_PAYLOAD} ${SCRIPT_PAYLOAD}` }),
      ],
    });

    await expect(itemLocator(page, 'item-a').locator('.item-label')).toHaveText(IMG_PAYLOAD);
    await expect(itemLocator(page, 'item-b').locator('.item-label')).toHaveText(SCRIPT_PAYLOAD);
    await expect(itemLocator(page, 'item-n').locator('.item-label')).toHaveText(`${IMG_PAYLOAD} ${SCRIPT_PAYLOAD}`);
    await expect(page.locator('.layer-row[data-item-id="item-a"] .layer-text')).toHaveText(IMG_PAYLOAD);

    await selectItemById(page, 'item-a');
    await expect(page.locator('.selected-item-title')).toHaveText(IMG_PAYLOAD);

    await page.click('#view-spec-btn');
    await expect(page.locator('#bom-body')).toContainText(IMG_PAYLOAD);
    await expect(page.locator('#mounting-body')).toContainText(SCRIPT_PAYLOAD);
    await page.click('#close-spec-btn');

    await page.click('#generate-quote-btn');
    await expect(page.locator('#quote-body')).toContainText(SCRIPT_PAYLOAD);
    await page.click('#close-quote-btn');

    expect(await injectionState(page)).toEqual({ flag: undefined, planted: 0 });
  });

  test('typed client names, promo codes, project names, notes and palette queries stay text', async ({ page }) => {
    await loadLayout(page, {
      items: [
        wallItem('item-a', 'shelf', 0, 0),
        wallItem('item-n', 'note', 0, 300, { width: 250, height: 125, text: 'Plain note' }),
      ],
    });

    await page.click('#generate-quote-btn');
    await page.fill('#quote-client-input', IMG_PAYLOAD);
    await expect(page.locator('#quote-client-display')).toHaveText(IMG_PAYLOAD);
    await page.fill('#quote-client-input', SCRIPT_PAYLOAD);
    await expect(page.locator('#quote-client-display')).toHaveText(SCRIPT_PAYLOAD);
    await page.fill('#quote-promo-input', SCRIPT_PAYLOAD);
    await page.press('#quote-promo-input', 'Enter');
    await expect(page.locator('#quote-promo-status')).toHaveText('Invalid promo code.');
    await page.click('#close-quote-btn');

    await page.click('#projects-btn');
    await page.fill('#new-project-name', IMG_PAYLOAD);
    await page.press('#new-project-name', 'Enter');
    await expect(page.locator('.project-card.is-current .project-name')).toHaveText(IMG_PAYLOAD);
    await expect(page.locator('.project-card.is-current [data-action="rename"]')).toHaveAttribute(
      'aria-label',
      `Rename ${IMG_PAYLOAD}`,
    );
    await page.click('#close-projects-btn');

    const noteLabel = itemLocator(page, 'item-n').locator('.item-label');
    await selectItemById(page, 'item-n');
    await page.fill('#note-text', SCRIPT_PAYLOAD);
    await page.locator('#note-text').blur();
    await expect(noteLabel).toHaveText(SCRIPT_PAYLOAD);

    await page.dblclick('.wall-item[data-id="item-n"]');
    await expect(page.locator('.note-editor')).toBeFocused();
    await page.keyboard.type(IMG_PAYLOAD);
    await page.keyboard.press('Escape');
    await expect(noteLabel).toHaveText(IMG_PAYLOAD);

    await page.click('#command-palette-btn');
    await page.fill('#command-search-input', IMG_PAYLOAD);
    await expect(page.locator('#command-empty')).toHaveText(`No commands match "${IMG_PAYLOAD}"`);
    await page.keyboard.press('Escape');

    expect(await injectionState(page)).toEqual({ flag: undefined, planted: 0 });
  });
});

test.describe('prototype pollution', () => {
  test('a layout carrying __proto__, constructor and prototype keys pollutes nothing on import', async ({ page }) => {
    const layout = await page.evaluate((text) => {
      const result = importLayoutText(text);
      return { count: result.items.length, guides: wallGuides.length };
    }, POLLUTED);
    expect(layout).toEqual({ count: 1, guides: 1 });
    expect(await pollutionState(page)).toEqual(CLEAN);

    const status = await importFile(page, 'polluted.json', POLLUTED);
    await expect(status).toHaveText('Imported 1 item.');
    expect(await pollutionState(page)).toEqual(CLEAN);

    const saved = await page.evaluate(() => Object.keys(localStorage).map((key) => localStorage.getItem(key)).join(''));
    expect(saved).not.toContain('__proto__');
    expect(saved).not.toContain('polluted');
  });

  test('share links and saved projects drop prototype keys before the sanitizer runs', async ({ page }) => {
    await page.goto('about:blank');
    await page.goto(`/#plan=${toBase64Url(POLLUTED)}`);
    await expect(page.locator('#io-status')).toHaveText(/Opened the shared plan/);
    expect(await page.evaluate(() => wallItems.map((item) => item.id))).toEqual(['item-a']);
    expect(await pollutionState(page)).toEqual(CLEAN);

    await page.evaluate((layout) => {
      localStorage.clear();
      localStorage.setItem(
        'spatial_studio_projects_v1',
        '{"__proto__":{"polluted":true},"activeId":"project-x","projects":[{"id":"project-x","name":"Saved",' +
          '"timestamp":1,"__proto__":{"polluted":true}}]}',
      );
      localStorage.setItem('spatial_studio_project_v1_project-x', layout);
    }, POLLUTED);
    await page.reload();
    expect(await page.evaluate(() => [projects.length, projects[0].name, wallItems.map((item) => item.id)])).toEqual([
      1,
      'Saved',
      ['item-a'],
    ]);
    expect(await pollutionState(page)).toEqual(CLEAN);
  });

  test('safeJsonParse strips prototype keys and refuses oversized, deep or non-text input', async ({ page }) => {
    const result = await withModule(page, 'scripts/core/state.js', (mod) => {
      const parsed = mod.safeJsonParse('{"a":{"__proto__":{"x":1},"b":[1,{"constructor":2}]},"prototype":3}');
      const attempt = (text, options) => {
        try {
          mod.safeJsonParse(text, options);
          return 'ok';
        } catch (err) {
          return err.name;
        }
      };
      return {
        parsed: JSON.stringify(parsed),
        ownProto: Object.hasOwn(parsed.a, '__proto__'),
        deep: attempt('['.repeat(17) + ']'.repeat(17)),
        limit: attempt('['.repeat(16) + ']'.repeat(16)),
        bracketsInStrings: attempt(JSON.stringify({ text: '[{'.repeat(40), quote: '\\"[[[[' })),
        large: attempt(`"${'x'.repeat(64)}"`, { maxChars: 32 }),
        notText: attempt(42),
        broken: attempt('{"a":'),
      };
    });
    expect(result).toEqual({
      parsed: '{"a":{"b":[1,{}]}}',
      ownProto: false,
      deep: 'RangeError',
      limit: 'ok',
      bracketsInStrings: 'ok',
      large: 'RangeError',
      notText: 'TypeError',
      broken: 'SyntaxError',
    });

    const status = await importFile(page, 'deep.json', `{"items":${'['.repeat(40)}${']'.repeat(40)}}`);
    await expect(status).toHaveText('Import failed: That file is too large or too deeply nested.');
    expect(await page.evaluate(() => wallItems.length)).toBe(2);
  });
});

test.describe('extreme input', () => {
  test('wall size fields clamp NaN, Infinity, -0, exponents and huge values to the wall limits', async ({ page }) => {
    const seen = [];
    for (const value of FUZZ) {
      await forceValue(page, '#wall-width-input', value);
      await forceValue(page, '#wall-height-input', value);
      const wall = await wallState(page);
      expect(wall.cssWidth).toBe(`${wall.widthCm * 2.5}px`);
      expect(wall.cssHeight).toBe(`${wall.heightCm * 2.5}px`);
      expect([wall.widthInput, wall.heightInput]).toEqual([String(wall.widthCm), String(wall.heightCm)]);
      seen.push([wall.widthCm, wall.heightCm]);
    }
    // Empty and non-numeric text keep the current size; 1e50 reads as a huge number, not as 1
    expect(seen).toEqual([
      [150, 150], [400, 300], [400, 300], [400, 300], [150, 150], [150, 150], [400, 300], [150, 150],
    ]);
  });

  test('attic slope fields stay within 30-150 cm whatever is typed', async ({ page }) => {
    await page.evaluate(() => atticSlopeToggle.click());
    const seen = [];
    for (const value of FUZZ) {
      await forceValue(page, '#attic-width-input', value);
      await forceValue(page, '#attic-height-input', value);
      const { atticWidthCm, atticHeightCm } = await page.evaluate(() => layoutPayload());
      seen.push([atticWidthCm, atticHeightCm]);
    }
    expect(seen).toEqual([
      [30, 30], [150, 150], [150, 150], [150, 150], [30, 30], [30, 30], [150, 150], [30, 30],
    ]);
  });

  test('item position, size and depth fields keep every piece finite, whole-cm and on the wall', async ({ page }) => {
    await loadLayout(page, { items: [wallItem('item-a', 'shelf', 100, 100, { width: 100, height: 50 })] });
    await selectItemById(page, 'item-a');
    const wholeCm = (px) => Math.abs(px / 2.5 - Math.round(px / 2.5)) < 1e-9;

    for (const field of ['#edit-left-cm', '#edit-top-cm', '#edit-width-cm', '#edit-height-cm', '#edit-depth-cm']) {
      for (const value of FUZZ) {
        await forceValue(page, field, value);
        const item = await getItem(page, 'item-a');
        const geometry = [item.left, item.top, item.width, item.height];
        expect(geometry.every(Number.isFinite), `${field} = ${value}`).toBe(true);
        expect(geometry.every(wholeCm), `${field} = ${value}`).toBe(true);
        expect(item.left >= 0 && item.left + item.width <= 750, `${field} = ${value}`).toBe(true);
        expect(item.top >= 0 && item.top + item.height <= 625, `${field} = ${value}`).toBe(true);
        expect(Number.isInteger(item.depth) && item.depth >= 2 && item.depth <= 60, `${field} = ${value}`).toBe(true);
        await expect(itemLocator(page, 'item-a')).toHaveCSS('width', `${item.width}px`);
      }
    }
  });

  test('brightness and orbit sliders never pass NaN or out-of-range values on', async ({ page }) => {
    for (const value of FUZZ) {
      await forceValue(page, '#brightness-slider', value);
      const { text, opacity } = await page.evaluate(() => ({
        text: document.getElementById('brightness-value').textContent,
        opacity: Number(getComputedStyle(document.documentElement).getPropertyValue('--led-opacity')),
      }));
      expect(text).toMatch(/^(\d|[1-9]\d|100)%$/);
      expect(opacity >= 0 && opacity <= 1).toBe(true);
    }

    await page.click('#preview-3d-btn');
    for (const value of FUZZ) {
      await forceValue(page, '#orbit-yaw-slider', value);
      await forceValue(page, '#orbit-pitch-slider', value);
      const [yaw, pitch] = await page.evaluate(() =>
        ['orbit-yaw-value', 'orbit-pitch-value'].map((id) => Number.parseInt(document.getElementById(id).textContent, 10)),
      );
      expect(yaw >= -60 && yaw <= 60 && pitch >= 10 && pitch <= 45, `orbit = ${value}`).toBe(true);
    }
    await page.click('#close-3d-btn');
  });

  test('malformed, hostile and oversized #plan= links are refused without touching the saved wall', async ({ page }) => {
    await loadLayout(page, { items: [wallItem('item-mine', 'shelf', 40, 40)] });
    const hashes = [
      '#plan=%%%',
      `#plan=${toBase64Url('null')}`,
      `#plan=${toBase64Url('[]')}`,
      `#plan=${toBase64Url('{"items":"nope"}')}`,
      `#plan=${toBase64Url('{"items":[{"type":"__proto__"},{"type":"constructor"}]}')}`,
      `#plan=${toBase64Url(`{"items":${'['.repeat(5000)}${']'.repeat(5000)}}`)}`,
      `#plan=${'A'.repeat(130 * 1024)}`,
    ];
    for (const hash of hashes) {
      await page.goto('about:blank');
      await page.goto(`/${hash}`);
      await expect(page.locator('#io-status')).toHaveText('Share link could not be read.');
      expect(await page.evaluate(() => wallItems.map((item) => item.id))).toEqual(['item-mine']);
      expect(new URL(page.url()).hash).toBe('');
    }
  });

  test('a wall too large for the share-link ceiling is never handed out as a link', async ({ page }) => {
    // 200 notes of euro signs encode to well over 128K Base64URL characters
    const items = Array.from({ length: 200 }, (_, i) =>
      wallItem(`item-${i}`, 'note', (i % 20) * 25, Math.floor(i / 20) * 50, { text: '\u20ac'.repeat(160) }),
    );
    await loadLayout(page, { items });
    await page.click('#projects-btn');
    await page.click('#copy-share-link-btn');
    await expect(page.locator('#copy-share-link-btn')).toHaveText('Too large');
    await expect(page.locator('#io-status')).toHaveText(
      'This wall is too large for a share link. Export it as JSON instead.',
    );
    await page.click('#close-projects-btn');
  });
});

test.describe('console bridge and canvas guards', () => {
  test('crafted ids, wrong types and overwrite attempts cannot break the running app', async ({ page }) => {
    await loadLayout(page, { items: [wallItem('item-a', 'shelf', 100, 100)] });
    const result = await page.evaluate(() => {
      const attempt = (run) => {
        try {
          run();
        } catch {
          // Strict callers get a TypeError; the binding must hold either way
        }
      };
      const crafted = ['"]', "'][data-x='", 'a"], *, [b="', '\\', '\n', '<img>', 42, {}];
      const lookups = crafted.map((id) => getItemElement(id));
      crafted.forEach((id) => selectItem(id));
      setSelection(null);
      setSelection('item-a');
      attempt(() => { window.wallItems = null; });
      attempt(() => { window.importLayoutText = null; });
      attempt(() => { window.exportPng = null; });
      attempt(() => { delete window.wallItems; });
      attempt(() => { delete window.selectedItemIds; });
      attempt(() => Object.defineProperty(window, 'wallItems', { value: [] }));
      return {
        lookups: lookups.every((el) => el === null),
        selection: selectedItemIds.length,
        count: wallItems.length,
        importable: typeof importLayoutText === 'function',
        configurable: ['wallItems', 'selectedItemIds', 'importLayoutText', 'clipboardState', 'buildSceneObj'].map(
          (name) => Object.getOwnPropertyDescriptor(window, name).configurable,
        ),
      };
    });
    expect(result).toEqual({
      lookups: true,
      selection: 0,
      count: 1,
      importable: true,
      configurable: [false, false, false, false, false],
    });

    // The app never read those globals, so mounting and exporting carry on as before
    await page.click('.catalog-item[data-type="cube"]');
    expect(await page.evaluate(() => wallItems.length)).toBe(2);
    expect((await downloadFrom(page, '#export-png-btn')).name).toBe('spatial-studio-plan.png');

    // Clipboard writes go through the import sanitizer, and anything that is not a clipboard is ignored
    const clipboard = await page.evaluate(() => {
      clipboardState = { items: [{ type: 'shelf', left: 'x', name: '<b>ok</b>' }, { type: 'evil' }, null, 7] };
      const accepted = clipboardState.items.map((item) => [item.type, item.left, item.name]);
      clipboardState = null;
      clipboardState = 'nope';
      return { accepted, kept: clipboardState.items.length };
    });
    expect(clipboard).toEqual({ accepted: [['shelf', 0, '<b>ok</b>']], kept: 1 });
  });

  test('programmatic setters ignore NaN, prototype keys and malformed colors', async ({ page }) => {
    const accent = () => page.evaluate(() => document.documentElement.style.getPropertyValue('--accent-led'));
    const before = await accent();

    await withModule(page, 'scripts/ui/viewport-rulers.js', (mod) => {
      mod.zoomTo(NaN);
      mod.zoomTo(1.5, NaN, Infinity);
      mod.resetView();
      mod.setBrightness('NaN');
      mod.setBrightness(1e50);
      mod.updateAccentColor('red; background: url(x)');
      mod.updateCornerColor('#12');
      mod.setFloorBackdrop('__proto__');
      mod.setFloorBackdrop('constructor');
      mod.applyWallPaint('__proto__');
      mod.setWallDimensions(NaN, 1e100);
    });
    await withModule(page, 'scripts/io/projects-spec.js', (mod) => {
      mod.loadTemplate('__proto__');
      mod.loadTemplate('toString');
    });

    expect(await accent()).toBe(before);
    expect(await page.evaluate(() => ({
      zoom: userZoom,
      pan: [panX, panY],
      finiteTransform: !/NaN|Infinity/.test(wallCanvas.style.transform),
      brightness: brightnessSlider.value,
      backdropHidden: document.getElementById('floor-backdrop').hidden,
      paint: wallPaint,
    }))).toEqual({ zoom: 1, pan: [0, 0], finiteTransform: true, brightness: '100', backdropHidden: true, paint: 'charcoal' });
    // NaN keeps the current width and 1e100 clamps to the tallest wall
    const wall = await wallState(page);
    expect([wall.widthCm, wall.heightCm, wall.cssHeight]).toEqual([300, 300, '750px']);
  });

  test('buildSceneObj writes only single-token names and finite numbers', async ({ page }) => {
    const obj = await page.evaluate(() =>
      buildSceneObj({
        wallWidthCm: NaN,
        wallHeightCm: 'x',
        items: [
          { id: 'item-a\nv 9 9 9', type: 'shelf\nf 1 2 3', left: NaN, top: 0, width: 25, height: Infinity, depth: Infinity },
          null,
        ],
      }),
    );
    const lines = obj.trimEnd().split('\n');
    expect(lines.filter((line) => line.startsWith('o '))).toEqual(['o Wall', 'o Item_item-a_v_9_9_9_shelf_f_1_2_3']);
    expect(obj).not.toMatch(/NaN|Infinity/);
    const number = '-?\\d+(\\.\\d+)?';
    const valid = new RegExp(`^(# .*|o [\\w-]+|v ${number} ${number} ${number}|f \\d+ \\d+ \\d+ \\d+)$`);
    expect(lines.filter((line) => !valid.test(line))).toEqual([]);
  });

  test('tampered canvas sizes are capped before anything is painted', async ({ page }) => {
    await page.click('#preview-3d-btn');
    const preview = await page.evaluate(() => {
      const canvas = document.getElementById('preview-3d-canvas');
      canvas.width = 5000;
      document.getElementById('orbit-yaw-slider').dispatchEvent(new Event('input'));
      return [canvas.width, canvas.height];
    });
    expect(preview).toEqual([760, 460]);
    await page.click('#close-3d-btn');

    // A tampered wall width from DevTools would ask for a 6000 px PNG; the exporter caps it at 4096
    await withModule(page, 'scripts/core/state.js', (mod) => { mod.state.wallWidthPx = 3000; });
    const { buffer } = await downloadFrom(page, '#export-png-btn');
    await withModule(page, 'scripts/core/state.js', (mod) => { mod.state.wallWidthPx = mod.state.wallWidthCm * 2.5; });
    expect(pngInfo(buffer)).toMatchObject({ width: 4096, height: 1250 });
  });
});

test.describe('CSV formula injection', () => {
  test('formula triggers in item names get a leading apostrophe in the exported CSV', async ({ page }) => {
    await loadLayout(page, {
      items: [
        wallItem('item-a', 'shelf', 0, 0, { name: FORMULA }),
        wallItem('item-b', 'cube', 400, 0, { name: '@SUM(A1:A9)' }),
        wallItem('item-c', 'poster', 0, 200, { name: '+cmd|calc' }),
        wallItem('item-d', 'storage', 300, 300, { name: '-2+3' }),
      ],
    });
    // Project names never reach the CSV, but a formula-named project must not change that
    await page.click('#projects-btn');
    await page.fill('#new-project-name', FORMULA);
    await page.press('#new-project-name', 'Enter');
    await page.click('#close-projects-btn');

    await page.click('#view-spec-btn');
    const { name, buffer } = await downloadFrom(page, '#export-csv-btn');
    const text = buffer.toString('utf8');
    expect(name).toBe('spatial-studio-specs.csv');

    // Once in the bill of materials and once in the drilling table, quoted per RFC 4180
    expect(text.split(`"'=HYPERLINK(""http://evil"")"`).length - 1).toBe(2);
    for (const defused of [`'@SUM(A1:A9)`, `'+cmd|calc`, `'-2+3`]) {
      expect(text.split(`\r\n${defused},`).length - 1, defused).toBe(2);
    }
    const fieldStarts = text.split(/\r\n|,/).map((field) => field.replace(/^\ufeff?"?/, ''));
    expect(fieldStarts.filter((field) => /^[=+@-]/.test(field))).toEqual([]);

    expect(await page.evaluate((value) => csvField(value), FORMULA)).toBe(`"'=HYPERLINK(""http://evil"")"`);
  });
});
