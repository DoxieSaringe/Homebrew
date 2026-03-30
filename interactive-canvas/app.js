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
const MESH_ROWS = 4, MESH_COLS = 4;

/* ============================================================
   Mesh warp math
   ============================================================ */
function initMeshPoints(corners, rows, cols) {
  const [tl, tr, br, bl] = corners;
  const pts = [];
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const u = c / cols, v = r / rows;
      pts.push({
        x: (1-u)*(1-v)*tl.x + u*(1-v)*tr.x + u*v*br.x + (1-u)*v*bl.x,
        y: (1-u)*(1-v)*tl.y + u*(1-v)*tr.y + u*v*br.y + (1-u)*v*bl.y,
      });
    }
  }
  return pts;
}

function drawWarpedTriangle(ctx, img, x0,y0,u0,v0, x1,y1,u1,v1, x2,y2,u2,v2) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.lineTo(x2,y2);
  ctx.closePath(); ctx.clip();
  const px0=u0*iw, py0=v0*ih, px1=u1*iw, py1=v1*ih, px2=u2*iw, py2=v2*ih;
  const det = (px1-px0)*(py2-py0) - (px2-px0)*(py1-py0);
  if (Math.abs(det) < 0.001) { ctx.restore(); return; }
  const a=((x1-x0)*(py2-py0)-(x2-x0)*(py1-py0))/det;
  const b=((x2-x0)*(px1-px0)-(x1-x0)*(px2-px0))/det;
  const c_=x0-a*px0-b*py0;
  const d=((y1-y0)*(py2-py0)-(y2-y0)*(py1-py0))/det;
  const e=((y2-y0)*(px1-px0)-(y1-y0)*(px2-px0))/det;
  const f=y0-d*px0-e*py0;
  ctx.transform(a,d,b,e,c_,f);
  ctx.drawImage(img,0,0);
  ctx.restore();
}

function renderMeshCanvas(shape) {
  if (!shape.mesh || shape.media?.type !== 'image') return;
  const wrapper = document.querySelector(`[data-id="${shape.id}"]`);
  if (!wrapper) return;
  const canvasEl = wrapper.querySelector('.mesh-canvas');
  if (!canvasEl) return;
  if (!shape._img) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { shape._img = img; renderMeshCanvas(shape); };
    img.src = shape.media.url;
    return;
  }
  const cw = canvas.offsetWidth, ch = canvas.offsetHeight;
  if (canvasEl.width !== cw || canvasEl.height !== ch) { canvasEl.width=cw; canvasEl.height=ch; }
  const ctx = canvasEl.getContext('2d');
  ctx.clearRect(0,0,cw,ch);
  const {rows, cols, points} = shape.mesh;
  const stride = cols+1;
  if (shape.type === 'circle') {
    const xs=points.map(p=>p.x), ys=points.map(p=>p.y);
    ctx.save(); ctx.beginPath();
    ctx.ellipse((Math.min(...xs)+Math.max(...xs))/2,(Math.min(...ys)+Math.max(...ys))/2,
      (Math.max(...xs)-Math.min(...xs))/2,(Math.max(...ys)-Math.min(...ys))/2,0,0,Math.PI*2);
    ctx.clip();
  }
  for (let r=0; r<rows; r++) {
    for (let c=0; c<cols; c++) {
      const tl=points[r*stride+c], tr=points[r*stride+c+1];
      const br=points[(r+1)*stride+c+1], bl=points[(r+1)*stride+c];
      const u0=c/cols, u1=(c+1)/cols, v0=r/rows, v1=(r+1)/rows;
      drawWarpedTriangle(ctx,shape._img, tl.x,tl.y,u0,v0, tr.x,tr.y,u1,v0, br.x,br.y,u1,v1);
      drawWarpedTriangle(ctx,shape._img, tl.x,tl.y,u0,v0, br.x,br.y,u1,v1, bl.x,bl.y,u0,v1);
    }
  }
  if (shape.type === 'circle') ctx.restore();
}

function enableMesh(shape) {
  if (shape.media?.type !== 'image') return;
  if (!shape.mesh) {
    shape.mesh = { rows: MESH_ROWS, cols: MESH_COLS, points: initMeshPoints(shape.corners, MESH_ROWS, MESH_COLS) };
  }
  const wrapper = document.querySelector(`[data-id="${shape.id}"]`);
  if (!wrapper) return;
  wrapper.classList.add('has-mesh');
  wrapper.querySelector('.shape-content').style.display = 'none';
  wrapper.querySelector('.mesh-canvas').style.display = 'block';
  buildMeshHandles(shape, wrapper);
  renderMeshCanvas(shape);
}

function disableMesh(shape) {
  shape.mesh = null; shape._img = null;
  const wrapper = document.querySelector(`[data-id="${shape.id}"]`);
  if (!wrapper) return;
  wrapper.classList.remove('has-mesh');
  wrapper.querySelector('.shape-content').style.display = '';
  const ce = wrapper.querySelector('.mesh-canvas');
  if (ce) { ce.style.display='none'; const ctx=ce.getContext('2d'); ctx.clearRect(0,0,ce.width,ce.height); }
  wrapper.querySelectorAll('.mesh-handle').forEach(h => h.remove());
  applyMedia(shape);
}

