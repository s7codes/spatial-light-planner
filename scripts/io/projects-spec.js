import {
    COPY_LABEL, CSV_FILENAME, CSV_LABEL, csvRow, DEFAULT_WALL_HEIGHT_CM, DEFAULT_WALL_PAINT, DEFAULT_WALL_WIDTH_CM,
    defaultItems, escapeHtml, EXPORT_FILENAME, EXPORT_VERSION, finishLabel, formatMoney, fromBase64Url, isFeature,
    isQuarterTurn, LAYOUT_TEMPLATES, LEGACY_STORAGE_KEY, markdownCell, MAX_IMPORT_BYTES, MAX_PROJECTS,
    MAX_SHARE_CHARS, MOUNTING_NOTE, PROJECT_ID_PATTERN, PROJECT_INDEX_KEY, PROJECT_LAYOUT_PREFIX,
    PROJECT_NAME_LENGTH, SCALE, SHARE_HASH_PREFIX, SHARE_LABEL, toBase64Url, toCm, toFiniteNumber, wallPaintById
} from '../core/constants.js';
import {
    accentColorPicker, atticSlopeToggle, bomBody, bomFoot, brightnessSlider, closeProjectsBtn, closeShortcutsBtn,
    closeSpecBtn, commandPalette, copyMarkdownBtn, copyShareLinkBtn, cornerColorPicker, exportCsvBtn, exportJsonBtn,
    importFileInput, importJsonBtn, ioStatus, isModalOpen, mountingBody, newProjectForm, newProjectName,
    projectLimitNote, projectList, projectsBtn, projectsModal, projectsSubtitle, saveProjectBtn, shortcutsBtn,
    shortcutsModal, specModal, specNote, specSubtitle, templateButtons, viewSpecBtn
} from '../core/dom.js';
import {
    commitLayoutChange, createProjectId, isPointerBusy, normalizeLayout, pushHistory, state, storageGet,
    storageRemove, storageSet
} from '../core/state.js';
import {
    applyAtticSlope, applyWallPaint, renderGuides, setBrightness, setWallDimensions, updateAccentColor,
    updateCornerColor
} from '../ui/viewport-rulers.js';
import { renderPlanner, updateInspectorPanel } from '../ui/inspector-layers.js';

let ioStatusTimer = 0;
let copyLabelTimer = 0;
let csvLabelTimer = 0;
let activeProjectId = null;
let shareLabelTimer = 0;

const cloneDefaults = () => JSON.parse(JSON.stringify(defaultItems));

const currentLayoutData = () => ({
    items: state.wallItems,
    wallWidthCm: state.wallWidthCm,
    wallHeightCm: state.wallHeightCm,
    accentColor: accentColorPicker.value,
    cornerColor: cornerColorPicker.value,
    brightness: brightnessSlider.value,
    atticSlope: atticSlopeToggle.checked,
    wallPaint: state.wallPaint,
    wallGuides: state.wallGuides
});

const activeProject = () => state.projects.find(project => project.id === activeProjectId);

const cleanProjectName = (raw, fallback) => (typeof raw === 'string' && raw.trim()
    ? raw.trim().replace(/\s+/g, ' ').slice(0, PROJECT_NAME_LENGTH)
    : fallback);

const writeProjectIndex = () =>
    storageSet(PROJECT_INDEX_KEY, JSON.stringify({ activeId: activeProjectId, projects: state.projects }));

const writeProjectLayout = (id, layout = currentLayoutData()) =>
    storageSet(PROJECT_LAYOUT_PREFIX + id, JSON.stringify(layout));

function readProjectLayout(id) {
    try {
        return JSON.parse(storageGet(PROJECT_LAYOUT_PREFIX + id));
    } catch {
        return null;
    }
}

export function saveState() {
    const project = activeProject();
    if (!project) return;

    project.timestamp = Date.now();
    if (!writeProjectLayout(project.id) || !writeProjectIndex()) {
        showIoStatus('Could not save: browser storage is full or blocked.', 'error');
    }
}

