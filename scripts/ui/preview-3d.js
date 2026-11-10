import { clamp, isFeature, isLedOn, OBJ_FILENAME, SCALE, wallPaintById } from '../core/constants.js';
import {
    atticSlopeToggle, brightnessSlider, close3dBtn, exportObjBtn, isModalOpen, ledColorOf, orbitPitchSlider, orbitPitchValue,
    orbitYawSlider, orbitYawValue, preview3dBtn, preview3dCanvas, preview3dModal, reset3dCameraBtn, wireframe3dToggle
} from '../core/dom.js';
import { isPointerBusy, state } from '../core/state.js';
import { closeOnBackdropClick, downloadBlob, showIoStatus } from '../io/projects-spec.js';

const DEFAULT_YAW = -28;
const DEFAULT_PITCH = 22;
const YAW_LIMITS = [-60, 60];
const PITCH_LIMITS = [10, 45];
const WALL_SLAB_CM = 10;
const FLOOR_DEPTH_CM = 80;
const FLOOR_GRID_CM = 20;
const DRAG_DEG_PER_PX = 0.35;
const FIT_PADDING_PX = 28;
// Light comes from the upper left, slightly in front of the wall
const LIGHT = normalize([-0.45, 0.8, 0.55]);

const FINISH_COLORS = { walnut: '#8a5a3b', oak: '#c89d66', black: '#3f444e', white: '#e5e7eb' };
const FEATURE_COLORS = { socket: '#cbd5e1', door: '#64748b', window: '#60a5fa', tv: '#1f2937', note: '#facc15' };

const camera = { yaw: DEFAULT_YAW, pitch: DEFAULT_PITCH, wireframe: false };
const orbit = { active: false, startX: 0, startY: 0, startYaw: 0, startPitch: 0, pointerX: 0, pointerY: 0, frameId: 0 };

function normalize([x, y, z]) {
    const length = Math.hypot(x, y, z) || 1;
    return [x / length, y / length, z / length];
}

const sceneItems = () => state.wallItems.filter(item => !item.hidden);

// Wall px with y down become cm with y up from the floor, extruded from the wall plane at z = 0
function itemBox(item) {
    const x0 = item.left / SCALE;
    const x1 = (item.left + item.width) / SCALE;
    const y0 = state.wallHeightCm - (item.top + item.height) / SCALE;
    const y1 = state.wallHeightCm - item.top / SCALE;
    return { x0, x1, y0, y1, z0: 0, z1: Math.max(1, item.depth ?? 0) };
}

const boxProfile = ({ x0, x1, y0, y1 }) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

// Counter-clockwise in x / y-up, so the side faces below get outward normals
function wallProfile() {
    const w = state.wallWidthCm;
    const h = state.wallHeightCm;
    if (!atticSlopeToggle.checked) return [[0, 0], [w, 0], [w, h], [0, h]];
    const aw = Math.min(state.atticWidthCm, w);
    const ah = Math.min(state.atticHeightCm, h);
    return [[0, 0], [w, 0], [w, h - ah], [w - aw, h], [0, h]];
}

// A prism over a CCW profile: front cap at z1, back cap at z0, one quad per profile edge
function prismFaces(profile, z0, z1) {
    const faces = [
        { points: profile.map(([x, y]) => [x, y, z1]), normal: [0, 0, 1] },
        { points: [...profile].reverse().map(([x, y]) => [x, y, z0]), normal: [0, 0, -1] }
    ];
    profile.forEach(([ax, ay], i) => {
        const [bx, by] = profile[(i + 1) % profile.length];
        faces.push({
            points: [[ax, ay, z1], [ax, ay, z0], [bx, by, z0], [bx, by, z1]],
            normal: normalize([by - ay, ax - bx, 0])
        });
    });
    return faces;
}

