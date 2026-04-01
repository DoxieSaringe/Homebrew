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
  spotifyUrl: null,
};

const STORAGE_KEY = 'interactive-canvas-v1';

function cornersCenter(corners) {
  return { x: corners.reduce((s,c)=>s+c.x,0)/4, y: corners.reduce((s,c)=>s+c.y,0)/4 };
}
function rotatePoint(pt, center, angle) {
  const cos=Math.cos(angle), sin=Math.sin(angle), dx=pt.x-center.x, dy=pt.y-center.y;
  return { x: center.x+dx*cos-dy*sin, y: center.y+dx*sin+dy*cos };
}

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

function youtubeEmbedUrl(id, loop = true, audio = true) {
  const params = {
    autoplay: '1',
    controls: '1',
    rel: '0',
    modestbranding: '1',
    enablejsapi: '0',
  };
  if (loop) {
    params.loop = '1';
    params.playlist = id; // required for loop to work
  }
  if (!audio) {
    params.mute = '1';
  }
  return `https://www.youtube.com/embed/${id}?${new URLSearchParams(params)}`;
}

function isImageUrl(url) {
  return /\.(png|jpe?g|gif|webp|svg|bmp|avif)(\?.*)?$/i.test(url) ||
    url.startsWith('data:image/');
}

function isVideoUrl(url) {
  return /\.(mp4|mov|webm|ogg|m4v)(\?.*)?$/i.test(url) ||
    url.startsWith('data:video/') || url.startsWith('blob:');
}

function parseMediaUrl(raw) {
  const url = raw.trim();
  if (!url) return null;
  const ytId = parseYoutubeId(url);
  if (ytId) return { type: 'youtube', url, embedId: ytId };
  if (isVideoUrl(url)) return { type: 'video', url };
  return { type: 'image', url, embedId: null };
}

/* ============================================================
   Shape creation
   ============================================================ */