function readProjectIndex() {
    let data;
    try {
        data = JSON.parse(storageGet(PROJECT_INDEX_KEY));
    } catch {
        return null;
    }
    if (!data || !Array.isArray(data.projects)) return null;

    const seen = new Set();
    const list = [];
    data.projects.forEach(entry => {
        if (!entry || !PROJECT_ID_PATTERN.test(entry.id) || seen.has(entry.id) || list.length >= MAX_PROJECTS) return;
        seen.add(entry.id);
        list.push({
            id: entry.id,
            name: cleanProjectName(entry.name, 'Untitled Project'),
            timestamp: toFiniteNumber(entry.timestamp) ?? Date.now()
        });
    });
    return { activeId: typeof data.activeId === 'string' ? data.activeId : null, projects: list };
}

// The first boot after the upgrade keeps the old single save as the Default Project. A later leftover
// under the legacy key, or one that no longer parses, is simply dropped.
function migrateLegacyState() {
    const raw = storageGet(LEGACY_STORAGE_KEY);
    if (raw === null) return;

    if (!state.projects.length) {
        try {
            normalizeLayout(JSON.parse(raw));
            const project = { id: createProjectId(), name: 'Default Project', timestamp: Date.now() };
            if (storageSet(PROJECT_LAYOUT_PREFIX + project.id, raw)) {
                state.projects.push(project);
                activeProjectId = project.id;
            }
        } catch {
            // A corrupt single save is discarded and the planner starts from the starter layout
        }
    }
    storageRemove(LEGACY_STORAGE_KEY);
}

