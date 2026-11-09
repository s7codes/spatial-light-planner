import {
    ATTIC_SLOPE_PX, CORNER_GLOW_ALPHA, DAYLIGHT_GRID_PX, isLedOn, isNote, isQuarterTurn, PNG_FILENAME,
    PNG_PIXEL_RATIO, SHADOW_SHIFT_PX, SPOTLIGHT_CONE_FADE, wallPaintById
} from '../core/constants.js';
import {
    atticSlopeToggle, atticZone, brightnessSlider, cornerColorPicker, getItemElement, ledColorOf, wallCanvas
} from '../core/dom.js';
import { state } from '../core/state.js';
import { labelShift } from '../ui/inspector-layers.js';
import { downloadBlob, showIoStatus } from './projects-spec.js';

export function hexToRgb(hex) {
    const value = parseInt(hex.slice(1), 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

// Splits on the commas between list entries, not the ones inside rgba(...)
export function splitTopLevel(value) {
    const parts = [];
    let depth = 0;
    let from = 0;
    for (let i = 0; i < value.length; i++) {
        if (value[i] === '(') depth++;
        else if (value[i] === ')') depth--;
        else if (value[i] === ',' && depth === 0) {
            parts.push(value.slice(from, i));
            from = i + 1;
        }
    }
    parts.push(value.slice(from));
    return parts.map(part => part.trim()).filter(Boolean);
}

// Computed box-shadow entries read like "rgb(0, 0, 0) 0px 8px 15px 0px inset", though some engines put the
// color last. Fully transparent entries are the placeholders the item rules use and are dropped.
export function parseShadows(value) {
    if (!value || value === 'none') return [];

    return splitTopLevel(value)
        .map(entry => {
            const color = (entry.match(/rgba?\([^)]*\)/) || [''])[0];
            const [x = 0, y = 0, blur = 0, spread = 0] = (entry.replace(color, '').match(/-?[\d.]+px/g) || []).map(parseFloat);
            return { color, x, y, blur, spread, inset: /\binset\b/.test(entry) };
        })
        .filter(shadow => shadow.color && (parseRgba(shadow.color)?.a ?? 1) > 0);
}

export function parseRgba(value) {
    const match = /rgba?\(([^)]*)\)/.exec(value || '');
    if (!match) return null;
    const [r, g, b, a = 1] = match[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return { r, g, b, a };
}

const rgbaString = ({ r, g, b, a }, alpha = a) => `rgba(${r}, ${g}, ${b}, ${alpha})`;

// Reads a CSS polygon() clip path into points inside a w x h box
export function parsePolygon(value, w, h) {
    const body = /polygon\(([^)]*)\)/.exec(value || '');
    if (!body) return [];
    const toPx = (token, size) => (token.endsWith('%') ? (parseFloat(token) / 100) * size : parseFloat(token));
    return body[1].split(',').map(pair => {
        const [px, py] = pair.trim().split(/\s+/);
        return [toPx(px, w), toPx(py, h)];
    });
}

export function itemShape(item, radius) {
    const percent = radius.endsWith('%') ? parseFloat(radius) : null;
    return {
        x: item.left,
        y: item.top,
        w: item.width,
        h: item.height,
        // A 50% radius is how the spotlight becomes a circle, or an ellipse once resized
        ellipse: percent !== null && percent >= 50,
        radius: percent !== null ? Math.min(item.width, item.height) * percent / 100 : parseFloat(radius) || 0
    };
}