function createShape(type) {
  return {
    id: crypto.randomUUID(),
    type,                       // 'rect' | 'circle'
    name: '',
    corners: defaultCorners(),
    media: null,
    zIndex: state.nextZ++,
    blendMode: 'normal',
    flipH: false,
    flipV: false,
    locked: false,
    filters: null,              // null = all defaults; { brightness, contrast, saturation, hue }
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
  if (shape.visible === false) wrapper.style.visibility = 'hidden';

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
  if (shape.opacity !== undefined) content.style.opacity = shape.opacity;

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

  // ── Rotation handle ───────────────────────────────────────
  const rotHandle = document.createElement('div');
  rotHandle.className = 'handle rotation-handle';
  wrapper.appendChild(rotHandle);

  // ── Rotation line in SVG (added after svg is created above) ─
  const rotLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  rotLine.classList.add('rotation-line');
  svg.appendChild(rotLine);

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

  const btnWarp = document.createElement('button');
  btnWarp.className = 'btn-warp-toggle';
  btnWarp.title = 'Warp mode — drag corners freely to skew shape';
  btnWarp.textContent = '⊹ Warp';
  if (shape.warpMode) btnWarp.classList.add('active');
  toolbar.appendChild(btnWarp);

  // Blend mode
  const blendSelect = document.createElement('select');
  blendSelect.className = 'blend-select';
  blendSelect.title = 'Blend mode (Screen = black becomes transparent)';
  [['normal','Normal'],['screen','Screen'],['multiply','Multiply'],
   ['overlay','Overlay'],['lighten','Lighten'],['difference','Difference']]
    .forEach(([v, l]) => {
      const o = document.createElement('option');
      o.value = v; o.textContent = l;
      if (v === (shape.blendMode || 'normal')) o.selected = true;
      blendSelect.appendChild(o);
    });
  toolbar.appendChild(blendSelect);

  // Flip H / V
  const btnFlipH = document.createElement('button');
  btnFlipH.className = 'btn-flip-h';
  btnFlipH.title = 'Flip horisontellt';
  btnFlipH.textContent = '↔';
  if (shape.flipH) btnFlipH.classList.add('active');
  toolbar.appendChild(btnFlipH);

  const btnFlipV = document.createElement('button');
  btnFlipV.className = 'btn-flip-v';
  btnFlipV.title = 'Flip vertikalt';
  btnFlipV.textContent = '↕';
  if (shape.flipV) btnFlipV.classList.add('active');
  toolbar.appendChild(btnFlipV);

  // FX (colour correction filters)
  const btnFx = document.createElement('button');
  btnFx.className = 'btn-fx';
  btnFx.title = 'Color correction (brightness, contrast, saturation, hue)';
  btnFx.textContent = 'FX';
  toolbar.appendChild(btnFx);

  const btnDel = document.createElement('button');
  btnDel.className = 'btn-delete';
  btnDel.title = 'Delete shape';
  btnDel.innerHTML = '&times;';
  toolbar.appendChild(btnDel);

  const btnPlay = document.createElement('button');
  btnPlay.className = 'btn-play-toggle';
  btnPlay.title = 'Switch between edit and play mode';
  btnPlay.textContent = '▶ Play';
  btnPlay.style.display = 'none';
  toolbar.appendChild(btnPlay);

  const opacitySlider = document.createElement('input');
  opacitySlider.type = 'range';
  opacitySlider.className = 'opacity-slider';
  opacitySlider.min = '0';
  opacitySlider.max = '100';
  opacitySlider.value = shape.opacity !== undefined ? Math.round(shape.opacity * 100) : 100;
  opacitySlider.title = 'Opacity';
  toolbar.appendChild(opacitySlider);

  wrapper.appendChild(toolbar);

  // ── Inline name label ─────────────────────────────────────
  const nameLabel = document.createElement('input');
  nameLabel.type = 'text';
  nameLabel.className = 'shape-name-label';
  const defaultName = shape.type === 'circle' ? 'Circle' : 'Rect';
  nameLabel.value = shape.name || defaultName;
  nameLabel.placeholder = defaultName;
  nameLabel.addEventListener('click', e => e.stopPropagation());
  nameLabel.addEventListener('pointerdown', e => e.stopPropagation());
  nameLabel.addEventListener('change', e => {
    shape.name = e.target.value.trim();
    syncLayerName(shape);
    saveState();
  });
  nameLabel.addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });
  wrapper.appendChild(nameLabel);

  // ── Filter panel (inside toolbar so position:absolute is relative to toolbar) ─
  const filterPanel = document.createElement('div');
  filterPanel.className = 'filter-panel';
  filterPanel.hidden = true;

  // Blend mode description row (updates when blend mode changes)
  const blendDescRow = document.createElement('div');
  blendDescRow.className = 'blend-desc-row';
  filterPanel.appendChild(blendDescRow);

  [['brightness','☀ Brightness','0','200','100'],
   ['contrast','◑ Contrast','0','200','100'],
   ['saturation','◈ Saturation','0','200','100'],
   ['hue','⊙ Hue','0','360','0']]
    .forEach(([name, label, min, max, def]) => {
      const row = document.createElement('label');
      row.className = 'filter-row';
      const val = shape.filters?.[name.split(' ')[0]] ?? +def;
      const span = document.createElement('span');
      span.textContent = label;
      span.className = 'filter-icon';
      const sl = document.createElement('input');
      sl.type = 'range'; sl.min = min; sl.max = max; sl.value = val;
      sl.dataset.filter = name.split(' ')[0];
      sl.title = label;
      row.appendChild(span);
      row.appendChild(sl);
      filterPanel.appendChild(row);
    });
  toolbar.appendChild(filterPanel);

  // Apply locked class from saved state
  if (shape.locked) wrapper.classList.add('locked');

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
      if (shape.locked) return;
      e.stopPropagation();
      e.preventDefault();
      h.setPointerCapture(e.pointerId);
      selectShape(shape.id);
      state.dragContext = {
        type: 'corner',
        shapeId: shape.id,
        cornerIndex: parseInt(h.dataset.corner),
        startCorners: shape.corners.map(c => ({ ...c })),
      };
    });
  });

  // Edge handle drag
  wrapper.querySelectorAll('.edge-handle').forEach(h => {
    h.addEventListener('pointerdown', e => {
      if (shape.locked) return;
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
    if (shape.locked) return;
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

  wrapper.querySelector('.btn-warp-toggle').addEventListener('click', e => {
    e.stopPropagation();
    shape.warpMode = !shape.warpMode;
    e.currentTarget.classList.toggle('active', shape.warpMode);
    wrapper.classList.toggle('warp-mode', shape.warpMode);
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

  // Opacity slider
  wrapper.querySelector('.opacity-slider').addEventListener('input', e => {
    e.stopPropagation();
    shape.opacity = parseInt(e.target.value) / 100;
    const content = wrapper.querySelector('.shape-content');
    if (content) content.style.opacity = shape.opacity;
    saveState();
  });

  // Blend mode
  wrapper.querySelector('.blend-select').addEventListener('change', e => {
    e.stopPropagation();
    shape.blendMode = e.target.value;
    applyContentEffects(shape);
    updateBlendDesc(wrapper, shape.blendMode);
    saveState();
  });

  // Flip H
  wrapper.querySelector('.btn-flip-h').addEventListener('click', e => {
    e.stopPropagation();
    shape.flipH = !shape.flipH;
    e.currentTarget.classList.toggle('active', shape.flipH);
    applyContentTransform(shape);
    saveState();
  });

  // Flip V
  wrapper.querySelector('.btn-flip-v').addEventListener('click', e => {
    e.stopPropagation();
    shape.flipV = !shape.flipV;
    e.currentTarget.classList.toggle('active', shape.flipV);
    applyContentTransform(shape);
    saveState();
  });

  // FX panel toggle
  wrapper.querySelector('.btn-fx').addEventListener('click', e => {
    e.stopPropagation();
    const panel = wrapper.querySelector('.filter-panel');
    panel.hidden = !panel.hidden;
    if (!panel.hidden) updateBlendDesc(wrapper, shape.blendMode);
    e.currentTarget.classList.toggle('active', !panel.hidden);
  });

  // Filter sliders
  wrapper.querySelector('.filter-panel').addEventListener('input', e => {
    const name = e.target.dataset.filter;
    if (!name) return;
    e.stopPropagation();
    if (!shape.filters) shape.filters = { brightness: 100, contrast: 100, saturation: 100, hue: 0 };
    shape.filters[name] = +e.target.value;
    applyContentEffects(shape);
    saveState();
  });
  wrapper.querySelector('.filter-panel').addEventListener('pointerdown', e => e.stopPropagation());

  // Rotation handle drag
  const rotHandle = wrapper.querySelector('.rotation-handle');
  if (rotHandle) {
    rotHandle.addEventListener('pointerdown', e => {
      e.stopPropagation();
      e.preventDefault();
      rotHandle.setPointerCapture(e.pointerId);
      selectShape(shape.id);
      const center = cornersCenter(shape.corners);
      const pt = toCanvasCoords(e.clientX, e.clientY);
      const startAngle = Math.atan2(pt.y - center.y, pt.x - center.x);
      state.dragContext = {
        type: 'rotate',
        shapeId: shape.id,
        center,
        startAngle,
        startCorners: shape.corners.map(p => ({ ...p })),
        };
    });
  }
}

/* ============================================================
   updateShapeDOM — reposition handles + outline from corners
   ============================================================ */
function updateShapeDOM(shape) {
  const wrapper = document.querySelector(`[data-id="${shape.id}"]`);
  if (!wrapper) return;
  const corners = shape.corners;

  // Sync warp mode class + button state
  wrapper.classList.toggle('warp-mode', shape.warpMode === true);
  const btnWarp = wrapper.querySelector('.btn-warp-toggle');
  if (btnWarp) btnWarp.classList.toggle('active', shape.warpMode === true);

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

  // Move handle — covers the full bounding box (z-index 8, above shield 6, below handles 10)
  const bbox = getBBox(corners);
  const moveHandle = wrapper.querySelector('.move-handle');
  moveHandle.style.left   = bbox.minX + 'px';
  moveHandle.style.top    = bbox.minY + 'px';
  moveHandle.style.width  = bbox.w + 'px';
  moveHandle.style.height = bbox.h + 'px';

  // Rotation handle — above midpoint of top edge
  const topMidX = (corners[0].x + corners[1].x) / 2;
  const topMidY = (corners[0].y + corners[1].y) / 2;
  const rotH = wrapper.querySelector('.rotation-handle');
  const rotL = wrapper.querySelector('.rotation-line');
  if (rotH) { rotH.style.left = topMidX+'px'; rotH.style.top = (topMidY-38)+'px'; }
  if (rotL) { rotL.setAttribute('x1',topMidX); rotL.setAttribute('y1',topMidY); rotL.setAttribute('x2',topMidX); rotL.setAttribute('y2',topMidY-38); }

  // Toolbar — above the TL corner
  const toolbar = wrapper.querySelector('.shape-toolbar');
  const tlx = Math.min(corners[0].x, corners[3].x);
  const tly = Math.min(corners[0].y, corners[1].y);
  toolbar.style.left = Math.max(0, tlx) + 'px';
  toolbar.style.top  = Math.max(0, tly - 34) + 'px';

  // Keep inline name label in sync and positioned below shape
  const nameLabel = wrapper.querySelector('.shape-name-label');
  if (nameLabel) {
    if (document.activeElement !== nameLabel) {
      nameLabel.value = shape.name || '';
      nameLabel.placeholder = shape.type === 'circle' ? 'Circle' : 'Rect';
    }
    nameLabel.style.left = Math.max(0, tlx) + 'px';
    nameLabel.style.top  = (bbox.minY + bbox.h + 6) + 'px';
    nameLabel.style.width = Math.max(60, bbox.w) + 'px';
  }

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

  // H maps the unit square (0..1) to local corners.
  // The content div and media are bboxW × bboxH px, so we must scale
  // H so it maps the pixel rectangle (0..bboxW, 0..bboxH) instead.
  // This is equivalent to pre-multiplying by Scale(1/bboxW, 1/bboxH):
  const w = bbox.w, h = bbox.h;
  const Hs = [
    H[0] / w,  H[1] / h,  H[2],
    H[3] / w,  H[4] / h,  H[5],
    H[6] / w,  H[7] / h,  H[8],
  ];

  const cssMatrix = homographyToCssMatrix(Hs);

  // Size and position the content div to the bounding box
  content.style.left      = bbox.minX + 'px';
  content.style.top       = bbox.minY + 'px';
  content.style.width     = w + 'px';
  content.style.height    = h + 'px';
  content.style.transform = `matrix3d(${cssMatrix})`;

  applyContentEffects(shape);

  // Media element fills the content div (cover for YouTube, exact for others)
  const mediaEl = content.querySelector('.media-el');
  if (mediaEl) {
    if (mediaEl.classList.contains('yt-cover')) {
      sizeYtCover(mediaEl, w, h);
    } else {
      mediaEl.style.width  = w + 'px';
      mediaEl.style.height = h + 'px';
    }
  }

  // Placeholder fills the content div
  const placeholder = content.querySelector('.shape-placeholder');
  if (placeholder) {
    placeholder.style.width  = w + 'px';
    placeholder.style.height = h + 'px';
  }

  // Shield covers the bounding box area (blocks iframe interaction in edit mode)
  const shield = wrapper.querySelector('.iframe-shield');
  if (shield) {
    shield.style.left   = bbox.minX + 'px';
    shield.style.top    = bbox.minY + 'px';
    shield.style.width  = w + 'px';
    shield.style.height = h + 'px';
  }
}

const BLEND_DESCRIPTIONS = {
  normal:     'Normal — standard compositing, no interaction with layers below',
  screen:     'Screen — black = transparent. The classic VJ / projection mapping mode',
  multiply:   'Multiply — darkens. White = invisible, black = black',
  overlay:    'Overlay — boosts contrast and saturation based on the layer below',
  lighten:    'Lighten — the brightest pixel wins (similar to Screen but harder)',
  difference: 'Difference — inverts pixels where the layers overlap',
};

function updateBlendDesc(wrapper, mode) {
  const row = wrapper.querySelector('.blend-desc-row');
  if (row) row.textContent = BLEND_DESCRIPTIONS[mode] || '';
}

/* ============================================================
   applyContentEffects — blend mode, CSS filters, flip on .shape-content / .media-el
   ============================================================ */
function applyContentEffects(shape) {
  const wrapper = document.querySelector(`[data-id="${shape.id}"]`);
  if (!wrapper) return;
  const content = wrapper.querySelector('.shape-content');
  if (!content) return;

  // Blend mode on the content layer
  content.style.mixBlendMode = shape.blendMode || 'normal';

  // CSS filter on the content layer
  const f = shape.filters;
  content.style.filter = f
    ? `brightness(${f.brightness ?? 100}%) contrast(${f.contrast ?? 100}%) saturate(${f.saturation ?? 100}%) hue-rotate(${f.hue ?? 0}deg)`
    : '';

  // Flip applied to the media element (not the content div — avoids offset outside the shape)
  const mediaEl = content.querySelector('.media-el');
  if (mediaEl) {
    const flipStr = [
      shape.flipH ? 'scaleX(-1)' : '',
      shape.flipV ? 'scaleY(-1)' : '',
    ].filter(Boolean).join(' ');
    mediaEl.style.transform = flipStr || '';
  }
}

/* ============================================================
   sizeYtCover — size YouTube cover wrapper + iframe to fill w×h
   ============================================================ */
function sizeYtCover(coverDiv, w, h) {
  coverDiv.style.width  = w + 'px';
  coverDiv.style.height = h + 'px';
  const iframe = coverDiv.querySelector('iframe');
  if (!iframe) return;
  const aspect = 16 / 9;
  let iw, ih;
  if (w / h > aspect) {
    iw = w;
    ih = w / aspect;
  } else {
    ih = h;
    iw = h * aspect;
  }
  iframe.style.width  = iw + 'px';
  iframe.style.height = ih + 'px';
  iframe.style.left   = ((w - iw) / 2) + 'px';
  iframe.style.top    = ((h - ih) / 2) + 'px';
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
    wrapper.classList.remove('has-media');
    applyContentTransform(shape);
    return;
  }

  wrapper.classList.add('has-media');
  if (placeholder) placeholder.style.display = 'none';

  const bbox = getBBox(shape.corners);
  let el;

  if (shape.media.type === 'pattern') {
    el = document.createElement('div');
    el.className = 'media-el';
    el.style.width  = bbox.w + 'px';
    el.style.height = bbox.h + 'px';
    const p = shape.media;
    if (p.kind === 'solid') {
      el.style.background = p.color || '#ffffff';
    } else if (p.kind === 'gradient') {
      el.style.background = `linear-gradient(${p.angle ?? 135}deg, ${p.color1 || '#ff0000'}, ${p.color2 || '#0000ff'})`;
    } else if (p.kind === 'grid') {
      const c = p.color || '#00d4ff', sz = p.size || 24;
      el.style.backgroundImage = `linear-gradient(${c}55 1px,transparent 1px),linear-gradient(90deg,${c}55 1px,transparent 1px)`;
      el.style.backgroundSize  = `${sz}px ${sz}px`;
      el.style.backgroundColor = 'rgba(255,255,255,0.04)';
    }
  } else if (shape.media.type === 'youtube') {
    // Wrap iframe in a cover div so it fills the shape without black bars
    const iframe = document.createElement('iframe');
    iframe.src = youtubeEmbedUrl(shape.media.embedId, shape.media.loop !== false, shape.media.audio !== false);
    iframe.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('frameborder', '0');
    iframe.style.pointerEvents = 'none';
    el = document.createElement('div');
    el.className = 'media-el yt-cover';
    el.appendChild(iframe);
    sizeYtCover(el, bbox.w, bbox.h);
  } else if (shape.media.type === 'video') {
    el = document.createElement('video');
    el.src = shape.media.url;
    el.autoplay = true;
    el.loop = true;
    el.muted = true;           // required for autoplay on iOS Safari
    el.setAttribute('playsinline', ''); // prevents iOS fullscreen takeover
    el.setAttribute('preload', 'auto');
    el.draggable = false;
    el.className = 'media-el';
    el.style.width  = bbox.w + 'px';
    el.style.height = bbox.h + 'px';
  } else {
    el = document.createElement('img');
    el.src = shape.media.url;
    el.alt = '';
    el.draggable = false;
    el.className = 'media-el';
    el.style.width  = bbox.w + 'px';
    el.style.height = bbox.h + 'px';
  }

  if (!el.className.includes('media-el')) el.className = 'media-el';
  el.style.pointerEvents = 'none'; // controlled by shield

  content.appendChild(el);

  // iOS Safari needs an explicit play() call after appending to DOM
  if (el.tagName === 'VIDEO') el.play().catch(() => {});

  // Show play toggle only for interactive media (not for patterns)
  const showPlay = shape.media.type === 'youtube' || shape.media.type === 'video';
  wrapper.querySelector('.btn-play-toggle').style.display = showPlay ? '' : 'none';
  if (showPlay) {
    setEditMode(wrapper, true);
    wrapper.querySelector('.btn-play-toggle').textContent = '▶ Play';
  }

  applyContentTransform(shape);
}

/* ============================================================
   setEditMode — toggle iframe-shield on/off
   ============================================================ */
function setEditMode(wrapper, isEdit) {
  wrapper.classList.toggle('edit-mode', isEdit);
  // In play mode: disable move-handle and shield so the media is reachable
  const moveHandle = wrapper.querySelector('.move-handle');
  if (moveHandle) moveHandle.style.pointerEvents = isEdit ? 'all' : 'none';
  const mediaEl = wrapper.querySelector('.media-el');
  if (mediaEl) {
    mediaEl.style.pointerEvents = isEdit ? 'none' : 'all';
    // For YouTube cover, also enable pointer events on the iframe itself
    const iframe = mediaEl.querySelector('iframe');
    if (iframe) iframe.style.pointerEvents = isEdit ? 'none' : 'all';
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
  const lp = document.getElementById('layers-panel');
  if (lp && !lp.hidden) renderLayersPanel();
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
    if (shape.warpMode) {
      // Free warp — move only the dragged corner
      shape.corners[dc.cornerIndex] = pt;
    } else {
      // Resize — scale all corners from opposite corner
      const i = dc.cornerIndex;
      const anchor = dc.startCorners[(i + 2) % 4];
      const origin = dc.startCorners[i];
      const ddx = origin.x - anchor.x;
      const ddy = origin.y - anchor.y;
      const sx = Math.abs(ddx) > 0.5 ? (pt.x - anchor.x) / ddx : 1;
      const sy = Math.abs(ddy) > 0.5 ? (pt.y - anchor.y) / ddy : 1;
      shape.corners = dc.startCorners.map(c => ({
        x: anchor.x + (c.x - anchor.x) * sx,
        y: anchor.y + (c.y - anchor.y) * sy,
      }));
    }
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
  } else if (dc.type === 'rotate') {
    const currentAngle = Math.atan2(pt.y - dc.center.y, pt.x - dc.center.x);
    const delta = currentAngle - dc.startAngle;
    shape.corners = dc.startCorners.map(c => rotatePoint(c, dc.center, delta));
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

/* ============================================================
   Presentation mode — F11 toggles fullscreen + hides all UI.
   Escape exits both presentation mode and fullscreen.
   ============================================================ */
function enterPresentationMode() {
  document.body.classList.add('presentation-mode');
  deselectAll();
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  }
}

function exitPresentationMode() {
  document.body.classList.remove('presentation-mode');
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
}

function togglePresentationMode() {
  if (document.body.classList.contains('presentation-mode')) {
    exitPresentationMode();
  } else {
    enterPresentationMode();
  }
}

// Exit presentation mode automatically when browser exits fullscreen (e.g. Esc)
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) {
    document.body.classList.remove('presentation-mode');
  }
});

// Keyboard shortcuts
window.addEventListener('keydown', e => {
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  // F11 — toggle presentation mode (fullscreen + hide all UI)
  if (e.key === 'F11') {
    e.preventDefault();
    togglePresentationMode();
    return;
  }

  // Escape — exit presentation mode / deselect
  if (e.key === 'Escape') {
    if (document.body.classList.contains('presentation-mode')) {
      exitPresentationMode();
    } else {
      deselectAll();
    }
    return;
  }

  if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedId) {
    deleteShape(state.selectedId);
  }
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

  // Arrow key nudge — move selected shape 1px (or 10px with Shift)
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && state.selectedId) {
    const shape = state.shapes.find(s => s.id === state.selectedId);
    if (!shape || shape.locked) return;
    e.preventDefault();
    const step = e.shiftKey ? 10 : 1;
    const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
    const dy = e.key === 'ArrowUp'   ? -step : e.key === 'ArrowDown'  ? step : 0;
    shape.corners = shape.corners.map(c => ({ x: c.x + dx, y: c.y + dy }));
    updateShapeDOM(shape);
    saveState();
  }
});