// Returns the raw layout from a #plan= link, or null. The hash is cleared either way, so a reload or a
// bookmark of the cleaned address never applies the same link twice.
function takeSharedPlan() {
    if (!window.location.hash.startsWith(SHARE_HASH_PREFIX)) return null;
    const encoded = window.location.hash.slice(SHARE_HASH_PREFIX.length);
    try {
        history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch {
        // A sandboxed frame may refuse; the link is still read once
    }

    try {
        if (encoded.length > MAX_SHARE_CHARS) throw new Error('Too long.');
        const data = JSON.parse(fromBase64Url(encoded));
        normalizeLayout(data);
        return data;
    } catch {
        showIoStatus('Share link could not be read.', 'error');
        return null;
    }
}

function uniqueProjectName(base) {
    const names = new Set(state.projects.map(project => project.name));
    let name = base;
    for (let n = 2; names.has(name); n++) name = `${base} ${n}`;
    return name;
}

// Someone who already has projects gets the link as a new project, so following a link never
// overwrites their open work. A first visit just fills the fresh Default Project.
function addSharedProject() {
    if (state.projects.length >= MAX_PROJECTS) {
        showIoStatus(`The shared plan was not opened: the gallery already holds ${MAX_PROJECTS} projects.`, 'error');
        return null;
    }
    const project = { id: createProjectId(), name: uniqueProjectName('Shared Plan'), timestamp: Date.now() };
    state.projects.push(project);
    return project;
}

export function applyLayoutSettings(layout) {
    setWallDimensions(layout.wallWidthCm, layout.wallHeightCm);
    state.wallItems = layout.items;
    if (layout.atticSlope !== null) atticSlopeToggle.checked = layout.atticSlope;
    if (layout.accentColor) updateAccentColor(layout.accentColor, false);
    if (layout.cornerColor) updateCornerColor(layout.cornerColor, false);
    if (layout.brightness !== null) setBrightness(layout.brightness);
    applyWallPaint(layout.wallPaint);
    state.wallGuides = layout.wallGuides;
    renderGuides();
}

export function applyDefaultLayout() {
    setWallDimensions(DEFAULT_WALL_WIDTH_CM, DEFAULT_WALL_HEIGHT_CM);
    state.wallItems = cloneDefaults();
    atticSlopeToggle.checked = false;
    updateAccentColor('#ff9d42', false);
    updateCornerColor('#8b5cf6', false);
    setBrightness(100);
    applyWallPaint(DEFAULT_WALL_PAINT);
    state.wallGuides = [];
    renderGuides();
}

// A layout that is missing or fails validation leaves the starter layout in place
function applyProjectLayout(data) {
    applyDefaultLayout();
    if (!data) return;

    try {
        applyLayoutSettings(normalizeLayout(data));
    } catch {
        state.wallItems = cloneDefaults();
    }
}

export function loadState() {
    const index = readProjectIndex();
    state.projects = index ? index.projects : [];
    activeProjectId = index ? index.activeId : null;
    migrateLegacyState();

    const returning = state.projects.length > 0;
    if (!state.projects.length) state.projects.push({ id: createProjectId(), name: 'Default Project', timestamp: Date.now() });
    if (!activeProject()) activeProjectId = [...state.projects].sort((a, b) => b.timestamp - a.timestamp)[0].id;

    let layout = readProjectLayout(activeProjectId);
    const shared = takeSharedPlan();
    if (shared) {
        const project = returning ? addSharedProject() : activeProject();
        if (project) {
            activeProjectId = project.id;
            layout = shared;
            showIoStatus(returning ? `Opened the shared plan as ${project.name}.` : 'Opened the shared plan.', 'success');
        }
    }

    applyProjectLayout(layout);
    // Opening a project is not an edit, so its timestamp stays as it was
    writeProjectLayout(activeProjectId);
    writeProjectIndex();
    syncProjectsButton();
}

export function showIoStatus(message, tone) {
    clearTimeout(ioStatusTimer);
    ioStatus.textContent = message;
    ioStatus.className = `io-status is-${tone}`;
    ioStatus.hidden = false;
    ioStatusTimer = setTimeout(() => { ioStatus.hidden = true; }, 5000);
}

// One payload for the JSON export and share links, so a link opens exactly what a file would
export const layoutPayload = () => ({
    version: EXPORT_VERSION,
    wallWidthCm: state.wallWidthCm,
    wallHeightCm: state.wallHeightCm,
    wallItems: state.wallItems,
    atticSlope: atticSlopeToggle.checked,
    wallPaint: state.wallPaint,
    wallGuides: state.wallGuides,
    accentColor: accentColorPicker.value,
    cornerColor: cornerColorPicker.value,
    brightness: Number(brightnessSlider.value)
});

export function exportLayout() {
    downloadBlob(new Blob([JSON.stringify(layoutPayload(), null, 2)], { type: 'application/json' }), EXPORT_FILENAME);
    showIoStatus('Layout exported.', 'success');
}

export function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Revoking in the same tick can cancel the download in some browsers
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function importLayoutText(text) {
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error('That file is not valid JSON.');
    }

    // Validation finishes before anything is applied, so a bad file never leaves a half-loaded wall
    const layout = normalizeLayout(data);

    state.selectedItemIds = [];
    applyLayoutSettings(layout);
    renderPlanner();
    applyAtticSlope();
    updateInspectorPanel();
    commitLayoutChange();

    return layout;
}

function importLayoutFile(file) {
    if (!file) return;

    if (file.size > MAX_IMPORT_BYTES) {
        showIoStatus('File is too large to be a layout export.', 'error');
        return;
    }

    const reader = new FileReader();

    reader.addEventListener('load', () => {
        try {
            const { items, skipped } = importLayoutText(reader.result);
            const countLabel = `${items.length} item${items.length === 1 ? '' : 's'}`;
            const skippedLabel = skipped ? `, skipped ${skipped} invalid` : '';
            showIoStatus(`Imported ${countLabel}${skippedLabel}.`, 'success');
        } catch (err) {
            showIoStatus(`Import failed: ${err.message}`, 'error');
        }
    });

    reader.addEventListener('error', () => {
        showIoStatus('Import failed: the file could not be read.', 'error');
    });

    reader.readAsText(file);
}

