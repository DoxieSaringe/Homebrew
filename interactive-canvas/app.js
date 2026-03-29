/* ============================================================
   Shape Canvas — app.js
   Projection-mapping style canvas. Create rectangles and
   circles, resize them, skew them by dragging corners, and
   attach images or YouTube videos that warp to fit.
   ============================================================ */

'use strict';

/* ============================================================
   State
   ============================================================ */
const state = {
  shapes: [],     // Shape[]
  selectedId: null,
  nextZ: 1,
  dragContext: null,  // active drag info
  modalShapeId: null, // which shape the media modal is for
};

const STORAGE_KEY = 'interactive-canvas-v1';

/* ============================================================
   Homography math
   Maps unit square (0,0)-(1,0)-(1,1)-(0,1) to 4 destination
   corner points. Returns a flat 9-element row-major 3x3 matrix.
   ============================================================ */
function computeHomography(corners) {
  const [p0, p1, p2, p3] = corners;
  const x0 = p0.x, y0 = p0.y;
  const x1 = p1.x, y1 = p1.y;
  const x2 = p2.x, y2 = p2.y;
  const x3 = p3.x, y3 = p3.y;

  const dx1 = x1 - x2, dy1 = y1 - y2;
  const dx2 = x3 - x2, dy2 = y3 - y2;
  const dx3 = x0 - x1 + x2 - x3;
  const dy3 = y0 - y1 + y2 - y3;

  const det = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(det) < 1e-8) return null; // degenerate quad

  const h13 = (dx3 * dy2 - dy3 * dx2) / det;
  const h23 = (dx1 * dy3 - dy1 * dx3) / det;

  return [
    x1 - x0 + h13 * x1,  x3 - x0 + h23 * x3,  x0,
    y1 - y0 + h13 * y1,  y3 - y0 + h23 * y3,  y0,
    h13,                   h23,                   1,
  ];
}

/* Convert a flat 9-element row-major 3x3 matrix to a CSS
   matrix3d string (4x4 column-major). */
function homographyToCssMatrix(h) {
  // Embed the 3x3 projective matrix into a 4x4, inserting an
  // identity pass-through for the Z axis.
  // CSS matrix3d column order: c0r0,c0r1,c0r2,c0r3, c1r0,...
  return [
    h[0], h[3], 0, h[6],   // col 0
    h[1], h[4], 0, h[7],   // col 1
    0,    0,    1, 0,       // col 2  (Z identity)
    h[2], h[5], 0, h[8],   // col 3
  ].join(',');
}

/* ============================================================
   Canvas coordinate helpers
   ============================================================ */
const canvas = document.getElementById('canvas');

function canvasRect() {
  return canvas.getBoundingClientRect();
}

function toCanvasCoords(clientX, clientY) {
  const r = canvasRect();
  return { x: clientX - r.left, y: clientY - r.top };
}

/* ============================================================
   Default corners — centred rectangle in the canvas
   ============================================================ */
function defaultCorners(w = 280, h = 180) {
  const r = canvasRect();
  const cx = r.width / 2;
  const cy = r.height / 2;
  return [
    { x: cx - w / 2, y: cy - h / 2 }, // TL
    { x: cx + w / 2, y: cy - h / 2 }, // TR
    { x: cx + w / 2, y: cy + h / 2 }, // BR
    { x: cx - w / 2, y: cy + h / 2 }, // BL
  ];
}

/* ============================================================
   Bounding box of 4 corners
   ============================================================ */