/* ============================================================
   Drag-and-drop — local image files onto canvas or shapes
   ============================================================ */
function applyLocalFile(shape, file) {
  if (file.type.startsWith('video/')) {
    const url = URL.createObjectURL(file);
    shape.media = { type: 'video', url, blobUrl: true, mimeType: file.type };
    applyMedia(shape);
    saveState();
  } else {
    const reader = new FileReader();
    reader.onload = (ev) => {
      shape.media = { type: 'image', url: ev.target.result };
      applyMedia(shape);
      saveState();
    };
    reader.readAsDataURL(file);
  }
}

// Drop onto an existing shape wrapper
document.addEventListener('dragover', e => {
  e.preventDefault();
  const wrapper = e.target.closest('[data-id]');
  if (wrapper) wrapper.classList.add('drag-over');
  else canvas.classList.add('drag-over');
});

document.addEventListener('dragleave', e => {
  const wrapper = e.target.closest('[data-id]');
  if (wrapper) wrapper.classList.remove('drag-over');
  if (!e.relatedTarget || !canvas.contains(e.relatedTarget)) {
    canvas.classList.remove('drag-over');
    document.querySelectorAll('[data-id].drag-over').forEach(el => el.classList.remove('drag-over'));
  }
});

document.addEventListener('drop', e => {
  e.preventDefault();
  canvas.classList.remove('drag-over');
  document.querySelectorAll('[data-id].drag-over').forEach(el => el.classList.remove('drag-over'));

  const files = [...e.dataTransfer.files].filter(f =>
    f.type.startsWith('image/') || f.type.startsWith('video/')
  );
  if (!files.length) return;

  const wrapper = e.target.closest('[data-id]');
  if (wrapper) {
    // Drop onto existing shape
    const shape = state.shapes.find(s => s.id === wrapper.dataset.id);
    if (shape) applyLocalFile(shape, files[0]);
  } else {
    // Drop onto canvas — create new rect for each image
    const canvasRect = canvas.getBoundingClientRect();
    files.forEach((file, i) => {
      const cx = e.clientX - canvasRect.left + i * 20;
      const cy = e.clientY - canvasRect.top  + i * 20;
      const hw = 160, hh = 120;
      const shape = createShape('rect');
      shape.corners = [
        { x: cx - hw, y: cy - hh },
        { x: cx + hw, y: cy - hh },
        { x: cx + hw, y: cy + hh },
        { x: cx - hw, y: cy + hh },
      ];
      state.shapes.push(shape);
      renderShape(shape);
      applyLocalFile(shape, file);
    });
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

  // Restore YouTube option checkboxes from saved media
  document.getElementById('media-loop').checked  = shape?.media?.loop  !== false; // default true
  document.getElementById('media-audio').checked = shape?.media?.audio !== false; // default true

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
  const ts = document.getElementById('theme-select');
  const tg = document.getElementById('theme-grid');
  if (ts) ts.value = '';
  if (tg) { tg.hidden = true; tg.innerHTML = ''; }
  // Reset pattern picker
  document.querySelectorAll('.btn-pattern').forEach(b => b.classList.remove('active'));
  ['pattern-solid-opts','pattern-gradient-opts','pattern-grid-opts'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  });
  const bap = document.getElementById('btn-apply-pattern');
  if (bap) bap.hidden = true;
}

function updateMediaPreview() {
  const url = mediaInput.value.trim();
  mediaPreview.hidden = true;
  mediaPreview.innerHTML = '';
  const loopRow = document.getElementById('media-yt-options');

  if (!url) {
    loopRow.style.display = 'none';
    return;
  }

  const ytId = parseYoutubeId(url);
  loopRow.style.display = ytId ? 'block' : 'none';

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

  if (isVideoUrl(url)) {
    mediaPreview.hidden = false;
    const div = document.createElement('div');
    div.className = 'preview-yt';
    div.innerHTML = `<span style="font-size:22px">🎬</span> Video detected`;
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
mediaInput.addEventListener('paste', () => setTimeout(updateMediaPreview, 0));

/* ============================================================
   Theme picker
   ============================================================ */
(function initThemePicker() {
  if (typeof CANVAS_THEMES === 'undefined') return;

  const themeSelect = document.getElementById('theme-select');
  const themeGrid   = document.getElementById('theme-grid');

  // Populate dropdown
  CANVAS_THEMES.forEach(theme => {
    const opt = document.createElement('option');
    opt.value = theme.id;
    opt.textContent = theme.label;
    themeSelect.appendChild(opt);
  });

  themeSelect.addEventListener('change', () => {
    const themeId = themeSelect.value;
    themeGrid.innerHTML = '';
    if (!themeId) { themeGrid.hidden = true; return; }

    const theme = CANVAS_THEMES.find(t => t.id === themeId);
    if (!theme) { themeGrid.hidden = true; return; }

    themeGrid.hidden = false;
    theme.videos.forEach(video => {
      const cell = document.createElement('div');
      cell.className = 'theme-thumb';
      cell.title = video.title;

      const img = document.createElement('img');
      img.src = `https://img.youtube.com/vi/${video.id}/mqdefault.jpg`;
      img.alt = video.title;
      img.loading = 'lazy';
      img.onerror = () => cell.classList.add('theme-thumb-error');

      const label = document.createElement('div');
      label.className = 'theme-thumb-title';
      label.textContent = video.title;

      cell.appendChild(img);
      cell.appendChild(label);

      cell.addEventListener('click', () => {
        // Attach YouTube video directly to the shape and close modal
        const shape = state.shapes.find(s => s.id === state.modalShapeId);
        if (!shape) { hideMediaModal(); return; }
        const loop  = document.getElementById('media-loop').checked;
        const audio = document.getElementById('media-audio').checked;
        shape.media = { type: 'youtube', url: `https://www.youtube.com/watch?v=${video.id}`, embedId: video.id, loop, audio };
        applyMedia(shape);
        saveState();
        hideMediaModal();
      });

      themeGrid.appendChild(cell);
    });
  });
})();

/* ============================================================
   Test pattern picker
   ============================================================ */
(function initPatternPicker() {
  let activeKind = null;

  document.querySelectorAll('.btn-pattern').forEach(btn => {
    btn.addEventListener('click', () => {
      const kind = btn.dataset.kind;
      // Toggle: clicking active button deactivates
      activeKind = activeKind === kind ? null : kind;

      // Update button active state
      document.querySelectorAll('.btn-pattern').forEach(b =>
        b.classList.toggle('active', b.dataset.kind === activeKind)
      );

      // Show/hide option rows
      document.getElementById('pattern-solid-opts').hidden    = activeKind !== 'solid';
      document.getElementById('pattern-gradient-opts').hidden = activeKind !== 'gradient';
      document.getElementById('pattern-grid-opts').hidden     = activeKind !== 'grid';

      document.getElementById('btn-apply-pattern').hidden = !activeKind;
    });
  });

  document.getElementById('btn-apply-pattern').addEventListener('click', () => {
    if (!activeKind) return;
    const shape = state.shapes.find(s => s.id === state.modalShapeId);
    if (!shape) { hideMediaModal(); return; }

    if (activeKind === 'solid') {
      shape.media = { type: 'pattern', kind: 'solid', color: document.getElementById('pat-solid-color').value };
    } else if (activeKind === 'gradient') {
      shape.media = {
        type: 'pattern', kind: 'gradient',
        color1: document.getElementById('pat-grad-c1').value,
        color2: document.getElementById('pat-grad-c2').value,
        angle: +document.getElementById('pat-grad-angle').value,
      };
    } else if (activeKind === 'grid') {
      shape.media = {
        type: 'pattern', kind: 'grid',
        color: document.getElementById('pat-grid-color').value,
        size: +document.getElementById('pat-grid-size').value,
      };
    }
    applyMedia(shape);
    saveState();
    hideMediaModal();
  });
})();

document.getElementById('btn-media-cancel').addEventListener('click', hideMediaModal);

// Browse local file
document.getElementById('btn-media-browse').addEventListener('click', () => {
  document.getElementById('media-file-input').click();
});
document.getElementById('media-file-input').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = '';
  // Apply directly to shape and close modal — avoids large base64 in text input
  // which fails silently on iOS Safari
  const shape = state.shapes.find(s => s.id === state.modalShapeId);
  if (shape) {
    applyLocalFile(shape, file);
    hideMediaModal();
  }
});

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

  // Store YouTube playback preferences
  if (parsed.type === 'youtube') {
    parsed.loop  = document.getElementById('media-loop').checked;
    parsed.audio = document.getElementById('media-audio').checked;
  }

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
  togglePresentationMode();
});