const totalPrice = () => state.wallItems.reduce((sum, item) => sum + item.price, 0);

// Room features are not bought or mounted, so the spec sheet leaves them out
const furnitureItems = () => state.wallItems.filter(item => !isFeature(item));

// A turned piece is still the same product, so the bill lists it at its catalog orientation
function buildBomRows() {
    const groups = new Map();
    furnitureItems().forEach(item => {
        const [widthCm, heightCm] = isQuarterTurn(item)
            ? [toCm(item.height), toCm(item.width)]
            : [toCm(item.width), toCm(item.height)];
        const key = JSON.stringify([item.type, item.name, widthCm, heightCm, item.finish, item.price]);
        const group = groups.get(key);
        if (group) group.qty += 1;
        else groups.set(key, { name: item.name, widthCm, heightCm, finish: item.finish, price: item.price, qty: 1 });
    });

    return [...groups.values()].sort((a, b) =>
        a.name.localeCompare(b.name) || a.widthCm - b.widthCm || a.heightCm - b.heightCm || a.finish.localeCompare(b.finish));
}

// Installers work along the wall, so rows run left to right, then top to bottom
function buildMountingRows() {
    return furnitureItems()
        .sort((a, b) => a.left - b.left || a.top - b.top)
        .map(item => {
            const topCm = toCm(item.top);
            const heightCm = toCm(item.height);
            return {
                name: item.name,
                size: `${toCm(item.width)} x ${heightCm} cm`,
                widthCm: toCm(item.width),
                heightCm,
                left: toCm(item.left),
                top: topCm,
                floor: state.wallHeightCm - topCm - heightCm
            };
        });
}

export function renderSpecSheet() {
    const bomRows = buildBomRows();
    const mountingRows = buildMountingRows();
    const count = furnitureItems().length;

    specSubtitle.textContent = `Wall ${state.wallWidthCm} x ${state.wallHeightCm} cm | ${count} item${count === 1 ? '' : 's'}`;
    specNote.textContent = MOUNTING_NOTE;

    bomBody.innerHTML = bomRows.length
        ? bomRows.map(row => `
            <tr>
                <td>${escapeHtml(row.name)}</td>
                <td>${row.widthCm} x ${row.heightCm} cm</td>
                <td>${finishLabel(row.finish)}</td>
                <td class="num">${row.qty}</td>
                <td class="num">${formatMoney(row.price)}</td>
                <td class="num">${formatMoney(row.price * row.qty)}</td>
            </tr>`).join('')
        : '<tr><td colspan="6" class="spec-empty">No items on the wall yet.</td></tr>';

    bomFoot.innerHTML = `
        <tr>
            <th scope="row" colspan="3">Total</th>
            <td class="num">${count}</td>
            <td></td>
            <td class="num grand-total">${formatMoney(totalPrice())}</td>
        </tr>`;

    mountingBody.innerHTML = mountingRows.length
        ? mountingRows.map(row => `
            <tr>
                <td>${escapeHtml(row.name)}</td>
                <td>${row.size}</td>
                <td class="num">${row.left} cm</td>
                <td class="num">${row.top} cm</td>
                <td class="num">${row.floor} cm</td>
            </tr>`).join('')
        : '<tr><td colspan="5" class="spec-empty">No items to mount yet.</td></tr>';
}

function buildSpecMarkdown() {
    const count = furnitureItems().length;
    const total = formatMoney(totalPrice());

    return [
        '# Spatial Studio Spec Sheet',
        '',
        `Wall: ${state.wallWidthCm} x ${state.wallHeightCm} cm | Items: ${count} | Total: ${total}`,
        '',
        '## Bill of Materials',
        '',
        '| Item | Dimensions | Finish | Qty | Unit Price | Subtotal |',
        '| :--- | :--- | :--- | ---: | ---: | ---: |',
        ...buildBomRows().map(row =>
            `| ${markdownCell(row.name)} | ${row.widthCm} x ${row.heightCm} cm | ${finishLabel(row.finish)} | ${row.qty} | ${formatMoney(row.price)} | ${formatMoney(row.price * row.qty)} |`),
        `| **Total** | | | **${count}** | | **${total}** |`,
        '',
        '## Mounting & Drilling Coordinates',
        '',
        MOUNTING_NOTE,
        '',
        '| Item | Size (W x H) | From Left (X) | From Ceiling (Y) | From Floor (Bottom Edge) |',
        '| :--- | :--- | ---: | ---: | ---: |',
        ...buildMountingRows().map(row =>
            `| ${markdownCell(row.name)} | ${row.size} | ${row.left} cm | ${row.top} cm | ${row.floor} cm |`)
    ].join('\n');
}