function createProjector(width, height) {
    const yaw = camera.yaw * Math.PI / 180;
    const pitch = camera.pitch * Math.PI / 180;
    const [cy, sy, cp, sp] = [Math.cos(yaw), Math.sin(yaw), Math.cos(pitch), Math.sin(pitch)];
    const center = [state.wallWidthCm / 2, state.wallHeightCm / 2, (FLOOR_DEPTH_CM - WALL_SLAB_CM) / 2];

    // Yaw turns about the vertical axis, then pitch tilts the view down; larger z means nearer the viewer
    const rotate = ([x, y, z]) => {
        const x1 = x * cy + z * sy;
        const z1 = -x * sy + z * cy;
        return [x1, y * cp - z1 * sp, y * sp + z1 * cp];
    };
    const view = (p) => rotate([p[0] - center[0], p[1] - center[1], p[2] - center[2]]);

    // Fit the whole room, floor strip and the deepest allowed item included, into the canvas
    const w = state.wallWidthCm;
    const h = state.wallHeightCm;
    let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
    [0, w].forEach(x => [0, h].forEach(y => [-WALL_SLAB_CM, FLOOR_DEPTH_CM].forEach(z => {
        const [vx, vy] = view([x, y, z]);
        minX = Math.min(minX, vx); maxX = Math.max(maxX, vx);
        minY = Math.min(minY, vy); maxY = Math.max(maxY, vy);
    })));
    const scale = Math.min((width - 2 * FIT_PADDING_PX) / (maxX - minX), (height - 2 * FIT_PADDING_PX) / (maxY - minY));
    const offsetX = width / 2 - ((minX + maxX) / 2) * scale;
    const offsetY = height / 2 + ((minY + maxY) / 2) * scale;

    return {
        project(p) {
            const [vx, vy, vz] = view(p);
            return [offsetX + vx * scale, offsetY - vy * scale, vz];
        },
        facesViewer: (normal) => rotate(normal)[2] > 1e-6,
        depthOf: (p) => view(p)[2]
    };
}

