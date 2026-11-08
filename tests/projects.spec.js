import { test, expect } from './support/fixtures.js';
import {
  getItems,
  historyState,
  isModalWithFocus,
  loadLayout,
  selectedIds,
  selectItemById,
  wallItem,
  wallState,
} from './support/planner.js';

const INDEX_KEY = 'spatial_studio_projects_v1';
const LAYOUT_PREFIX = 'spatial_studio_project_v1_';
const LEGACY_KEY = 'spatial_studio_state_v1';
const SUBTITLE_TAIL = 'Changes save to the open project automatically.';

const storage = (page) =>
  page.evaluate(
    ({ indexKey, prefix, legacyKey }) => {
      const keys = Object.keys(localStorage);
      const layouts = {};
      keys
        .filter((key) => key.startsWith(prefix))
        .forEach((key) => {
          try {
            layouts[key.slice(prefix.length)] = JSON.parse(localStorage.getItem(key));
          } catch {
            layouts[key.slice(prefix.length)] = 'unreadable';
          }
        });
      return { index: JSON.parse(localStorage.getItem(indexKey)), layouts, legacy: localStorage.getItem(legacyKey) };
    },
    { indexKey: INDEX_KEY, prefix: LAYOUT_PREFIX, legacyKey: LEGACY_KEY },
  );

// Seeds storage as a returning visitor would have left it, then boots the planner on top of it.
// Strings are stored as they are, so tests can plant broken JSON.
async function bootWith(page, entries) {
  await page.evaluate((pairs) => {
    localStorage.clear();
    Object.entries(pairs).forEach(([key, value]) =>
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value)),
    );
  }, entries);
  await page.reload();
}

const itemIds = async (page) => (await getItems(page)).map((item) => item.id);

const cards = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('#project-list .project-card')].map((card) => ({
      name: card.querySelector('.project-name')?.textContent ?? null,
      current: card.classList.contains('is-current'),
      meta: card.querySelector('.project-meta').textContent,
    })),
  );

const projectCard = (page, name) =>
  page.locator('.project-card').filter({ has: page.locator('.project-name').getByText(name, { exact: true }) });

const cardButton = (page, name, action) => projectCard(page, name).locator(`[data-action="${action}"]`);

async function openGallery(page) {
  await page.click('#projects-btn');
  await expect(page.locator('#projects-modal')).toBeVisible();
}

async function saveAs(page, name) {
  await page.fill('#new-project-name', name);
  await page.click('#save-project-btn');
}