function flashCopyLabel(text) {
    clearTimeout(copyLabelTimer);
    copyMarkdownBtn.textContent = text;
    copyLabelTimer = setTimeout(() => { copyMarkdownBtn.textContent = COPY_LABEL; }, 2000);
}

// Fallback for contexts without the async clipboard API. The buffer lives inside the dialog
// because everything outside an open modal dialog is inert and cannot be selected.
// The buffer goes inside the open dialog, since a modal dialog makes everything outside it inert
function copyWithSelection(text, dialog = specModal, returnFocus = copyMarkdownBtn) {
    const buffer = document.createElement('textarea');
    buffer.value = text;
    buffer.setAttribute('readonly', '');
    buffer.className = 'clipboard-buffer';
    dialog.appendChild(buffer);
    buffer.select();

    let copied = false;
    try {
        copied = document.execCommand('copy');
    } catch {
        copied = false;
    }
    buffer.remove();
    returnFocus.focus();
    return copied;
}

async function copyText(text, dialog, returnFocus) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return copyWithSelection(text, dialog, returnFocus);
    }
}

export async function copySpecMarkdown() {
    const text = buildSpecMarkdown();
    let copied = false;
    try {
        await navigator.clipboard.writeText(text);
        copied = true;
    } catch {
        copied = copyWithSelection(text);
    }
    flashCopyLabel(copied ? 'Copied to Clipboard' : 'Copy failed');
}

export function openSpecSheet() {
    if (isModalOpen() || isPointerBusy()) return;

    clearTimeout(copyLabelTimer);
    clearTimeout(csvLabelTimer);
    copyMarkdownBtn.textContent = COPY_LABEL;
    exportCsvBtn.textContent = CSV_LABEL;
    renderSpecSheet();
    specModal.showModal();
}

function buildSpecCsv() {
    const count = furnitureItems().length;
    const lines = [
        csvRow(['Spatial Studio Spec Sheet']),
        csvRow(['Wall (cm)', `${state.wallWidthCm} x ${state.wallHeightCm}`]),
        '',
        csvRow(['Bill of Materials']),
        csvRow(['Item', 'Width (cm)', 'Height (cm)', 'Finish', 'Qty', 'Unit Price (USD)', 'Subtotal (USD)']),
        ...buildBomRows().map(row => csvRow([
            row.name, row.widthCm, row.heightCm, finishLabel(row.finish), row.qty,
            row.price.toFixed(2), (row.price * row.qty).toFixed(2)
        ])),
        csvRow(['Total', '', '', '', count, '', totalPrice().toFixed(2)]),
        '',
        csvRow(['Mounting & Drilling Coordinates']),
        csvRow(['Item', 'Width (cm)', 'Height (cm)', 'From Left (cm)', 'From Ceiling (cm)', 'From Floor (cm)']),
        ...buildMountingRows().map(row => csvRow([row.name, row.widthCm, row.heightCm, row.left, row.top, row.floor]))
    ];
    return `${lines.join('\r\n')}\r\n`;
}

function flashCsvLabel(text) {
    clearTimeout(csvLabelTimer);
    exportCsvBtn.textContent = text;
    csvLabelTimer = setTimeout(() => { exportCsvBtn.textContent = CSV_LABEL; }, 2000);
}