function hexToRgb(hex) {
    const value = parseInt(hex.slice(1), 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function shade(hex, normal, alpha = 1) {
    const light = 0.5 + 0.55 * Math.max(0, normal[0] * LIGHT[0] + normal[1] * LIGHT[1] + normal[2] * LIGHT[2]);
    const [r, g, b] = hexToRgb(hex).map(c => Math.round(clamp(c * light, 0, 255)));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function tracePolygon(ctx, projector, points) {
    ctx.beginPath();
    points.forEach((p, i) => {
        const [x, y] = projector.project(p);
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
    });
    ctx.closePath();
}

function drawPrism(ctx, projector, faces, color, edge) {
    faces.forEach(face => {
        const visible = projector.facesViewer(face.normal);
        if (camera.wireframe) {
            tracePolygon(ctx, projector, face.points);
            ctx.globalAlpha = visible ? 1 : 0.28;
            ctx.strokeStyle = edge;
            ctx.stroke();
            ctx.globalAlpha = 1;
            return;
        }
        // A convex prism with its back faces culled needs no sorting of its own faces
        if (!visible) return;
        tracePolygon(ctx, projector, face.points);
        ctx.fillStyle = shade(color, face.normal);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
        ctx.stroke();
    });
}

function drawFloorGrid(ctx, projector, ambient) {
    const w = state.wallWidthCm;
    ctx.lineWidth = 1;
    ctx.strokeStyle = ambient ? 'rgba(148, 163, 184, 0.18)' : 'rgba(71, 85, 105, 0.22)';
    tracePolygon(ctx, projector, [[0, 0, 0], [w, 0, 0], [w, 0, FLOOR_DEPTH_CM], [0, 0, FLOOR_DEPTH_CM]]);
    ctx.fillStyle = ambient ? 'rgba(148, 163, 184, 0.05)' : 'rgba(71, 85, 105, 0.06)';
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    for (let x = 0; x <= w; x += FLOOR_GRID_CM) {
        const [ax, ay] = projector.project([x, 0, 0]);
        const [bx, by] = projector.project([x, 0, FLOOR_DEPTH_CM]);
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
    }
    for (let z = FLOOR_GRID_CM; z < FLOOR_DEPTH_CM; z += FLOOR_GRID_CM) {
        const [ax, ay] = projector.project([0, 0, z]);
        const [bx, by] = projector.project([w, 0, z]);
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
    }
    ctx.stroke();
}

function drawAtticEdge(ctx, projector) {
    if (!atticSlopeToggle.checked) return;
    const w = state.wallWidthCm;
    const h = state.wallHeightCm;
    const aw = Math.min(state.atticWidthCm, w);
    const ah = Math.min(state.atticHeightCm, h);
    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = 'rgba(248, 113, 113, 0.85)';
    ctx.lineWidth = 1.5;
    tracePolygon(ctx, projector, [[w - aw, h, 0], [w, h - ah, 0], [w, h, 0]]);
    ctx.stroke();
    ctx.restore();
}

function drawGlow(ctx, projector, item, color) {
    const box = itemBox(item);
    const brightness = Number(brightnessSlider.value) / 100;
    ctx.save();
    ctx.globalAlpha = 0.55 * brightness;
    ctx.shadowColor = color;
    ctx.shadowBlur = 28;
    ctx.fillStyle = color;
    tracePolygon(ctx, projector, boxProfile(box).map(([x, y]) => [x, y, 0]));
    ctx.fill();
    ctx.restore();
}

const itemColor = (item) => (isFeature(item) ? FEATURE_COLORS[item.type] : FINISH_COLORS[item.finish]) || '#94a3b8';

export function renderPreview3d() {
    const ctx = preview3dCanvas.getContext('2d');
    const { width, height } = preview3dCanvas;
    const ambient = state.isAmbientMode;
    const paint = wallPaintById(state.wallPaint);
    const projector = createProjector(width, height);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, ambient ? '#0d1017' : '#f8fafc');
    sky.addColorStop(1, ambient ? '#05070a' : '#dfe4ea');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);
    ctx.lineJoin = 'round';
    ctx.lineWidth = 1;

    const edge = ambient ? 'rgba(226, 232, 240, 0.85)' : 'rgba(15, 23, 42, 0.8)';
    drawPrism(ctx, projector, prismFaces(wallProfile(), -WALL_SLAB_CM, 0), ambient ? paint.ambient : paint.daylight, edge);
    drawAtticEdge(ctx, projector);
    drawFloorGrid(ctx, projector, ambient);

    const items = sceneItems();
    if (ambient && !camera.wireframe) {
        items.filter(isLedOn).forEach(item => drawGlow(ctx, projector, item, ledColorOf(item)));
    }

    // Painter's algorithm: the box whose center lies furthest from the viewer is drawn first
    items
        .map(item => {
            const box = itemBox(item);
            const center = [(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2, box.z1 / 2];
            return { item, box, depth: projector.depthOf(center) };
        })
        .sort((a, b) => a.depth - b.depth)
        .forEach(({ item, box }) => drawPrism(ctx, projector, prismFaces(boxProfile(box), box.z0, box.z1), itemColor(item), edge));
}

function syncCameraControls() {
    orbitYawSlider.value = camera.yaw;
    orbitPitchSlider.value = camera.pitch;
    orbitYawValue.textContent = `${camera.yaw} deg`;
    orbitPitchValue.textContent = `${camera.pitch} deg`;
    wireframe3dToggle.setAttribute('aria-pressed', String(camera.wireframe));
}

function setCamera(yaw, pitch) {
    camera.yaw = clamp(Math.round(yaw), ...YAW_LIMITS);
    camera.pitch = clamp(Math.round(pitch), ...PITCH_LIMITS);
    syncCameraControls();
    renderPreview3d();
}

export function openPreview3d() {
    if (isModalOpen() || isPointerBusy()) return;
    syncCameraControls();
    preview3dModal.showModal();
    renderPreview3d();
}

export function togglePreview3d() {
    if (preview3dModal.open) preview3dModal.close();
    else openPreview3d();
}

const formatObjNumber = (value) => String(Number(value.toFixed(2)) + 0);

// Vertices 1-4 sit on the back plane and 5-8 on the front; faces wind counter-clockwise seen from outside
const BOX_FACES = [[1, 4, 3, 2], [5, 6, 7, 8], [1, 2, 6, 5], [4, 8, 7, 3], [1, 5, 8, 4], [2, 3, 7, 6]];

function objBox(lines, name, { x0, x1, y0, y1, z0, z1 }, offset) {
    lines.push(`o ${name}`);
    [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]
        .forEach(vertex => lines.push(`v ${vertex.map(formatObjNumber).join(' ')}`));
    BOX_FACES.forEach(face => lines.push(`f ${face.map(index => index + offset).join(' ')}`));
    return offset + 8;
}

// Centimeters, right-handed with Y up and Z pointing out of the wall toward the room
export function buildSceneObj({ wallWidthCm, wallHeightCm, items } = {
    wallWidthCm: state.wallWidthCm, wallHeightCm: state.wallHeightCm, items: state.wallItems
}) {
    const lines = [
        '# Spatial Studio 3D export',
        `# Wall ${wallWidthCm} x ${wallHeightCm} cm, units in cm, Y up, Z out of the wall`
    ];
    let offset = objBox(lines, 'Wall', { x0: 0, x1: wallWidthCm, y0: 0, y1: wallHeightCm, z0: -WALL_SLAB_CM, z1: 0 }, 0);
    items.filter(item => !item.hidden).forEach(item => {
        const xCm = item.left / SCALE;
        const yCm = item.top / SCALE;
        offset = objBox(lines, `Item_${item.id}_${item.type}`, {
            x0: xCm,
            x1: xCm + item.width / SCALE,
            y0: wallHeightCm - (yCm + item.height / SCALE),
            y1: wallHeightCm - yCm,
            z0: 0,
            z1: Math.max(1, item.depth ?? 0)
        }, offset);
    });
    return `${lines.join('\n')}\n`;
}

export function exportSceneObj() {
    downloadBlob(new Blob([buildSceneObj()], { type: 'model/obj' }), OBJ_FILENAME);
    showIoStatus('3D mesh exported as OBJ.', 'success');
}

function applyOrbitFrame() {
    orbit.frameId = 0;
    setCamera(
        orbit.startYaw + (orbit.pointerX - orbit.startX) * DRAG_DEG_PER_PX,
        orbit.startPitch + (orbit.pointerY - orbit.startY) * DRAG_DEG_PER_PX
    );
}

function endOrbit() {
    if (!orbit.active) return;
    if (orbit.frameId) {
        cancelAnimationFrame(orbit.frameId);
        applyOrbitFrame();
    }
    orbit.active = false;
    preview3dCanvas.classList.remove('is-orbiting');
}

export function bindPreview3dEvents() {
    preview3dBtn.addEventListener('click', openPreview3d);
    close3dBtn.addEventListener('click', () => preview3dModal.close());
    exportObjBtn.addEventListener('click', exportSceneObj);
    reset3dCameraBtn.addEventListener('click', () => setCamera(DEFAULT_YAW, DEFAULT_PITCH));
    wireframe3dToggle.addEventListener('click', () => {
        camera.wireframe = !camera.wireframe;
        syncCameraControls();
        renderPreview3d();
    });
    orbitYawSlider.addEventListener('input', () => setCamera(Number(orbitYawSlider.value), camera.pitch));
    orbitPitchSlider.addEventListener('input', () => setCamera(camera.yaw, Number(orbitPitchSlider.value)));

    preview3dCanvas.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        Object.assign(orbit, {
            active: true, startX: e.clientX, startY: e.clientY, pointerX: e.clientX, pointerY: e.clientY,
            startYaw: camera.yaw, startPitch: camera.pitch
        });
        preview3dCanvas.classList.add('is-orbiting');
    });
    window.addEventListener('mousemove', (e) => {
        if (!orbit.active) return;
        orbit.pointerX = e.clientX;
        orbit.pointerY = e.clientY;
        if (!orbit.frameId) orbit.frameId = requestAnimationFrame(applyOrbitFrame);
    });
    window.addEventListener('mouseup', endOrbit);
    window.addEventListener('blur', endOrbit);
    preview3dModal.addEventListener('close', endOrbit);

    closeOnBackdropClick(preview3dModal);
}