// A negative inset grows the shape, which is how shadow spread is drawn
export function traceShape(ctx, shape, inset, startPath = true) {
    const x = shape.x + inset;
    const y = shape.y + inset;
    const w = Math.max(0, shape.w - inset * 2);
    const h = Math.max(0, shape.h - inset * 2);

    if (startPath) ctx.beginPath();
    if (shape.ellipse) {
        ctx.moveTo(x + w, y + h / 2);
        ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        return;
    }

    const r = Math.max(0, Math.min(shape.radius - inset, w / 2, h / 2));
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

// Paints only a shape's shadow: the shape itself is drawn far off canvas and the shadow is offset back.
// Shadow offsets and blur ignore the canvas transform, so they are given in device pixels.
export function paintShadowOnly(ctx, shape, shadow, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = shadow.color;
    ctx.shadowBlur = shadow.blur * PNG_PIXEL_RATIO;
    ctx.shadowOffsetX = (shadow.x + SHADOW_SHIFT_PX) * PNG_PIXEL_RATIO;
    ctx.shadowOffsetY = shadow.y * PNG_PIXEL_RATIO;
    ctx.translate(-SHADOW_SHIFT_PX, 0);
    traceShape(ctx, shape, -(shadow.spread || 0));
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.restore();
}

// Inset shadows are cast by a frame around the shape: clip to the shape, draw the frame far off canvas,
// and offset only its shadow back inside, the same trick paintShadowOnly uses for outer shadows
export function paintInsetShadow(ctx, shape, inset, shadow, alpha) {
    const reach = Math.abs(shadow.x) + Math.abs(shadow.y) + shadow.blur * 2 + Math.abs(shadow.spread) + 20;

    ctx.save();
    traceShape(ctx, shape, inset);
    ctx.clip();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = shadow.color;
    ctx.shadowBlur = shadow.blur * PNG_PIXEL_RATIO;
    ctx.shadowOffsetX = (shadow.x + SHADOW_SHIFT_PX) * PNG_PIXEL_RATIO;
    ctx.shadowOffsetY = shadow.y * PNG_PIXEL_RATIO;
    ctx.translate(-SHADOW_SHIFT_PX, 0);
    ctx.beginPath();
    ctx.rect(shape.x - reach, shape.y - reach, shape.w + reach * 2, shape.h + reach * 2);
    traceShape(ctx, shape, inset + shadow.spread, false);
    ctx.fillStyle = '#000';
    ctx.fill('evenodd');
    ctx.restore();
}

// Mirrors the --sheen background: a highlight fading down from the top edge and a shade rising from the bottom
export function paintSheen(ctx, shape, border, style) {
    const highlight = parseRgba(style.getPropertyValue('--sheen-highlight'));
    const shade = parseRgba(style.getPropertyValue('--sheen-shade'));
    const band = parseFloat(style.getPropertyValue('--sheen-band'));
    const top = shape.y + border;
    const height = shape.h - border * 2;
    if (!highlight || !shade || !(band > 0) || height <= 0) return;

    const edge = Math.min(band / height, 0.5);
    const gradient = ctx.createLinearGradient(0, top, 0, top + height);
    gradient.addColorStop(0, rgbaString(highlight));
    gradient.addColorStop(edge, rgbaString(highlight, 0));
    gradient.addColorStop(1 - edge, rgbaString(shade, 0));
    gradient.addColorStop(1, rgbaString(shade));

    ctx.fillStyle = gradient;
    traceShape(ctx, shape, border);
    ctx.fill();
}

// The poster artwork and the lamp diffuser are ::after boxes, positioned against the padding box
export function paintAfterLayer(ctx, item, el, border) {
    const layer = getComputedStyle(el, '::after');
    const alpha = parseFloat(layer.opacity);
    if (layer.content === 'none' || !(alpha > 0)) return;

    const shape = {
        x: item.left + border + parseFloat(layer.left),
        y: item.top + border + parseFloat(layer.top),
        w: parseFloat(layer.width),
        h: parseFloat(layer.height),
        radius: parseFloat(layer.borderTopLeftRadius) || 0,
        ellipse: false
    };
    const shadows = parseShadows(layer.boxShadow);

    shadows.filter(shadow => !shadow.inset).forEach(shadow => paintShadowOnly(ctx, shape, shadow, alpha));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = layer.backgroundColor;
    traceShape(ctx, shape, 0);
    ctx.fill();
    ctx.restore();
    shadows.filter(shadow => shadow.inset).forEach(shadow => paintInsetShadow(ctx, shape, 0, shadow, alpha));
}

// Computed transforms always come back as matrix(a, b, c, d, e, f) or none
export function parseMatrix(value) {
    const match = /matrix\(([^)]*)\)/.exec(value || '');
    return match ? match[1].split(',').map(Number) : [1, 0, 0, 1, 0, 0];
}