// The byte order mark lets spreadsheet apps read item names as UTF-8
export function exportSpecCsv() {
    downloadBlob(new Blob(['\ufeff', buildSpecCsv()], { type: 'text/csv;charset=utf-8' }), CSV_FILENAME);
    flashCsvLabel('Downloaded!');
}

// Project gallery. Cards are listed most recently edited first; the open project cannot be deleted,
// so there is always one project for autosave to write to.
const PROJECT_DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
});

const THUMB_COLORS = {
    walnut: '#8b5a2b', oak: '#c89d66', black: '#525a66', white: '#e5e7eb',
    socket: '#d3d8e0', door: 'rgba(148, 163, 184, 0.4)', window: 'rgba(96, 165, 250, 0.45)', note: '#fde68a'
};

// The open project is read from the live wall; the others from storage, through the usual sanitizer
function projectLayout(project) {
    const data = project.id === activeProjectId ? currentLayoutData() : readProjectLayout(project.id);
    try {
        return normalizeLayout(data || {});
    } catch {
        return null;
    }
}

function projectThumbHtml(layout) {
    if (!layout) return '<span class="project-thumb is-empty" aria-hidden="true"></span>';
    const width = layout.wallWidthCm * SCALE;
    const height = layout.wallHeightCm * SCALE;
    const rects = layout.items.filter(item => !item.hidden).map(item => `
        <rect x="${item.left}" y="${item.top}" width="${item.width}" height="${item.height}" rx="3"
              fill="${THUMB_COLORS[isFeature(item) ? item.type : item.finish] || THUMB_COLORS.walnut}" />`).join('');
    return `
        <svg class="project-thumb" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <rect class="project-thumb-wall" width="${width}" height="${height}" fill="${wallPaintById(layout.wallPaint).ambient}" />${rects}
        </svg>`;
}

function projectCardHtml(project) {
    const layout = projectLayout(project);
    const current = project.id === activeProjectId;
    const name = escapeHtml(project.name);
    const count = layout ? layout.items.length : 0;
    const details = layout
        ? ` | ${count} item${count === 1 ? '' : 's'} | ${layout.wallWidthCm} x ${layout.wallHeightCm} cm`
        : ' | Unreadable layout';
    return `
        <li class="project-card${current ? ' is-current' : ''}" data-project-id="${project.id}">
            ${projectThumbHtml(layout)}
            <div class="project-info">
                <div class="project-title">
                    <span class="project-name">${name}</span>
                    ${current ? '<span class="project-badge">Open</span>' : ''}
                </div>
                <span class="project-meta">Edited ${PROJECT_DATE_FORMAT.format(project.timestamp)}${details}</span>
            </div>
            <div class="project-actions">
                <button type="button" class="btn-secondary" data-action="load" aria-label="Load ${name}" ${current ? 'disabled' : ''}>Load</button>
                <button type="button" class="btn-secondary" data-action="rename" aria-label="Rename ${name}">Rename</button>
                <button type="button" class="btn-danger" data-action="delete" aria-label="Delete ${name}" ${current ? 'disabled title="The open project cannot be deleted"' : ''}>Delete</button>
            </div>
        </li>`;
}

export function renderProjects() {
    // Reversed first so that two saves within the same millisecond still list the newer one on top
    const sorted = [...state.projects].reverse().sort((a, b) => b.timestamp - a.timestamp);
    const full = state.projects.length >= MAX_PROJECTS;
    projectList.innerHTML = sorted.map(projectCardHtml).join('');
    projectsSubtitle.textContent = `${state.projects.length} saved project${state.projects.length === 1 ? '' : 's'}. Changes save to the open project automatically.`;
    saveProjectBtn.disabled = full;
    newProjectName.disabled = full;
    projectLimitNote.hidden = !full;
    syncProjectsButton();
}

const syncProjectsButton = () => { projectsBtn.title = `My Projects (open: ${activeProject().name})`; };