test.describe('project gallery', () => {
  test('a first visit opens a Default Project that every edit autosaves into', async ({ page }) => {
    const first = await storage(page);
    expect(first.index.projects).toHaveLength(1);
    const [project] = first.index.projects;
    expect(project.name).toBe('Default Project');
    expect(project.id).toMatch(/^project-[a-z0-9-]+$/);
    expect(first.index.activeId).toBe(project.id);
    expect(Object.keys(first.layouts)).toEqual([project.id]);
    expect(first.layouts[project.id].items.map((item) => item.id)).toEqual(['item-1', 'item-2']);
    expect(first.legacy).toBeNull();

    await expect(page.locator('#projects-btn')).toHaveText('Projects');
    await expect(page.locator('#projects-btn')).toHaveAttribute('title', 'My Projects (open: Default Project)');

    await page.click('.catalog-item[data-name="Modular Cube"]');
    await page.locator('#brightness-slider').fill('40');

    const saved = await storage(page);
    expect(saved.layouts[project.id].items).toHaveLength(3);
    expect(Number(saved.layouts[project.id].brightness)).toBe(40);
    expect(saved.index.projects[0].timestamp).toBeGreaterThanOrEqual(project.timestamp);
  });

  test('an old single save moves into Default Project once, and later leftovers are dropped', async ({ page }) => {
    await bootWith(page, {
      [LEGACY_KEY]: {
        items: [wallItem('item-old', 'shelf', 40, 40)],
        wallWidthCm: 320,
        wallHeightCm: 260,
        accentColor: '#22d3ee',
      },
    });

    expect(await itemIds(page)).toEqual(['item-old']);
    expect(await wallState(page)).toMatchObject({ widthCm: 320, heightCm: 260 });
    await expect(page.locator('#accent-color-picker')).toHaveValue('#22d3ee');
    let saved = await storage(page);
    expect(saved.legacy).toBeNull();
    expect(saved.index.projects.map((project) => project.name)).toEqual(['Default Project']);
    expect(saved.layouts[saved.index.activeId].items[0].id).toBe('item-old');

    // Once the gallery exists, a stray single save must not replace the open project
    await page.evaluate(
      (key) => localStorage.setItem(key, JSON.stringify({ items: [{ id: 'item-stray', type: 'cube' }] })),
      LEGACY_KEY,
    );
    await page.reload();
    expect(await itemIds(page)).toEqual(['item-old']);
    saved = await storage(page);
    expect(saved.legacy).toBeNull();
    expect(saved.index.projects).toHaveLength(1);

    await bootWith(page, { [LEGACY_KEY]: '{bad json' });
    expect(await itemIds(page)).toEqual(['item-1', 'item-2']);
    saved = await storage(page);
    expect(saved.legacy).toBeNull();
    expect(saved.index.projects.map((project) => project.name)).toEqual(['Default Project']);
  });

  test('Save as New Project forks the wall, and Load switches saves with a fresh history', async ({ page }) => {
    await selectItemById(page, 'item-1');
    await openGallery(page);
    expect(await isModalWithFocus(page, '#projects-modal')).toBe(true);
    await expect(page.locator('#new-project-name')).toBeFocused();
    await expect(page.locator('#projects-subtitle')).toHaveText(`1 saved project. ${SUBTITLE_TAIL}`);

    await page.fill('#new-project-name', 'Living room');
    await page.press('#new-project-name', 'Enter');

    expect(await cards(page)).toMatchObject([
      { name: 'Living room', current: true },
      { name: 'Default Project', current: false },
    ]);
    await expect(projectCard(page, 'Living room').locator('.project-badge')).toHaveText('Open');
    await expect(cardButton(page, 'Living room', 'load')).toBeDisabled();
    await expect(page.locator('#new-project-name')).toHaveValue('');
    await expect(page.locator('#io-status')).toHaveText('Saved as Living room.');
    await expect(page.locator('#projects-subtitle')).toHaveText(`2 saved projects. ${SUBTITLE_TAIL}`);
    // Keys typed in the dialog stay in the dialog: Delete keeps the selected item, ? opens nothing else
    await page.keyboard.press('Delete');
    await page.keyboard.type('?');
    expect(await itemIds(page)).toEqual(['item-1', 'item-2']);
    await expect(page.locator('#shortcuts-modal')).toBeHidden();
    await page.click('#close-projects-btn');

    await loadLayout(page, {
      wallWidthCm: 360,
      items: [wallItem('item-tv', 'cube', 100, 100), wallItem('item-plug', 'socket', 300, 300)],
    });
    await openGallery(page);
    expect(await cards(page)).toMatchObject([
      { name: 'Living room', meta: expect.stringMatching(/^Edited .+ \| 2 items \| 360 x 250 cm$/) },
      { name: 'Default Project', meta: expect.stringMatching(/ \| 2 items \| 300 x 250 cm$/) },
    ]);
    await expect(projectCard(page, 'Living room').locator('svg.project-thumb rect')).toHaveCount(3);

    await cardButton(page, 'Default Project', 'load').click();

    await expect(page.locator('#projects-modal')).toBeHidden();
    expect(await itemIds(page)).toEqual(['item-1', 'item-2']);
    expect((await wallState(page)).widthCm).toBe(300);
    expect(await selectedIds(page)).toEqual([]);
    expect(await historyState(page)).toEqual({ index: 0, length: 1, undoDisabled: true, redoDisabled: true });
    await expect(page.locator('#io-status')).toHaveText('Opened Default Project.');
    await expect(page.locator('#projects-btn')).toHaveAttribute('title', 'My Projects (open: Default Project)');

    await page.reload();
    expect(await itemIds(page)).toEqual(['item-1', 'item-2']);
    await openGallery(page);
    expect((await cards(page)).find((card) => card.current).name).toBe('Default Project');
    await cardButton(page, 'Living room', 'load').click();
    expect(await itemIds(page)).toEqual(['item-tv', 'item-plug']);
    expect((await wallState(page)).widthCm).toBe(360);
  });

  test('new names are tidied, numbered when blank, and shown as plain text', async ({ page }) => {
    await openGallery(page);
    await expect(page.locator('#new-project-name')).toHaveAttribute('maxlength', '60');

    await page.click('#save-project-btn');
    await saveAs(page, '   Kitchen    north   wall  ');
    await saveAs(page, '<b>Bold</b> & co');
    await page.evaluate(() => {
      newProjectName.value = 'x'.repeat(80);
    });
    await page.click('#save-project-btn');

    const names = (await cards(page)).map((card) => card.name);
    expect(names).toEqual(['x'.repeat(60), '<b>Bold</b> & co', 'Kitchen north wall', 'Project 2', 'Default Project']);
    await expect(page.locator('.project-name b')).toHaveCount(0);
    expect((await storage(page)).index.projects.map((project) => project.name)).toContain('<b>Bold</b> & co');
  });

  test('Rename edits in place: Enter saves, Escape cancels without closing, a click away saves', async ({ page }) => {
    await openGallery(page);
    await cardButton(page, 'Default Project', 'rename').click();
    const field = page.locator('.project-rename');
    await expect(field).toBeFocused();
    await expect(field).toHaveValue('Default Project');

    // The old name starts selected, so typing replaces it
    await page.keyboard.type('Bedroom');
    await page.keyboard.press('Enter');

    await expect(field).toHaveCount(0);
    expect((await cards(page)).map((card) => card.name)).toEqual(['Bedroom']);
    expect((await storage(page)).index.projects[0].name).toBe('Bedroom');
    await expect(cardButton(page, 'Bedroom', 'rename')).toBeFocused();
    await expect(cardButton(page, 'Bedroom', 'rename')).toHaveAttribute('aria-label', 'Rename Bedroom');
    await expect(page.locator('#projects-btn')).toHaveAttribute('title', 'My Projects (open: Bedroom)');

    await page.keyboard.press('Enter');
    await expect(field).toBeFocused();
    await page.keyboard.type('Nope');
    await page.keyboard.press('Escape');
    await expect(field).toHaveCount(0);
    await expect(page.locator('#projects-modal')).toBeVisible();
    expect((await cards(page)).map((card) => card.name)).toEqual(['Bedroom']);
    await expect(cardButton(page, 'Bedroom', 'rename')).toBeFocused();

    await page.keyboard.press('Enter');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Enter');
    expect((await cards(page)).map((card) => card.name)).toEqual(['Bedroom']);

    // Ending a rename by pressing another card button must not swallow that press
    await saveAs(page, 'Spare');
    const bedroomId = (await storage(page)).index.projects.find((project) => project.name === 'Bedroom').id;
    // While the field is open the card has no name label, so it is found by id
    const bedroom = page.locator(`.project-card[data-project-id="${bedroomId}"]`);
    await bedroom.locator('[data-action="rename"]').click();
    await page.keyboard.type('Guest room');
    await bedroom.locator('[data-action="load"]').click();

    await expect(page.locator('#projects-modal')).toBeHidden();
    await expect(page.locator('#io-status')).toHaveText('Opened Guest room.');
    await expect(page.locator('#projects-btn')).toHaveAttribute('title', 'My Projects (open: Guest room)');

    await openGallery(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('#projects-modal')).toBeHidden();
  });

  test('Delete takes a second press, never removes the open project, and frees its storage', async ({ page }) => {
    await openGallery(page);
    const defaultId = (await storage(page)).index.activeId;
    await saveAs(page, 'Second');

    await expect(cardButton(page, 'Second', 'delete')).toBeDisabled();
    await expect(cardButton(page, 'Second', 'delete')).toHaveAttribute('title', 'The open project cannot be deleted');

    const remove = cardButton(page, 'Default Project', 'delete');
    await remove.click();
    await expect(remove).toHaveText('Confirm');
    await expect(remove).toContainClass('is-armed');
    await expect(remove).toHaveAttribute('aria-label', 'Confirm deleting Default Project');
    expect(await cards(page)).toHaveLength(2);

    // Left alone, the armed button calms down again
    await expect(remove).toHaveText('Delete', { timeout: 4500 });
    await expect(remove).not.toContainClass('is-armed');

    await remove.click();
    await remove.click();

    expect((await cards(page)).map((card) => card.name)).toEqual(['Second']);
    await expect(page.locator('#new-project-name')).toBeFocused();
    await expect(page.locator('#projects-subtitle')).toHaveText(`1 saved project. ${SUBTITLE_TAIL}`);
    const saved = await storage(page);
    expect(saved.index.projects.map((project) => project.name)).toEqual(['Second']);
    expect(Object.keys(saved.layouts)).toEqual([saved.index.activeId]);
    expect(saved.layouts[defaultId]).toBeUndefined();
  });

  test('a damaged index or layout falls back without losing the readable projects', async ({ page }) => {
    await bootWith(page, { [INDEX_KEY]: '{nope' });
    expect(await itemIds(page)).toEqual(['item-1', 'item-2']);
    expect((await storage(page)).index.projects.map((project) => project.name)).toEqual(['Default Project']);

    await bootWith(page, {
      [INDEX_KEY]: {
        activeId: 'project-gone',
        projects: [
          { id: 'project-old', name: 'Old', timestamp: 1000 },
          { id: 'project-new', name: '  New   wall ', timestamp: 2000 },
          { id: 'project-new', name: 'Duplicate', timestamp: 3000 },
          { id: '../escape', name: 'Bad id', timestamp: 4000 },
          { id: 'project-blank', name: '', timestamp: 500 },
          null,
        ],
      },
      [`${LAYOUT_PREFIX}project-new`]: '{broken',
      [`${LAYOUT_PREFIX}project-old`]: { items: [{ id: 'item-o', type: 'cube', left: 0, top: 0 }] },
    });

    // The active id is gone, so the most recently edited project opens; its layout is unreadable
    expect(await itemIds(page)).toEqual(['item-1', 'item-2']);
    await expect(page.locator('#projects-btn')).toHaveAttribute('title', 'My Projects (open: New wall)');

    await openGallery(page);
    expect(await cards(page)).toMatchObject([
      { name: 'New wall', current: true },
      { name: 'Old', meta: expect.stringMatching(/ \| 1 item \| 300 x 250 cm$/) },
      { name: 'Untitled Project', meta: expect.stringMatching(/ \| Unreadable layout$/) },
    ]);
    await expect(projectCard(page, 'Untitled Project').locator('.project-thumb')).toContainClass('is-empty');

    const saved = await storage(page);
    expect(saved.index.activeId).toBe('project-new');
    expect(saved.index.projects.map((project) => project.id)).toEqual(['project-old', 'project-new', 'project-blank']);
    expect(saved.layouts['project-new'].items.map((item) => item.id)).toEqual(['item-1', 'item-2']);

    await cardButton(page, 'Old', 'load').click();
    expect(await itemIds(page)).toEqual(['item-o']);
  });

  test('the gallery holds 24 projects at most', async ({ page }) => {
    const seeded = Array.from({ length: 30 }, (_, i) => ({
      id: `project-${i}`,
      name: `Wall ${i + 1}`,
      timestamp: 1000 + i,
    }));
    await bootWith(page, { [INDEX_KEY]: { activeId: 'project-0', projects: seeded } });

    await openGallery(page);
    expect(await cards(page)).toHaveLength(24);
    await expect(page.locator('#projects-subtitle')).toHaveText(`24 saved projects. ${SUBTITLE_TAIL}`);
    await expect(page.locator('#save-project-btn')).toBeDisabled();
    await expect(page.locator('#new-project-name')).toBeDisabled();
    await expect(page.locator('#project-limit-note')).toBeVisible();
    await expect(page.locator('#project-limit-note')).toHaveText(
      'That is the limit of 24 projects. Delete one to save another.',
    );

    await cardButton(page, 'Wall 24', 'delete').click();
    await cardButton(page, 'Wall 24', 'delete').click();

    expect(await cards(page)).toHaveLength(23);
    await expect(page.locator('#project-limit-note')).toBeHidden();
    await expect(page.locator('#save-project-btn')).toBeEnabled();
    await saveAs(page, 'One more');
    expect(await cards(page)).toHaveLength(24);
    await expect(page.locator('#save-project-btn')).toBeDisabled();
  });
});