/* ============================================================
   Persistence
   ============================================================ */
function saveState() {
  const data = {
    shapes: state.shapes.map(s =>
      s.media?.blobUrl ? { ...s, media: null } : s
    ),
    nextZ: state.nextZ,
    spotifyUrl: state.spotifyUrl || null,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
    state.spotifyUrl = saved.spotifyUrl || null;
    state.shapes.forEach(shape => renderShape(shape));
    if (state.spotifyUrl) applySpotifyEmbed(state.spotifyUrl);
  } catch (e) {
    console.warn('Could not load saved state:', e);
  }
}

window.addEventListener('beforeunload', saveState);

/* ============================================================
   Layers panel
   ============================================================ */
const layersPanel = document.getElementById('layers-panel');
const layersList  = document.getElementById('layers-list');

// Sync the shape's inline name label with its layers-panel input
function syncLayerName(shape) {
  const wrapper = document.querySelector(`[data-id="${shape.id}"]`);
  if (wrapper) {
    const nl = wrapper.querySelector('.shape-name-label');
    if (nl && document.activeElement !== nl) nl.value = shape.name || '';
  }
  const layerInput = document.querySelector(`#layers-list [data-id="${shape.id}"] .layer-name-input`);
  if (layerInput && document.activeElement !== layerInput) {
    const typeLabel = shape.type === 'circle' ? 'Circle' : 'Rect';
    const mediaLabel = shape.media ? (shape.media.type === 'youtube' ? ' (YT)' : ' (img)') : '';
    layerInput.value = shape.name || (typeLabel + mediaLabel);
  }
}