function buildMeshHandles(shape, wrapper) {
  wrapper.querySelectorAll('.mesh-handle').forEach(h => h.remove());
  shape.mesh.points.forEach((pt, idx) => {
    const h = document.createElement('div');
    h.className = 'handle mesh-handle';
    h.dataset.meshIdx = idx;
    h.style.left = pt.x+'px'; h.style.top = pt.y+'px';
    h.addEventListener('pointerdown', e => {
      e.stopPropagation(); e.preventDefault();
      h.setPointerCapture(e.pointerId);
      selectShape(shape.id);
      state.dragContext = { type:'mesh-point', shapeId:shape.id, meshIdx:idx };
    });
    wrapper.appendChild(h);
  });
}

function syncMeshHandles(shape) {
  const wrapper = document.querySelector(`[data-id="${shape.id}"]`);
  if (!wrapper || !shape.mesh) return;
  shape.mesh.points.forEach((pt, idx) => {
    const h = wrapper.querySelector(`.mesh-handle[data-mesh-idx="${idx}"]`);
    if (h) { h.style.left=pt.x+'px'; h.style.top=pt.y+'px'; }
  });
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

  // ── Mesh canvas ───────────────────────────────────────────
  const meshCanvas = document.createElement('canvas');
  meshCanvas.className = 'mesh-canvas';
  meshCanvas.style.display = 'none';
  wrapper.appendChild(meshCanvas);

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
  btnPlay.style.display = 'none';
  toolbar.appendChild(btnPlay);

  const btnMesh = document.createElement('button');
  btnMesh.className = 'btn-mesh';
  btnMesh.title = 'Mesh warp (images only)';
  btnMesh.textContent = '⊞';
  btnMesh.style.display = 'none';
  toolbar.appendChild(btnMesh);

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
      startMeshPts: shape.mesh ? shape.mesh.points.map(p => ({ ...p })) : null,
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

  wrapper.querySelector('.btn-mesh').addEventListener('click', e => {
    e.stopPropagation();
    if (shape.mesh) { disableMesh(shape); e.currentTarget.classList.remove('active'); }
    else            { enableMesh(shape);  e.currentTarget.classList.add('active'); }
    saveState();
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

  // Move handle — covers the full bounding box (z-index 8, above shield 6, below handles 10)
  const bbox = getBBox(corners);
  const moveHandle = wrapper.querySelector('.move-handle');
  moveHandle.style.left   = bbox.minX + 'px';
  moveHandle.style.top    = bbox.minY + 'px';
  moveHandle.style.width  = bbox.w + 'px';
  moveHandle.style.height = bbox.h + 'px';

  // Toolbar — above the TL corner
  const toolbar = wrapper.querySelector('.shape-toolbar');
  const tlx = Math.min(corners[0].x, corners[3].x);
  const tly = Math.min(corners[0].y, corners[1].y);
  toolbar.style.left = Math.max(0, tlx) + 'px';
  toolbar.style.top  = Math.max(0, tly - 34) + 'px';

  if (shape.mesh) {
    syncMeshHandles(shape);
    renderMeshCanvas(shape);
  } else {
    applyContentTransform(shape);
  }
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

  // Media element fills the content div exactly
  const mediaEl = content.querySelector('.media-el');
  if (mediaEl) {
    mediaEl.style.width  = w + 'px';
    mediaEl.style.height = h + 'px';
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
  // Show mesh button only for images
  const btnMesh = wrapper.querySelector('.btn-mesh');
  if (btnMesh) {
    btnMesh.style.display = shape.media.type === 'image' ? '' : 'none';
    btnMesh.classList.toggle('active', !!shape.mesh);
  }

  const bbox = getBBox(shape.corners);
  let el;

  if (shape.media.type === 'youtube') {
    el = document.createElement('iframe');
    el.src = youtubeEmbedUrl(shape.media.embedId, shape.media.loop !== false, shape.media.audio !== false);
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
  setEditMode(wrapper, true);
  wrapper.querySelector('.btn-play-toggle').textContent = '▶ Play';

  // Restore mesh if previously enabled
  if (shape.mesh) { enableMesh(shape); return; }

  applyContentTransform(shape);
}

/* ============================================================
   setEditMode — toggle iframe-shield on/off
   ============================================================ */
function setEditMode(wrapper, isEdit) {
  wrapper.classList.toggle('edit-mode', isEdit);
  // In play mode: disable move-handle and shield so the iframe is reachable
  const moveHandle = wrapper.querySelector('.move-handle');
  if (moveHandle) moveHandle.style.pointerEvents = isEdit ? 'all' : 'none';
  const mediaEl = wrapper.querySelector('.media-el');
  if (mediaEl) mediaEl.style.pointerEvents = isEdit ? 'none' : 'all';
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
    if (shape.mesh && dc.startMeshPts) {
      shape.mesh.points = dc.startMeshPts.map(p => ({ x: p.x+dx, y: p.y+dy }));
    }
    updateShapeDOM(shape);
  } else if (dc.type === 'mesh-point') {
    shape.mesh.points[dc.meshIdx] = { ...pt };
    const wrapper = document.querySelector(`[data-id="${shape.id}"]`);
    if (wrapper) {
      const h = wrapper.querySelector(`.mesh-handle[data-mesh-idx="${dc.meshIdx}"]`);
      if (h) { h.style.left=pt.x+'px'; h.style.top=pt.y+'px'; }
    }
    renderMeshCanvas(shape);
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
  if (e.target instanceof HTMLInputElement) return;

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
