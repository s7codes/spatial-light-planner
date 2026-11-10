import { isHexColor, ITEM_DEPTH_CM, RGB_BAR_TYPES } from './constants.js';

export const wallCanvas = document.getElementById('wall');
export const canvasArea = document.querySelector('.canvas-area');
export const wallItemsLayer = document.getElementById('wall-items');
export const atticZone = document.getElementById('attic-zone');
export const alignLayer = document.getElementById('align-guides');
export const marqueeBox = document.getElementById('selection-marquee');
export const measureLayer = document.getElementById('measure-layer');
export const selectionBounds = document.getElementById('selection-bounds');
export const guideHitLayer = document.getElementById('guide-hits');
export const guideLineLayer = document.getElementById('guide-lines');

export const wallWidthInput = document.getElementById('wall-width-input');
export const wallHeightInput = document.getElementById('wall-height-input');
export const scaleNote = document.getElementById('scale-note');

export const themeToggleBtn = document.getElementById('theme-toggle-btn');
export const resetWallBtn = document.getElementById('reset-wall-btn');
export const undoBtn = document.getElementById('undo-btn');
export const redoBtn = document.getElementById('redo-btn');
export const snapGridToggle = document.getElementById('snap-grid-toggle');
export const atticSlopeToggle = document.getElementById('attic-slope-toggle');
export const atticSizeFields = document.getElementById('attic-size-fields');
export const atticWidthInput = document.getElementById('attic-width-input');
export const atticHeightInput = document.getElementById('attic-height-input');
export const atticZoneSize = document.getElementById('attic-zone-size');
export const catalogItems = document.querySelectorAll('.catalog-item');
export const totalPriceDisplay = document.getElementById('total-price');
export const inspectorBox = document.getElementById('inspector-box');

export const exportJsonBtn = document.getElementById('export-json-btn');
export const importJsonBtn = document.getElementById('import-json-btn');
export const importFileInput = document.getElementById('import-file-input');
export const ioStatus = document.getElementById('io-status');
export const exportPngBtn = document.getElementById('export-png-btn');

export const viewSpecBtn = document.getElementById('view-spec-btn');
export const specModal = document.getElementById('spec-modal');
export const specSubtitle = document.getElementById('spec-modal-subtitle');
export const specNote = document.getElementById('spec-mounting-note');
export const bomBody = document.getElementById('bom-body');
export const bomFoot = document.getElementById('bom-foot');
export const mountingBody = document.getElementById('mounting-body');
export const kitLedStrip = document.getElementById('kit-led-strip');
export const kitPowerDraw = document.getElementById('kit-power-draw');
export const kitWallAnchors = document.getElementById('kit-wall-anchors');
export const copyMarkdownBtn = document.getElementById('copy-markdown-btn');
export const closeSpecBtn = document.getElementById('close-spec-btn');

export const shortcutsBtn = document.getElementById('shortcuts-btn');
export const shortcutsModal = document.getElementById('shortcuts-modal');
export const exportCsvBtn = document.getElementById('export-csv-btn');

export const projectsBtn = document.getElementById('projects-btn');
export const projectsModal = document.getElementById('projects-modal');
export const projectsSubtitle = document.getElementById('projects-subtitle');
export const projectList = document.getElementById('project-list');
export const newProjectForm = document.getElementById('new-project-form');
export const newProjectName = document.getElementById('new-project-name');
export const saveProjectBtn = document.getElementById('save-project-btn');
export const projectLimitNote = document.getElementById('project-limit-note');
export const closeProjectsBtn = document.getElementById('close-projects-btn');

export const rulerX = document.getElementById('ruler-x');
export const rulerY = document.getElementById('ruler-y');
export const rulerCorner = document.getElementById('ruler-corner');
export const zoomOutBtn = document.getElementById('zoom-out-btn');
export const zoomResetBtn = document.getElementById('zoom-reset-btn');
export const zoomInBtn = document.getElementById('zoom-in-btn');
export const copyShareLinkBtn = document.getElementById('copy-share-link-btn');
export const closeShortcutsBtn = document.getElementById('close-shortcuts-btn');
export const templateButtons = document.querySelectorAll('.template-btn');

export const commandPalette = document.getElementById('command-palette');
export const commandPaletteBtn = document.getElementById('command-palette-btn');
export const commandSearchInput = document.getElementById('command-search-input');
export const commandList = document.getElementById('command-list');
export const commandEmpty = document.getElementById('command-empty');
export const powerRoutingToggle = document.getElementById('power-routing-toggle');
export const powerRoutingSummary = document.getElementById('power-routing-summary');
export const powerRoutesLayer = document.getElementById('power-routes');
export const floorBackdropLayer = document.getElementById('floor-backdrop');
export const backdropButtons = document.querySelectorAll('[data-backdrop]');
export const backdropAlignRow = document.getElementById('backdrop-align-row');
export const backdropAlignButtons = document.querySelectorAll('[data-backdrop-align]');
export const appShell = document.querySelector('.app-shell');
export const modeEngineerBtn = document.getElementById('mode-engineer-btn');
export const modeCreatorBtn = document.getElementById('mode-creator-btn');