function getBBox(corners) {
  const xs = corners.map(c => c.x);
  const ys = corners.map(c => c.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

/* ============================================================
   YouTube URL parsing
   ============================================================ */
function parseYoutubeId(url) {
  const patterns = [
    /youtube\.com\/watch\?.*v=([^&#]+)/,
    /youtu\.be\/([^?#]+)/,
    /youtube\.com\/embed\/([^?#]+)/,
    /youtube\.com\/shorts\/([^?#]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function youtubeEmbedUrl(id) {
  const p = new URLSearchParams({
    autoplay: '1',
    controls: '1',
    rel: '0',
    modestbranding: '1',
    loop: '1',
    playlist: id,
    enablejsapi: '0',
  });
  return `https://www.youtube.com/embed/${id}?${p}`;
}

function isImageUrl(url) {
  return /\.(png|jpe?g|gif|webp|svg|bmp|avif)(\?.*)?$/i.test(url) ||
    url.startsWith('data:image/');
}

function parseMediaUrl(raw) {
  const url = raw.trim();
  if (!url) return null;
  const ytId = parseYoutubeId(url);
  if (ytId) {
    return { type: 'youtube', url, embedId: ytId };
  }
  return { type: 'image', url, embedId: null };
}

/* ============================================================
   Shape creation
   ============================================================ */
function createShape(type) {
  return {
    id: crypto.randomUUID(),
    type,                       // 'rect' | 'circle'
    corners: defaultCorners(),
    media: null,
    zIndex: state.nextZ++,
  };
}

/* ============================================================
   Render shape — builds the entire DOM subtree for one shape
   ============================================================ */
function renderShape(shape) {
  // Remove existing DOM if re-rendering
  const existing = document.querySelector(`[data-id="${shape.id}"]`);
  if (existing) existing.remove();

  const wrapper = document.createElement('div');
  wrapper.className = 'shape-wrapper edit-mode';
  wrapper.dataset.id = shape.id;
  wrapper.style.zIndex = shape.zIndex;

  // ── SVG outline ─────────────────────────────────────────
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('shape-outline');
  const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  poly.classList.add('quad-poly');
  svg.appendChild(poly);
  wrapper.appendChild(svg);

  // ── Content layer ────────────────────────────────────────
  const content = document.createElement('div');
  content.className = 'shape-content' + (shape.type === 'circle' ? ' is-circle' : '');

  // Placeholder (shown when no media)
  const placeholder = document.createElement('div');
  placeholder.className = 'shape-placeholder';
  content.appendChild(placeholder);

  wrapper.appendChild(content);

  // ── iframe shield ────────────────────────────────────────
  const shield = document.createElement('div');
  shield.className = 'iframe-shield';
  wrapper.appendChild(shield);

  // ── Move handle (invisible overlay at centre) ────────────
  const moveHandle = document.createElement('div');
  moveHandle.className = 'move-handle';
  wrapper.appendChild(moveHandle);

  // ── Corner handles ────────────────────────────────────────
  for (let i = 0; i < 4; i++) {
    const h = document.createElement('div');
    h.className = 'handle corner-handle';
    h.dataset.corner = i;
    wrapper.appendChild(h);
  }

  // ── Edge handles ─────────────────────────────────────────
  for (let i = 0; i < 4; i++) {
    const h = document.createElement('div');
    h.className = 'handle edge-handle';
    h.dataset.edge = i;
    wrapper.appendChild(h);
  }

  // ── Toolbar ───────────────────────────────────────────────
  const toolbar = document.createElement('div');
  toolbar.className = 'shape-toolbar';

  const btnMedia = document.createElement('button');
  btnMedia.className = 'btn-media-attach';
  btnMedia.title = 'Attach image or YouTube video';
  btnMedia.textContent = '+';
  toolbar.appendChild(btnMedia);

  const btnFront = document.createElement('button');
  btnFront.className = 'btn-front';
  btnFront.title = 'Bring to front';
  btnFront.innerHTML = '&#8679;';
  toolbar.appendChild(btnFront);

  const btnDel = document.createElement('button');
  btnDel.className = 'btn-delete';
  btnDel.title = 'Delete shape';
  btnDel.innerHTML = '&times;';
  toolbar.appendChild(btnDel);

  const btnPlay = document.createElement('button');
  btnPlay.className = 'btn-play-toggle';
  btnPlay.title = 'Switch between edit and play mode';
  btnPlay.textContent = '▶ Play';
  btnPlay.style.display = 'none'; // hidden until media attached
  toolbar.appendChild(btnPlay);

  const label = document.createElement('span');
  label.className = 'shape-label';
  label.textContent = shape.type === 'circle' ? 'Circle' : 'Rect';
  toolbar.appendChild(label);

  wrapper.appendChild(toolbar);

  canvas.appendChild(wrapper);

  // ── Wire events ───────────────────────────────────────────
  wireShapeEvents(shape, wrapper);

  // ── Initial DOM update ────────────────────────────────────
  updateShapeDOM(shape);
  if (shape.media) applyMedia(shape);
}

/* ============================================================
   Wire all interactive events for a shape
   ============================================================ */
function wireShapeEvents(shape, wrapper) {
  // Select on any interaction
  wrapper.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.shape-toolbar')) return;
    selectShape(shape.id);
  });

  // Corner handle drag
  wrapper.querySelectorAll('.corner-handle').forEach(h => {
    h.addEventListener('pointerdown', e => {
      e.stopPropagation();
      e.preventDefault();
      h.setPointerCapture(e.pointerId);
      selectShape(shape.id);
      state.dragContext = {
        type: 'corner',
        shapeId: shape.id,
        cornerIndex: parseInt(h.dataset.corner),
      };
    });
  });

  // Edge handle drag
  wrapper.querySelectorAll('.edge-handle').forEach(h => {
    h.addEventListener('pointerdown', e => {
      e.stopPropagation();
      e.preventDefault();
      h.setPointerCapture(e.pointerId);
      selectShape(shape.id);
      const edgeMap = [[0,1],[1,2],[2,3],[3,0]];
      state.dragContext = {
        type: 'edge',
        shapeId: shape.id,
        edgeIndex: parseInt(h.dataset.edge),
        cornerPair: edgeMap[parseInt(h.dataset.edge)],
        startPointer: null,
        startCorners: null,
      };
    });
  });

  // Move handle drag
  const moveHandle = wrapper.querySelector('.move-handle');
  moveHandle.addEventListener('pointerdown', e => {
    e.stopPropagation();
    e.preventDefault();
    moveHandle.setPointerCapture(e.pointerId);
    selectShape(shape.id);
    const c = toCanvasCoords(e.clientX, e.clientY);
    state.dragContext = {
      type: 'move',
      shapeId: shape.id,
      startPointer: c,
      startCorners: shape.corners.map(p => ({ ...p })),
    };
  });

  // Toolbar buttons
  wrapper.querySelector('.btn-media-attach').addEventListener('click', e => {
    e.stopPropagation();
    showMediaModal(shape.id);
  });

  wrapper.querySelector('.btn-front').addEventListener('click', e => {
    e.stopPropagation();
    shape.zIndex = state.nextZ++;
    wrapper.style.zIndex = shape.zIndex;
    saveState();
  });

  wrapper.querySelector('.btn-delete').addEventListener('click', e => {
    e.stopPropagation();
    deleteShape(shape.id);
  });

  wrapper.querySelector('.btn-play-toggle').addEventListener('click', e => {
    e.stopPropagation();
    const isEdit = wrapper.classList.contains('edit-mode');
    setEditMode(wrapper, !isEdit);
    e.currentTarget.textContent = isEdit ? '✎ Edit' : '▶ Play';
  });
}

/* ============================================================
   updateShapeDOM — reposition handles + outline from corners
   ============================================================ */
function updateShapeDOM(shape) {
  const wrapper = document.querySelector(`[data-id="${shape.id}"]`);
  if (!wrapper) return;
  const corners = shape.corners;

  // SVG outline
  const poly = wrapper.querySelector('.quad-poly');
  poly.setAttribute('points', corners.map(c => `${c.x},${c.y}`).join(' '));

  // Corner handles
  wrapper.querySelectorAll('.corner-handle').forEach(h => {
    const i = parseInt(h.dataset.corner);
    h.style.left = corners[i].x + 'px';
    h.style.top  = corners[i].y + 'px';
  });

  // Edge handles (midpoints of each edge: TL-TR, TR-BR, BR-BL, BL-TL)
  const edgeMap = [[0,1],[1,2],[2,3],[3,0]];
  wrapper.querySelectorAll('.edge-handle').forEach(h => {
    const i = parseInt(h.dataset.edge);
    const [a, b] = edgeMap[i];
    const mx = (corners[a].x + corners[b].x) / 2;
    const my = (corners[a].y + corners[b].y) / 2;
    h.style.left = mx + 'px';
    h.style.top  = my + 'px';
  });

  // Move handle — positioned over the bounding-box centre
  const bbox = getBBox(corners);
  const moveHandle = wrapper.querySelector('.move-handle');
  const mw = Math.max(bbox.w * 0.5, 30);
  const mh = Math.max(bbox.h * 0.5, 30);
  moveHandle.style.left   = (bbox.minX + bbox.w / 2 - mw / 2) + 'px';
  moveHandle.style.top    = (bbox.minY + bbox.h / 2 - mh / 2) + 'px';
  moveHandle.style.width  = mw + 'px';
  moveHandle.style.height = mh + 'px';

  // Toolbar — above the TL corner
  const toolbar = wrapper.querySelector('.shape-toolbar');
  const tlx = Math.min(corners[0].x, corners[3].x);
  const tly = Math.min(corners[0].y, corners[1].y);
  toolbar.style.left = Math.max(0, tlx) + 'px';
  toolbar.style.top  = Math.max(0, tly - 34) + 'px';

  // Placeholder inside content div (no media state)
  applyContentTransform(shape);
}

/* ============================================================
   applyContentTransform — compute and apply matrix3d
   ============================================================ */
function applyContentTransform(shape) {
  const wrapper = document.querySelector(`[data-id="${shape.id}"]`);
  if (!wrapper) return;
  const content = wrapper.querySelector('.shape-content');
  const corners = shape.corners;

  const bbox = getBBox(corners);
  if (bbox.w < 2 || bbox.h < 2) return;

  // Local corners (relative to bounding box origin)
  const local = corners.map(c => ({
    x: c.x - bbox.minX,
    y: c.y - bbox.minY,
  }));

  const H = computeHomography(local);
  if (!H) return; // degenerate

  const cssMatrix = homographyToCssMatrix(H);

  // Position content div at bounding-box origin
  content.style.left      = bbox.minX + 'px';
  content.style.top       = bbox.minY + 'px';
  content.style.transform = `matrix3d(${cssMatrix})`;

  // Size the media / placeholder element
  const mediaEl = content.querySelector('.media-el');
  if (mediaEl) {
    mediaEl.style.width  = bbox.w + 'px';
    mediaEl.style.height = bbox.h + 'px';
  }

  // Size placeholder
  const placeholder = content.querySelector('.shape-placeholder');
  if (placeholder) {
    placeholder.style.width  = bbox.w + 'px';
    placeholder.style.height = bbox.h + 'px';
  }

  // iframe shield mirrors media position
  const shield = wrapper.querySelector('.iframe-shield');
  if (shield) {
    shield.style.left   = bbox.minX + 'px';
    shield.style.top    = bbox.minY + 'px';
    shield.style.width  = bbox.w + 'px';
    shield.style.height = bbox.h + 'px';
  }
}

/* ============================================================
   applyMedia — inject img or iframe into the content layer
   ============================================================ */
function applyMedia(shape) {
  const wrapper = document.querySelector(`[data-id="${shape.id}"]`);
  if (!wrapper) return;
  const content = wrapper.querySelector('.shape-content');

  // Remove existing media element
  const existing = content.querySelector('.media-el');
  if (existing) existing.remove();

  const placeholder = content.querySelector('.shape-placeholder');

  if (!shape.media) {
    if (placeholder) placeholder.style.display = '';
    wrapper.querySelector('.btn-play-toggle').style.display = 'none';
    applyContentTransform(shape);
    return;
  }

  if (placeholder) placeholder.style.display = 'none';

  const bbox = getBBox(shape.corners);
  let el;

  if (shape.media.type === 'youtube') {
    el = document.createElement('iframe');
    el.src = youtubeEmbedUrl(shape.media.embedId);
    el.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
    el.setAttribute('allowfullscreen', '');
    el.setAttribute('frameborder', '0');
  } else {
    el = document.createElement('img');
    el.src = shape.media.url;
    el.alt = '';
    el.draggable = false;
  }

  el.className = 'media-el';
  el.style.width  = bbox.w + 'px';
  el.style.height = bbox.h + 'px';
  el.style.pointerEvents = 'none'; // controlled by shield

  content.appendChild(el);

  // Show play toggle
  wrapper.querySelector('.btn-play-toggle').style.display = '';
  // Default: edit mode (shield active, video draggable)
  setEditMode(wrapper, true);
  wrapper.querySelector('.btn-play-toggle').textContent = '▶ Play';

  applyContentTransform(shape);
}

/* ============================================================
   setEditMode — toggle iframe-shield on/off
   ============================================================ */
function setEditMode(wrapper, isEdit) {
  wrapper.classList.toggle('edit-mode', isEdit);
  const mediaEl = wrapper.querySelector('.media-el');
  if (mediaEl) {
    mediaEl.style.pointerEvents = isEdit ? 'none' : 'all';
  }
}

/* ============================================================
   Select / deselect
   ============================================================ */
function selectShape(id) {
  if (state.selectedId === id) return;
  // Deselect old
  if (state.selectedId) {
    const old = document.querySelector(`[data-id="${state.selectedId}"]`);
    if (old) old.classList.remove('selected');
  }
  state.selectedId = id;
  if (id) {
    const wrapper = document.querySelector(`[data-id="${id}"]`);
    if (wrapper) wrapper.classList.add('selected');
  }
}

function deselectAll() {
  selectShape(null);
}

/* ============================================================
   Delete shape
   ============================================================ */
function deleteShape(id) {
  state.shapes = state.shapes.filter(s => s.id !== id);
  const wrapper = document.querySelector(`[data-id="${id}"]`);
  if (wrapper) wrapper.remove();
  if (state.selectedId === id) state.selectedId = null;
  saveState();
}

/* ============================================================
   Global pointer events for drag
   ============================================================ */
window.addEventListener('pointermove', e => {
  const dc = state.dragContext;
  if (!dc) return;

  const shape = state.shapes.find(s => s.id === dc.shapeId);
  if (!shape) return;

  const pt = toCanvasCoords(e.clientX, e.clientY);

  if (dc.type === 'corner') {
    shape.corners[dc.cornerIndex] = pt;
    updateShapeDOM(shape);
  } else if (dc.type === 'edge') {
    if (!dc.startPointer) {
      dc.startPointer = pt;
      dc.startCorners = shape.corners.map(c => ({ ...c }));
      return;
    }
    const dx = pt.x - dc.startPointer.x;
    const dy = pt.y - dc.startPointer.y;
    const [a, b] = dc.cornerPair;
    shape.corners[a] = { x: dc.startCorners[a].x + dx, y: dc.startCorners[a].y + dy };
    shape.corners[b] = { x: dc.startCorners[b].x + dx, y: dc.startCorners[b].y + dy };
    updateShapeDOM(shape);
  } else if (dc.type === 'move') {
    const dx = pt.x - dc.startPointer.x;
    const dy = pt.y - dc.startPointer.y;
    shape.corners = dc.startCorners.map(c => ({ x: c.x + dx, y: c.y + dy }));
    updateShapeDOM(shape);
  }
});

window.addEventListener('pointerup', () => {
  if (state.dragContext) {
    state.dragContext = null;
    saveState();
  }
});

// Click on canvas background → deselect
canvas.addEventListener('pointerdown', e => {
  if (e.target === canvas) deselectAll();
});

// Keyboard shortcuts
window.addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement) return;
  if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedId) {
    deleteShape(state.selectedId);
  }
  if (e.key === 'Escape') deselectAll();
  if (e.key === 'f' || e.key === 'F') {
    if (state.selectedId) {
      const shape = state.shapes.find(s => s.id === state.selectedId);
      if (shape) {
        shape.zIndex = state.nextZ++;
        const wrapper = document.querySelector(`[data-id="${shape.id}"]`);
        if (wrapper) wrapper.style.zIndex = shape.zIndex;
        saveState();
      }
    }
  }
});

/* ============================================================
   Media Modal
   ============================================================ */
const mediaModal   = document.getElementById('media-modal');
const mediaInput   = document.getElementById('media-url-input');
const mediaPreview = document.getElementById('media-preview');

function showMediaModal(shapeId) {
  state.modalShapeId = shapeId;
  const shape = state.shapes.find(s => s.id === shapeId);
  mediaInput.value = shape?.media?.url ?? '';
  mediaPreview.hidden = true;
  mediaPreview.innerHTML = '';

  const btnRemove = document.getElementById('btn-media-remove');
  btnRemove.hidden = !shape?.media;

  mediaModal.hidden = false;
  setTimeout(() => mediaInput.focus(), 50);
  updateMediaPreview();
}

function hideMediaModal() {
  mediaModal.hidden = true;
  state.modalShapeId = null;
  mediaInput.value = '';
  mediaPreview.hidden = true;
  mediaPreview.innerHTML = '';
}

function updateMediaPreview() {
  const url = mediaInput.value.trim();
  mediaPreview.hidden = true;
  mediaPreview.innerHTML = '';
  if (!url) return;

  const ytId = parseYoutubeId(url);
  if (ytId) {
    mediaPreview.hidden = false;
    const div = document.createElement('div');
    div.className = 'preview-yt';
    div.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="#ff0000">
        <path d="M23.5 6.5a3 3 0 0 0-2.1-2.1C19.5 4 12 4 12 4s-7.5 0-9.4.5A3 3 0 0 0 .5 6.5C0 8.4 0 12 0 12s0 3.6.5 5.5a3 3 0 0 0 2.1 2.1C4.5 20 12 20 12 20s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1C24 15.6 24 12 24 12s0-3.6-.5-5.5z"/>
        <polygon fill="white" points="9.75,15.02 15.5,12 9.75,8.98"/>
      </svg>
      YouTube video detected — ID: ${ytId}
    `;
    mediaPreview.appendChild(div);
    return;
  }

  if (url.startsWith('http') || url.startsWith('data:image')) {
    const img = document.createElement('img');
    img.src = url;
    img.onerror = () => { mediaPreview.hidden = true; };
    img.onload = () => { mediaPreview.hidden = false; };
    mediaPreview.appendChild(img);
  }
}

mediaInput.addEventListener('input', updateMediaPreview);

document.getElementById('btn-media-cancel').addEventListener('click', hideMediaModal);

document.getElementById('btn-media-remove').addEventListener('click', () => {
  const shape = state.shapes.find(s => s.id === state.modalShapeId);
  if (shape) {
    shape.media = null;
    applyMedia(shape);
    saveState();
  }
  hideMediaModal();
});

document.getElementById('btn-media-attach').addEventListener('click', () => {
  const url = mediaInput.value.trim();
  if (!url) { hideMediaModal(); return; }

  const parsed = parseMediaUrl(url);
  if (!parsed) { hideMediaModal(); return; }

  const shape = state.shapes.find(s => s.id === state.modalShapeId);
  if (shape) {
    shape.media = parsed;
    applyMedia(shape);
    saveState();
  }
  hideMediaModal();
});

// Close modal on backdrop click
mediaModal.addEventListener('pointerdown', e => {
  if (e.target === mediaModal) hideMediaModal();
});

// Enter key in input
mediaInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-media-attach').click();
  if (e.key === 'Escape') hideMediaModal();
});

/* ============================================================
   Clear all confirm modal
   ============================================================ */
const confirmModal = document.getElementById('confirm-modal');

document.getElementById('btn-clear').addEventListener('click', () => {
  if (state.shapes.length === 0) return;
  confirmModal.hidden = false;
});

document.getElementById('btn-confirm-cancel').addEventListener('click', () => {
  confirmModal.hidden = true;
});

document.getElementById('btn-confirm-ok').addEventListener('click', () => {
  state.shapes.forEach(s => {
    const w = document.querySelector(`[data-id="${s.id}"]`);
    if (w) w.remove();
  });
  state.shapes = [];
  state.selectedId = null;
  confirmModal.hidden = true;
  saveState();
});

confirmModal.addEventListener('pointerdown', e => {
  if (e.target === confirmModal) confirmModal.hidden = true;
});

/* ============================================================
   Add shape buttons
   ============================================================ */
document.getElementById('btn-add-rect').addEventListener('click', () => {
  const shape = createShape('rect');
  state.shapes.push(shape);
  renderShape(shape);
  selectShape(shape.id);
  saveState();
});

document.getElementById('btn-add-circle').addEventListener('click', () => {
  const shape = createShape('circle');
  state.shapes.push(shape);
  renderShape(shape);
  selectShape(shape.id);
  saveState();
});

/* ============================================================
   Fullscreen
   ============================================================ */
document.getElementById('btn-fullscreen').addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
});

/* ============================================================
   Persistence
   ============================================================ */
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      shapes: state.shapes,
      nextZ: state.nextZ,
    }));
  } catch (e) {
    console.warn('Could not save state:', e);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    state.shapes = saved.shapes || [];
    state.nextZ  = saved.nextZ  || 1;
    state.shapes.forEach(shape => renderShape(shape));
  } catch (e) {
    console.warn('Could not load saved state:', e);
  }
}

window.addEventListener('beforeunload', saveState);

/* ============================================================
   Init
   ============================================================ */
function init() {
  loadState();
  // Add a hint shape if canvas is empty
  if (state.shapes.length === 0) {
    // no-op, clean canvas
  }
}

init();