// The wash is a clipped trapezoid fading from the item's LED color, read from the spotlight's ::after box.
// A turned spotlight rotates that box about the fixture center, so the same matrix and origin the CSS
// resolved are applied here and the trapezoid is drawn in the box's own coordinates.
export function paintSpotlightCone(ctx, item, el, border) {
    const cone = getComputedStyle(el, '::after');
    const alpha = parseFloat(cone.opacity);
    if (!state.isAmbientMode || !isLedOn(item) || !(alpha > 0)) return;

    const width = parseFloat(cone.width);
    const height = parseFloat(cone.height);
    const points = parsePolygon(cone.clipPath, width, height);
    if (!points.length) return;

    const [originX, originY] = cone.transformOrigin.split(' ').map(parseFloat);
    const [r, g, b] = hexToRgb(ledColorOf(item));
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`);
    gradient.addColorStop(SPOTLIGHT_CONE_FADE, `rgba(${r}, ${g}, ${b}, 0)`);

    ctx.save();
    ctx.translate(item.left + border + parseFloat(cone.left) + originX, item.top + border + parseFloat(cone.top) + originY);
    ctx.transform(...parseMatrix(cone.transform));
    ctx.translate(-originX, -originY);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    points.forEach(([px, py], index) => (index ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

export function paintWallBackground(ctx) {
    const paint = wallPaintById(state.wallPaint);
    ctx.fillStyle = state.isAmbientMode ? paint.ambient : paint.daylight;
    ctx.fillRect(0, 0, state.wallWidthPx, state.wallHeightPx);
    if (state.isAmbientMode) return;

    // Same 1px lines every 10 cm as the Daylight Grid background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
    for (let x = 0; x < state.wallWidthPx; x += DAYLIGHT_GRID_PX) ctx.fillRect(x, 0, 1, state.wallHeightPx);
    for (let y = 0; y < state.wallHeightPx; y += DAYLIGHT_GRID_PX) ctx.fillRect(0, y, state.wallWidthPx, 1);
}

export function paintAtticZone(ctx, fontFamily) {
    const wallStyle = getComputedStyle(wallCanvas);
    const cssVar = (name) => wallStyle.getPropertyValue(name).trim();
    const startX = state.wallWidthPx - ATTIC_SLOPE_PX;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(startX, 0);
    ctx.lineTo(state.wallWidthPx, 0);
    ctx.lineTo(state.wallWidthPx, ATTIC_SLOPE_PX);
    ctx.closePath();
    ctx.clip();

    ctx.fillStyle = cssVar('--attic-fill');
    ctx.fillRect(startX, 0, ATTIC_SLOPE_PX, ATTIC_SLOPE_PX);

    // Hatch lines follow x + y = c, 8 px apart like the CSS repeating gradient
    ctx.strokeStyle = cssVar('--attic-hatch');
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = startX; c <= state.wallWidthPx + ATTIC_SLOPE_PX; c += 8 * Math.SQRT2) {
        ctx.moveTo(c, 0);
        ctx.lineTo(c - ATTIC_SLOPE_PX, ATTIC_SLOPE_PX);
    }
    ctx.stroke();

    // The clip keeps only the inner half of this 4px stroke, matching the 2px CSS edge band
    ctx.strokeStyle = cssVar('--attic-edge');
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(startX, 0);
    ctx.lineTo(state.wallWidthPx, ATTIC_SLOPE_PX);
    ctx.stroke();

    ctx.fillStyle = cssVar('--attic-label');
    ctx.font = `600 10px ${fontFamily}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    [...atticZone.querySelectorAll('.attic-zone-label span')].forEach((span, index) => {
        ctx.fillText(span.textContent.toUpperCase(), state.wallWidthPx - 10, 10 + index * 15);
    });
    ctx.restore();
}