function renderLayersPanel() {
  if (!layersList) return;
  layersList.innerHTML = '';
  // Sorted top-to-bottom by z-index descending
  const sorted = [...state.shapes].sort((a, b) => b.zIndex - a.zIndex);
  sorted.forEach(shape => {
    const isHidden = shape.visible === false;
    const item = document.createElement('div');
    item.className = 'layer-item' +
      (shape.id === state.selectedId ? ' selected' : '') +
      (isHidden ? ' hidden-shape' : '');
    item.dataset.id = shape.id;

    const typeLabel = shape.type === 'circle' ? 'Circle' : 'Rect';
    const mediaLabel = shape.media ? (shape.media.type === 'youtube' ? ' (YT)' : ' (img)') : '';
    const displayName = shape.name || (typeLabel + mediaLabel);

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'layer-name-input';
    nameInput.value = displayName;
    nameInput.title = 'Click to rename';
    nameInput.addEventListener('click', e => e.stopPropagation());
    nameInput.addEventListener('change', e => {
      shape.name = e.target.value.trim();
      syncLayerName(shape);
      saveState();
    });
    nameInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.target.blur(); }
    });
    item.appendChild(nameInput);

    const actions = document.createElement('div');
    actions.className = 'layer-actions';

    const btnUp = document.createElement('button');
    btnUp.title = 'Bring forward';
    btnUp.innerHTML = '&#8679;';
    btnUp.addEventListener('click', e => {
      e.stopPropagation();
      shape.zIndex = state.nextZ++;
      const wrapper = document.querySelector(`[data-id="${shape.id}"]`);
      if (wrapper) wrapper.style.zIndex = shape.zIndex;
      saveState();
      renderLayersPanel();
    });

    const btnDown = document.createElement('button');
    btnDown.title = 'Send backward';
    btnDown.innerHTML = '&#8681;';
    btnDown.addEventListener('click', e => {
      e.stopPropagation();
      // Find the shape just below and swap z-indices
      const allZ = state.shapes.map(s => s.zIndex).sort((a,b) => a-b);
      const currentIdx = allZ.indexOf(shape.zIndex);
      if (currentIdx > 0) {
        const targetZ = allZ[currentIdx - 1];
        const other = state.shapes.find(s => s.zIndex === targetZ);
        if (other) {
          [shape.zIndex, other.zIndex] = [other.zIndex, shape.zIndex];
          const wA = document.querySelector(`[data-id="${shape.id}"]`);
          const wB = document.querySelector(`[data-id="${other.id}"]`);
          if (wA) wA.style.zIndex = shape.zIndex;
          if (wB) wB.style.zIndex = other.zIndex;
        }
      }
      saveState();
      renderLayersPanel();
    });

    const btnDel = document.createElement('button');
    btnDel.title = 'Delete';
    btnDel.innerHTML = '&times;';
    btnDel.addEventListener('click', e => {
      e.stopPropagation();
      deleteShape(shape.id);
      renderLayersPanel();
    });

    const btnVis = document.createElement('button');
    btnVis.title = isHidden ? 'Show shape' : 'Hide shape';
    btnVis.textContent = isHidden ? '🙈' : '👁';
    btnVis.addEventListener('click', e => {
      e.stopPropagation();
      shape.visible = isHidden ? true : false;
      const wrapper = document.querySelector(`[data-id="${shape.id}"]`);
      if (wrapper) wrapper.style.visibility = shape.visible === false ? 'hidden' : '';
      saveState();
      renderLayersPanel();
    });

    const isLocked = shape.locked === true;
    const btnLock = document.createElement('button');
    btnLock.title = isLocked ? 'Unlock shape' : 'Lock shape';
    btnLock.textContent = isLocked ? '🔒' : '🔓';
    btnLock.addEventListener('click', e => {
      e.stopPropagation();
      shape.locked = !shape.locked;
      const wrapper = document.querySelector(`[data-id="${shape.id}"]`);
      if (wrapper) wrapper.classList.toggle('locked', shape.locked);
      saveState();
      renderLayersPanel();
    });

    actions.appendChild(btnLock);
    actions.appendChild(btnVis);
    actions.appendChild(btnUp);
    actions.appendChild(btnDown);
    actions.appendChild(btnDel);
    item.appendChild(actions);

    item.addEventListener('click', () => {
      selectShape(shape.id);
      renderLayersPanel();
    });

    layersList.appendChild(item);
  });
}