function saveAsNewProject() {
    if (state.projects.length >= MAX_PROJECTS) return;

    const project = {
        id: createProjectId(),
        name: cleanProjectName(newProjectName.value, `Project ${state.projects.length + 1}`),
        timestamp: Date.now()
    };
    state.projects.push(project);
    activeProjectId = project.id;
    saveState();
    newProjectName.value = '';
    renderProjects();
    showIoStatus(`Saved as ${project.name}.`, 'success');
}

// Each project keeps its own undo history, so switching starts a fresh one
function openProject(id) {
    const project = state.projects.find(entry => entry.id === id);
    if (!project || id === activeProjectId || isPointerBusy()) return;

    activeProjectId = id;
    state.selectedItemIds = [];
    applyProjectLayout(readProjectLayout(id));
    renderPlanner();
    applyAtticSlope();
    updateInspectorPanel();
    state.historyStack = [];
    state.historyIndex = -1;
    pushHistory();
    writeProjectIndex();
    projectsModal.close();
    syncProjectsButton();
    showIoStatus(`Opened ${project.name}.`, 'success');
}

// Delete takes two presses; the first arms the button for a few seconds
function deleteProject(project, button) {
    if (project.id === activeProjectId) return;
    if (!button.classList.contains('is-armed')) {
        button.classList.add('is-armed');
        button.textContent = 'Confirm';
        button.setAttribute('aria-label', `Confirm deleting ${project.name}`);
        setTimeout(() => {
            if (!button.isConnected) return;
            button.classList.remove('is-armed');
            button.textContent = 'Delete';
            button.setAttribute('aria-label', `Delete ${project.name}`);
        }, 3000);
        return;
    }

    state.projects = state.projects.filter(entry => entry.id !== project.id);
    storageRemove(PROJECT_LAYOUT_PREFIX + project.id);
    writeProjectIndex();
    renderProjects();
    // The pressed button is gone with its card, so focus would otherwise fall out of the dialog
    newProjectName.focus();
}

// Escape inside the rename field cancels the edit, and that same key must not close the whole dialog
let renameEscape = false;

// The card is patched in place rather than re-rendered: a click that ends the rename by blurring the
// field must still land on the button it was aimed at
function startProjectRename(card, project) {
    const label = card.querySelector('.project-name');
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'project-rename';
    input.value = project.name;
    input.maxLength = PROJECT_NAME_LENGTH;
    input.setAttribute('aria-label', 'Project name');
    label.replaceWith(input);
    input.focus();
    input.select();

    let finished = false;
    const finish = (save, refocus) => {
        if (finished) return;
        finished = true;
        if (save) {
            project.name = cleanProjectName(input.value, project.name);
            writeProjectIndex();
            syncProjectsButton();
        }
        label.textContent = project.name;
        input.replaceWith(label);
        card.querySelectorAll('button[data-action]').forEach(button => {
            if (!button.classList.contains('is-armed')) button.setAttribute('aria-label', `${button.textContent} ${project.name}`);
        });
        if (refocus) card.querySelector('[data-action="rename"]').focus();
    };
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            finish(true, true);
        } else if (e.key === 'Escape') {
            // The flag only covers the cancel event this same key press may raise
            renameEscape = true;
            setTimeout(() => { renameEscape = false; }, 0);
            finish(false, true);
        }
    });
    input.addEventListener('blur', () => finish(true, false));
}

export function openProjects() {
    if (isModalOpen() || isPointerBusy()) return;
    clearTimeout(shareLabelTimer);
    copyShareLinkBtn.textContent = SHARE_LABEL;
    renderProjects();
    projectsModal.showModal();
    newProjectName.focus();
}

function flashShareLabel(text) {
    clearTimeout(shareLabelTimer);
    copyShareLinkBtn.textContent = text;
    shareLabelTimer = setTimeout(() => { copyShareLinkBtn.textContent = SHARE_LABEL; }, 2000);
}