export function paintCornerGlow(ctx, brightness) {
    const style = getComputedStyle(wallCanvas.querySelector('.corner-led-glow'));
    const radiusX = parseFloat(style.width) / 2;
    const radiusY = parseFloat(style.height) / 2;
    const centerX = state.wallWidthPx - parseFloat(style.right) - radiusX;
    const centerY = state.wallHeightPx - parseFloat(style.bottom) - radiusY;
    const [r, g, b] = hexToRgb(cornerColorPicker.value);

    ctx.save();
    // The CSS "ellipse closest-side" gradient is a circle stretched to its box proportions
    ctx.translate(centerX, centerY);
    ctx.scale(1, radiusY / radiusX);
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radiusX);
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`);
    // Fading to the same color at zero alpha avoids the gray fringe a plain "transparent" stop gives
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    ctx.globalAlpha = CORNER_GLOW_ALPHA * brightness;
    ctx.fillStyle = gradient;
    ctx.fillRect(-radiusX, -radiusX, radiusX * 2, radiusX * 2);
    ctx.restore();
}

// Mirrors the cabinet seam on the .storage background; a cabinet on its side has a horizontal seam
export function paintStorageSeam(ctx, item, border) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    if (isQuarterTurn(item)) {
        ctx.fillRect(item.left + border, item.top + item.height / 2 - 1, item.width - border * 2, 2);
    } else {
        ctx.fillRect(item.left + item.width / 2 - 1, item.top + border, 2, item.height - border * 2);
    }
}

// Mirrors the handle pair drawn by the .storage ::after. The bars are borders on whichever two sides
// the current rotation uses, so every side is read and painted on its own.
export function paintStorageHandles(ctx, item, el, border) {
    const handles = getComputedStyle(el, '::after');
    const side = (name) => parseFloat(handles[`border${name}Width`]) || 0;
    const [leftBar, rightBar, topBar, bottomBar] = ['Left', 'Right', 'Top', 'Bottom'].map(side);
    const contentBox = handles.boxSizing !== 'border-box';
    const width = (parseFloat(handles.width) || 0) + (contentBox ? leftBar + rightBar : 0);
    const height = (parseFloat(handles.height) || 0) + (contentBox ? topBar + bottomBar : 0);
    const x = item.left + border + (parseFloat(handles.left) || 0);
    const y = item.top + border + (parseFloat(handles.top) || 0);

    ctx.fillStyle = handles.borderLeftColor;
    if (leftBar) ctx.fillRect(x, y, leftBar, height);
    if (rightBar) ctx.fillRect(x + width - rightBar, y, rightBar, height);
    ctx.fillStyle = handles.borderTopColor;
    if (topBar) ctx.fillRect(x, y, width, topBar);
    if (bottomBar) ctx.fillRect(x, y + height - bottomBar, width, bottomBar);
}

// Door clearances carry a corner-to-corner cross and windows a mullion cross, both on the background
export function paintFeatureDetail(ctx, item, style, border) {
    const x = item.left + border;
    const y = item.top + border;
    const width = item.width - border * 2;
    const height = item.height - border * 2;
    const line = style.getPropertyValue('--feature-line').trim();
    const weight = parseFloat(style.getPropertyValue('--feature-weight')) || 1;

    ctx.save();
    if (item.type === 'door') {
        ctx.beginPath();
        ctx.rect(x, y, width, height);
        ctx.clip();
        ctx.strokeStyle = line;
        ctx.lineWidth = weight;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + width, y + height);
        ctx.moveTo(x + width, y);
        ctx.lineTo(x, y + height);
        ctx.stroke();
    } else if (item.type === 'window') {
        ctx.fillStyle = line;
        ctx.fillRect(x + width / 2 - weight / 2, y, weight, height);
        ctx.fillRect(x, y + height / 2 - weight / 2, width, weight);
    }
    ctx.restore();
}

// Line breaks are read back from the rendered label one character at a time, so the export wraps
// exactly where the browser wrapped. Screen rects are divided by the fit scale to get wall pixels.
export function paintNoteText(ctx, item, el, label, style) {
    const node = label.firstChild;
    if (!node || node.nodeType !== Node.TEXT_NODE) return;

    const range = document.createRange();
    const origin = el.getBoundingClientRect().top;
    const lines = [];
    for (let index = 0; index < node.length; index++) {
        if (node.data[index] === '\n') continue;
        range.setStart(node, index);
        range.setEnd(node, index + 1);
        const rect = range.getBoundingClientRect();
        if (!rect.height) continue;
        const line = lines.at(-1);
        if (line && Math.abs(rect.top - line.top) < 1) line.text += node.data[index];
        else lines.push({ top: rect.top, middle: (rect.top + rect.bottom) / 2, text: node.data[index] });
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(item.left, item.top, item.width, item.height);
    ctx.clip();
    ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    ctx.fillStyle = style.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach(line => {
        ctx.fillText(line.text.trimEnd(), item.left + item.width / 2, item.top + (line.middle - origin) / state.viewScale);
    });
    ctx.restore();
}

export function paintItemLabel(ctx, item, el) {
    const label = el.querySelector('.item-label');
    if (!label) return;

    const style = getComputedStyle(label);
    if (style.display === 'none') return;
    if (isNote(item)) {
        paintNoteText(ctx, item, el, label, style);
        return;
    }
    ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const width = ctx.measureText(item.name).width + parseFloat(style.paddingLeft) * 2;
    const height = label.offsetHeight;
    const centerX = item.left + item.width / 2 + labelShift(item.left, item.width, width, state.wallWidthPx);
    const centerY = item.top + item.height / 2 + labelShift(item.top, item.height, height, state.wallHeightPx);

    ctx.fillStyle = style.backgroundColor;
    traceShape(ctx, { x: centerX - width / 2, y: centerY - height / 2, w: width, h: height, radius: parseFloat(style.borderTopLeftRadius) || 0, ellipse: false }, 0);
    ctx.fill();

    ctx.fillStyle = style.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.name, centerX, centerY);
}

// Item visuals come from the live computed styles, so the snapshot always matches the CSS on screen
export function paintItem(ctx, item, brightness) {
    const el = getItemElement(item.id);
    if (!el) return;

    const style = getComputedStyle(el);
    const shape = itemShape(item, style.borderTopLeftRadius);
    const border = parseFloat(style.borderTopWidth) || 0;
    const shadows = parseShadows(style.boxShadow);

    // Same order the DOM paints in: drop shadow, LED glow and light wash, then the body over them
    shadows.filter(shadow => !shadow.inset).forEach(shadow => paintShadowOnly(ctx, shape, shadow, 1));
    if (state.isAmbientMode && isLedOn(item) && brightness > 0) {
        parseShadows(getComputedStyle(el, '::before').boxShadow)
            .filter(shadow => !shadow.inset)
            .forEach(shadow => paintShadowOnly(ctx, shape, shadow, brightness));
    }
    if (item.type === 'spotlight') paintSpotlightCone(ctx, item, el, border);

    // A see-through fill (room features) must not show the border color through it, so the border is
    // painted as a ring there; opaque fills simply cover the inside of a full border-colored shape
    if (border > 0) {
        const seeThrough = (parseRgba(style.backgroundColor)?.a ?? 1) < 1;
        ctx.fillStyle = style.borderTopColor;
        traceShape(ctx, shape, 0);
        if (seeThrough) traceShape(ctx, shape, border, false);
        ctx.fill(seeThrough ? 'evenodd' : 'nonzero');
    }
    ctx.fillStyle = style.backgroundColor;
    traceShape(ctx, shape, border);
    ctx.fill();

    // Background layers, then inset shadows, then content, as CSS stacks them inside a box
    paintSheen(ctx, shape, border, style);
    if (item.type === 'storage') paintStorageSeam(ctx, item, border);
    if (item.type === 'door' || item.type === 'window') paintFeatureDetail(ctx, item, style, border);
    shadows.filter(shadow => shadow.inset).forEach(shadow => paintInsetShadow(ctx, shape, border, shadow, 1));

    if (item.type === 'storage') paintStorageHandles(ctx, item, el, border);
    if (['poster', 'corner-lamp', 'socket'].includes(item.type)) paintAfterLayer(ctx, item, el, border);
    paintItemLabel(ctx, item, el);
}

export function paintCaption(ctx, fontFamily) {
    const text = `${state.wallWidthCm} x ${state.wallHeightCm} cm | Scale 1:1 cm`;
    const margin = 10;
    const height = 20;
    ctx.font = `600 11px ${fontFamily}`;
    const width = ctx.measureText(text).width + 16;
    const top = state.wallHeightPx - margin - height;

    ctx.fillStyle = state.isAmbientMode ? 'rgba(15, 17, 21, 0.72)' : 'rgba(255, 255, 255, 0.82)';
    traceShape(ctx, { x: margin, y: top, w: width, h: height, radius: 4, ellipse: false }, 0);
    ctx.fill();

    ctx.fillStyle = state.isAmbientMode ? 'rgba(243, 244, 246, 0.8)' : 'rgba(17, 24, 39, 0.75)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, margin + 8, top + height / 2);
}

export function exportPng() {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(state.wallWidthPx * PNG_PIXEL_RATIO);
    canvas.height = Math.round(state.wallHeightPx * PNG_PIXEL_RATIO);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        showIoStatus('PNG export failed: canvas is unavailable.', 'error');
        return;
    }

    const fontFamily = getComputedStyle(document.body).fontFamily;
    const brightness = Number(brightnessSlider.value) / 100;
    ctx.scale(PNG_PIXEL_RATIO, PNG_PIXEL_RATIO);

    // Same stacking as the live wall: background, attic zone, corner glow, then items in layer order
    paintWallBackground(ctx);
    if (atticSlopeToggle.checked) paintAtticZone(ctx, fontFamily);
    if (state.isAmbientMode && brightness > 0) paintCornerGlow(ctx, brightness);
    // Hidden items stay in the plan but leave the picture, just as they leave the wall view
    state.wallItems.filter(item => !item.hidden).forEach(item => paintItem(ctx, item, brightness));
    paintCaption(ctx, fontFamily);

    canvas.toBlob(blob => {
        if (!blob) {
            showIoStatus('PNG export failed.', 'error');
            return;
        }
        downloadBlob(blob, PNG_FILENAME);
        showIoStatus('Plan exported as PNG.', 'success');
    }, 'image/png');
}