document.getElementById('btn-layers').addEventListener('click', () => {
  const hidden = layersPanel.hidden;
  layersPanel.hidden = !hidden;
  if (!hidden) return;
  renderLayersPanel();
});

document.getElementById('btn-close-layers').addEventListener('click', () => {
  layersPanel.hidden = true;
});

/* ============================================================
   JSON Export / Import
   ============================================================ */
function exportScene() {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    shapes: state.shapes.map(s => s.media?.blobUrl ? { ...s, media: null } : s),
    nextZ: state.nextZ,
    spotifyUrl: state.spotifyUrl || null,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'canvas-scene.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function importScene(file) {
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      document.querySelectorAll('[data-id]').forEach(el => el.remove());
      state.shapes = data.shapes || [];
      state.nextZ  = data.nextZ  || 1;
      state.spotifyUrl = data.spotifyUrl || null;
      state.shapes.forEach(s => renderShape(s));
      if (state.spotifyUrl) applySpotifyEmbed(state.spotifyUrl);
      saveState();
    } catch (e) {
      alert('Could not read file — is it a valid canvas-scene.json?');
    }
  };
  reader.readAsText(file);
}

document.getElementById('btn-export').addEventListener('click', exportScene);
document.getElementById('btn-import').addEventListener('click', () =>
  document.getElementById('import-file-input').click()
);
document.getElementById('import-file-input').addEventListener('change', e => {
  const f = e.target.files[0];
  if (f) importScene(f);
  e.target.value = '';
});