export const splashScreen = document.getElementById('splash-screen');
export const enterStudioBtn = document.getElementById('enter-studio-btn');
export const generateQuoteBtn = document.getElementById('generate-quote-btn');
export const quoteModal = document.getElementById('quote-modal');
export const quoteBody = document.getElementById('quote-body');
export const quoteDate = document.getElementById('quote-date');
export const quoteNumber = document.getElementById('quote-number');
export const quoteNet = document.getElementById('quote-net');
export const quoteVat = document.getElementById('quote-vat');
export const quoteGross = document.getElementById('quote-gross');
export const quoteCurrency = document.getElementById('quote-currency');
export const quoteFooterCurrency = document.getElementById('quote-footer-currency');
export const quoteClientInput = document.getElementById('quote-client-input');
export const quoteClientRow = document.getElementById('quote-client-row');
export const quoteClientDisplay = document.getElementById('quote-client-display');
export const quotePromoInput = document.getElementById('quote-promo-input');
export const applyPromoBtn = document.getElementById('apply-promo-btn');
export const clearPromoBtn = document.getElementById('clear-promo-btn');
export const quotePromoStatus = document.getElementById('quote-promo-status');
export const quoteDiscountRow = document.getElementById('quote-discount-row');
export const quoteDiscountLabel = document.getElementById('quote-discount-label');
export const quoteDiscount = document.getElementById('quote-discount');
export const quoteNetDiscounted = document.getElementById('quote-net-discounted');
export const leadTimeSummary = document.getElementById('lead-time-summary');
export const kitLeadTime = document.getElementById('kit-lead-time');
export const printQuoteBtn = document.getElementById('print-quote-btn');
export const closeQuoteBtn = document.getElementById('close-quote-btn');

export const tapeMeasureBtn = document.getElementById('tape-measure-btn');
export const tapeMeasureLayer = document.getElementById('tape-measure-layer');
export const tapeMeasureLine = tapeMeasureLayer.querySelector('.tape-measure-line');
export const tapeMeasureReadout = tapeMeasureLayer.querySelector('.tape-measure-readout');
export const currencySelector = document.getElementById('currency-selector');
export const illumStatus = document.getElementById('illum-status');

// A fading splash already lets pointer events through, so only a fully shown one blocks the studio
export const isSplashShown = () => Boolean(splashScreen) && !splashScreen.hidden && !splashScreen.classList.contains('fade-out');

export const isModalOpen = () => specModal.open || shortcutsModal.open || projectsModal.open || commandPalette.open ||
    quoteModal.open || isSplashShown();

export const accentColorPicker = document.getElementById('accent-color-picker');
export const accentHexCode = document.getElementById('accent-hex-code');
export const cornerColorPicker = document.getElementById('corner-color-picker');
export const cornerHexCode = document.getElementById('corner-hex-code');
export const brightnessSlider = document.getElementById('brightness-slider');
export const brightnessValue = document.getElementById('brightness-value');
export const presetButtons = document.querySelectorAll('.btn-preset');
export const paintSwatches = document.querySelectorAll('.paint-swatch');
export const wallPaintName = document.getElementById('wall-paint-name');

export const layersPanel = document.getElementById('layers-panel');
export const layerList = document.getElementById('layer-list');
export const layersCount = document.getElementById('layers-count');
export const layersToggle = document.getElementById('layers-toggle');

export const contextMenu = document.getElementById('context-menu');
export const contextMenuTitle = document.getElementById('context-menu-title');
export const contextMenuButtons = [...contextMenu.querySelectorAll('.context-menu-item')];

export const createRuler = (id) => {
    const el = document.getElementById(id);
    return { el, label: el.querySelector('.guide-label'), spec: null };
};

export const rulers = {
    wallX: createRuler('guide-x'),
    wallY: createRuler('guide-y'),
    gapLeft: createRuler('gap-left'),
    gapRight: createRuler('gap-right'),
    gapUp: createRuler('gap-up'),
    gapDown: createRuler('gap-down')
};

// Import fallbacks come straight from the catalog markup so there is one source of truth
export const CATALOG_DEFAULTS = Object.fromEntries([...catalogItems].map(el => [el.dataset.type, {
    name: el.dataset.name,
    price: parseFloat(el.dataset.price),
    width: parseFloat(el.dataset.width),
    height: parseFloat(el.dataset.height),
    finish: el.dataset.finish || null,
    depth: ITEM_DEPTH_CM[el.dataset.type] ?? 0
}]));

export const getItemElement = (itemId) => wallItemsLayer.querySelector(`.wall-item[data-id="${itemId}"]`);

export const ledColorOf = (item) => (isHexColor(item.itemLedColor)
    ? item.itemLedColor
    : (RGB_BAR_TYPES.includes(item.type) ? cornerColorPicker : accentColorPicker).value);