export async function copyShareLink() {
    const url = `${window.location.href.split('#')[0]}${SHARE_HASH_PREFIX}${toBase64Url(JSON.stringify(layoutPayload()))}`;
    const copied = await copyText(url, projectsModal, copyShareLinkBtn);
    flashShareLabel(copied ? 'Link Copied' : 'Copy failed');
    showIoStatus(copied ? 'Share link copied. It opens this exact wall in any browser.' : 'The share link could not be copied.', copied ? 'success' : 'error');
}

// Only a click that starts and ends on the backdrop closes a dialog, so dragging a text
// selection out of the panel does not dismiss it
export function closeOnBackdropClick(dialog) {
    let pressedBackdrop = false;
    dialog.addEventListener('mousedown', (e) => {
        pressedBackdrop = e.target === dialog;
    });
    dialog.addEventListener('click', (e) => {
        if (pressedBackdrop && e.target === dialog) dialog.close();
        pressedBackdrop = false;
    });
}

export function openShortcuts() {
    if (isModalOpen() || isPointerBusy()) return;
    shortcutsModal.showModal();
}

export function loadTemplate(key) {
    const template = LAYOUT_TEMPLATES[key];
    if (!template || isPointerBusy()) return;

    // Templates run through the same sanitizer as imports, which fills in catalog sizes, names and prices.
    // A template replaces the composition, guides included, and keeps the look: lighting and wall paint.
    const layout = normalizeLayout(template);
    state.selectedItemIds = [];
    applyLayoutSettings({ ...layout, wallPaint: state.wallPaint });
    renderPlanner();
    applyAtticSlope();
    updateInspectorPanel();
    commitLayoutChange();
    showIoStatus(`Loaded the ${template.label} template.`, 'success');
}

export function bindProjectSpecEvents() {
    exportJsonBtn.addEventListener('click', exportLayout);
    importJsonBtn.addEventListener('click', () => importFileInput.click());

    importFileInput.addEventListener('change', () => {
        importLayoutFile(importFileInput.files[0]);
        // Clearing the value lets the same file be picked again after editing it
        importFileInput.value = '';
    });

    viewSpecBtn.addEventListener('click', openSpecSheet);
    closeSpecBtn.addEventListener('click', () => specModal.close());
    copyMarkdownBtn.addEventListener('click', copySpecMarkdown);
    exportCsvBtn.addEventListener('click', exportSpecCsv);

    projectList.addEventListener('click', (e) => {
        const button = e.target.closest('button[data-action]');
        const card = e.target.closest('.project-card');
        const project = card && state.projects.find(entry => entry.id === card.dataset.projectId);
        if (!button || !project) return;

        if (button.dataset.action === 'load') openProject(project.id);
        else if (button.dataset.action === 'rename') startProjectRename(card, project);
        else if (button.dataset.action === 'delete') deleteProject(project, button);
    });

    projectsModal.addEventListener('cancel', (e) => {
        if (renameEscape) e.preventDefault();
    });

    newProjectForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveAsNewProject();
    });

    copyShareLinkBtn.addEventListener('click', copyShareLink);

    // A link pasted into a tab that already runs the planner only changes the hash, so it is picked up here
    window.addEventListener('hashchange', () => {
        const shared = takeSharedPlan();
        if (!shared || isPointerBusy()) return;
        const project = addSharedProject();
        if (!project) return;
        storageSet(PROJECT_LAYOUT_PREFIX + project.id, JSON.stringify(shared));
        openProject(project.id);
    });

    projectsBtn.addEventListener('click', openProjects);
    closeProjectsBtn.addEventListener('click', () => projectsModal.close());

    closeOnBackdropClick(specModal);
    closeOnBackdropClick(shortcutsModal);
    closeOnBackdropClick(projectsModal);
    closeOnBackdropClick(commandPalette);

    shortcutsBtn.addEventListener('click', openShortcuts);
    closeShortcutsBtn.addEventListener('click', () => shortcutsModal.close());

    templateButtons.forEach(button => {
        button.addEventListener('click', () => loadTemplate(button.dataset.template));
    });
}