/* ============================================================
   Cast — fullscreen + guide overlay för Chrome "Cast tab"
   ============================================================ */
let _castActive = false;

function startCast() {
  _castActive = true;
  enterPresentationMode();
  document.getElementById('btn-cast').textContent = '↩ Stop cast';
  document.getElementById('btn-cast').classList.add('active');
  const guide = document.getElementById('cast-guide');
  if (guide) { guide.hidden = false; }
}

function stopCast() {
  _castActive = false;
  exitPresentationMode();
  document.getElementById('btn-cast').textContent = '⊿ Cast';
  document.getElementById('btn-cast').classList.remove('active');
  const guide = document.getElementById('cast-guide');
  if (guide) guide.hidden = true;
}

document.getElementById('btn-cast')?.addEventListener('click', () => {
  if (_castActive) stopCast(); else startCast();
});

document.getElementById('btn-cast-ok')?.addEventListener('click', () => {
  document.getElementById('cast-guide').hidden = true;
});

// If user exits fullscreen (Esc) while casting, also clear cast state
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && _castActive) {
    _castActive = false;
    document.getElementById('btn-cast').textContent = '⊿ Cast';
    document.getElementById('btn-cast').classList.remove('active');
  }
});

/* ============================================================
   Spotify background music
   ============================================================ */
function parseSpotifyUrl(url) {
  // Accepts: open.spotify.com/track/ID, /playlist/ID, /album/ID
  // Also accepts spotify:track:ID URIs
  const webMatch = url.match(/open\.spotify\.com\/(track|playlist|album|episode)\/([A-Za-z0-9]+)/);
  if (webMatch) return { type: webMatch[1], id: webMatch[2] };
  const uriMatch = url.match(/spotify:(track|playlist|album|episode):([A-Za-z0-9]+)/);
  if (uriMatch) return { type: uriMatch[1], id: uriMatch[2] };
  return null;
}

function applySpotifyEmbed(url) {
  const parsed = parseSpotifyUrl(url);
  if (!parsed) return false;

  const embedUrl = `https://open.spotify.com/embed/${parsed.type}/${parsed.id}?utm_source=generator&theme=0`;
  const wrap = document.getElementById('spotify-embed-wrap');
  wrap.innerHTML = '';

  const iframe = document.createElement('iframe');
  iframe.src = embedUrl;
  iframe.width = '100%';
  iframe.height = parsed.type === 'track' ? '80' : '152';
  iframe.setAttribute('frameborder', '0');
  iframe.setAttribute('allow', 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture');
  iframe.setAttribute('loading', 'lazy');
  wrap.appendChild(iframe);

  document.getElementById('btn-spotify-remove').style.display = 'block';
  state.spotifyUrl = url;
  saveState();
  return true;
}

function clearSpotifyEmbed() {
  document.getElementById('spotify-embed-wrap').innerHTML = '';
  document.getElementById('btn-spotify-remove').style.display = 'none';
  document.getElementById('spotify-url-input').value = '';
  state.spotifyUrl = null;
  saveState();
}

const spotifyPanel = document.getElementById('spotify-panel');

document.getElementById('btn-music').addEventListener('click', () => {
  spotifyPanel.hidden = !spotifyPanel.hidden;
  if (!spotifyPanel.hidden && state.spotifyUrl) {
    document.getElementById('spotify-url-input').value = state.spotifyUrl;
  }
});

document.getElementById('btn-close-spotify').addEventListener('click', () => {
  spotifyPanel.hidden = true;
});

document.getElementById('btn-spotify-load').addEventListener('click', () => {
  const url = document.getElementById('spotify-url-input').value.trim();
  if (!url) return;
  const ok = applySpotifyEmbed(url);
  if (!ok) {
    document.getElementById('spotify-url-input').style.borderColor = 'var(--danger)';
    setTimeout(() => document.getElementById('spotify-url-input').style.borderColor = '', 1500);
  }
});

document.getElementById('spotify-url-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-spotify-load').click();
});

document.getElementById('btn-spotify-remove').addEventListener('click', clearSpotifyEmbed);

/* ============================================================
   Init
   ============================================================ */
function init() {
  loadState();
}

init();
