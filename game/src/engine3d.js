// Minimal 3D engine on a 2D canvas: chase camera, perspective projection, painter's sort.
// Nothing here knows about Solmar Bay — it only turns 3D boxes / quads / triangles into pixels.
// Every drawable is pushed with a depth; draw() sorts far-to-near and paints.
import { FIELD } from './config.js';

export function createCamera() {
  return {
    pos: { x: 0, y: 8, z: 0 }, yaw: 0, pitch: -0.16, focal: 560,
    // Place the camera behind `target` (facing heading) and look slightly ahead of it.
    follow(target, heading, dist, height, ahead) {
      const fx = Math.sin(heading), fz = Math.cos(heading);
      this.pos.x = target.x - fx * dist;
      this.pos.y = target.y + height;
      this.pos.z = target.z - fz * dist;
      this.yaw = heading;
      this.lookX = target.x + fx * ahead;
      this.lookY = target.y + 2.2;
      this.lookZ = target.z + fz * ahead;
    },
  };
}

export function createScene(canvas) {
  const ctx = canvas.getContext('2d');
  const W = FIELD.width, H = FIELD.height;
  const items = [];
  let cam = null;
  let sunX = 0, sunY = 0;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
  }
  resize();
  window.addEventListener('resize', resize);

  function setCamera(c) { cam = c; }

  // Project a world point to screen space. Returns null behind the camera.
  function project(x, y, z) {
    const dx = x - cam.pos.x, dy = y - cam.pos.y, dz = z - cam.pos.z;
    const sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw);
    // Camera space: right = (dz*sy - dx*cy) — a point to the camera's right is +x on screen.
    const cx = dz * sy - dx * cy;
    const cz0 = dx * sy + dz * cy;
    const pitch = cam.pitch;
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const cyy = dy * cp - cz0 * sp;
    const czz = dy * sp + cz0 * cp;
    if (czz < 0.6) return null;
    const s = cam.focal / czz;
    return { x: W / 2 + cx * s, y: H / 2 - cyy * s, s, depth: czz };
  }

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * f)));
    const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * f)));
    const b = Math.min(255, Math.max(0, Math.round((n & 255) * f)));
    return `rgb(${r},${g},${b})`;
  }

  function poly(pts, fill, depth, stroke) {
    if (pts.some((p) => p === null)) return;
    items.push({ depth, kind: 'poly', pts, fill, stroke: stroke || null });
  }

  function text(str, x, y, z, size, color, align, weight) {
    const p = project(x, y, z);
    if (!p) return;
    // Fixed screen size: labels must stay readable at any distance.
    items.push({ depth: p.depth, kind: 'text', x: p.x, y: p.y, size, str, color, align: align || 'center', weight: weight || '700' });
  }

  function circle(x, y, z, r, fill, depthOverride) {
    const p = project(x, y, z);
    if (!p) return;
    items.push({ depth: depthOverride ?? p.depth, kind: 'circle', x: p.x, y: p.y, r: Math.max(1, r * p.s * 0.5), fill });
  }

  // Axis-aligned box centred at (x, y, z) with size (w, h, d). Faces shaded by orientation;
  // `top` colours the roof, `win` draws lit windows on the two long faces.
  // `rot` (radians, around Y) turns the box to a heading: local +z maps to (sin rot, cos rot).
  function box(x, y, z, w, h, d, color, opts = {}) {
    const hw = w / 2, hh = h / 2, hd = d / 2;
    const rot = opts.rot || 0;
    const cs = Math.cos(rot), sn = Math.sin(rot);
    const corner = (lx, ly, lz) => [x + lx * cs + lz * sn, y + ly, z - lx * sn + lz * cs];
    const c = [
      corner(-hw, -hh, -hd), corner(hw, -hh, -hd), corner(hw, -hh, hd), corner(-hw, -hh, hd),
      corner(-hw, hh, -hd), corner(hw, hh, -hd), corner(hw, hh, hd), corner(-hw, hh, hd),
    ];
    const faces = [
      { idx: [0, 1, 2, 3], f: 0.55 }, // bottom (rarely seen)
      { idx: [4, 5, 6, 7], f: 1.18, top: true }, // roof
      { idx: [0, 1, 5, 4], f: 0.82 }, // north face
      { idx: [2, 3, 7, 6], f: 0.72 }, // south face
      { idx: [1, 2, 6, 5], f: 1.0 }, // east face
      { idx: [3, 0, 4, 7], f: 0.62 }, // west face
    ];
    const depth = Math.hypot(x - cam.pos.x, y - cam.pos.y, z - cam.pos.z);
    for (const face of faces) {
      const pts = face.idx.map((i) => project(c[i][0], c[i][1], c[i][2]));
      if (pts.some((p) => p === null)) continue;
      // Backface cull: skip faces whose projected winding is clockwise (facing away).
      const area = (pts[1].x - pts[0].x) * (pts[2].y - pts[0].y) - (pts[1].y - pts[0].y) * (pts[2].x - pts[0].x);
      if (area <= 0) continue;
      const fill = face.top && opts.top ? opts.top : shade(color, face.f);
      poly(pts, fill, depth);
      if (opts.win && !face.top && face.f > 0.6) drawWindows(pts, depth, opts.win);
    }
  }

  // Bilinear window grid across a projected quad face.
  function drawWindows(pts, depth, win) {
    const cols = win.cols, rows = win.rows;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        if (((r * 7 + c * 13 + win.seed) % 10) < 4) continue; // ~60% lit
        const u0 = (c + 0.18) / cols, u1 = (c + 0.82) / cols;
        const v0 = (r + 0.22) / rows, v1 = (r + 0.78) / rows;
        const at = (u, v) => {
          const a = pts[0], b = pts[1], cc = pts[2], d = pts[3];
          const topX = a.x + (b.x - a.x) * u, topY = a.y + (b.y - a.y) * u;
          const botX = d.x + (cc.x - d.x) * u, botY = d.y + (cc.y - d.y) * u;
          return { x: topX + (botX - topX) * v, y: topY + (botY - topY) * v };
        };
        poly([at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)], ((r + c) % 3 === 0 ? '#ffe9a8' : '#ffd76e'), depth - 0.01);
      }
    }
  }

  // Project with near-plane clamping (for ground tiles that run under the camera).
  function projectNear(x, y, z) {
    const dx = x - cam.pos.x, dy = y - cam.pos.y, dz = z - cam.pos.z;
    const sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw);
    const cx = dz * sy - dx * cy;
    const cz0 = dx * sy + dz * cy;
    const pitch = cam.pitch;
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const cyy = dy * cp - cz0 * sp;
    let czz = dy * sp + cz0 * cp;
    if (czz < 0.6) czz = 0.6;
    const s = cam.focal / czz;
    return { x: W / 2 + cx * s, y: H / 2 - cyy * s, s, depth: czz };
  }

  // Flat quad on the ground (y constant): corners given in world XZ.
  // Ground always paints first: a flat plane viewed from above never occludes anything
  // standing on it, and centre-based depths would let a near tile swallow the player car.
  function groundQuad(x0, z0, x1, z1, y, fill, depthBias = 0) {
    const pts = [projectNear(x0, y, z0), projectNear(x1, y, z0), projectNear(x1, y, z1), projectNear(x0, y, z1)];
    if (pts.some((p) => p === null)) return;
    poly(pts, fill, 1e9 + (depthBias || 0));
  }

  // Vertical billboard quad facing the camera, centred at (x,y,z), world width w / height h.
  function billboard(x, y, z, w, h, fill) {
    const p = project(x, y, z);
    if (!p) return;
    const hw = (w * p.s * 0.5) / 10, hh = (h * p.s * 0.5) / 10;
    items.push({ depth: p.depth, kind: 'rect', x: p.x - hw, y: p.y - hh, w: hw * 2, h: hh * 2, fill });
  }

  function skyAndSun() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2b1e5e'); g.addColorStop(0.42, '#c94b7c');
    g.addColorStop(0.62, '#ff9a52'); g.addColorStop(0.75, '#ffb36b'); g.addColorStop(1, '#3a2a4a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Low sun, slightly left of centre, with glow.
    sunX = W * 0.36; sunY = H * 0.52;
    const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 150);
    glow.addColorStop(0, 'rgba(255,215,110,0.95)');
    glow.addColorStop(0.25, 'rgba(255,170,90,0.55)');
    glow.addColorStop(1, 'rgba(255,150,80,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 160, sunY - 160, 320, 320);
    ctx.fillStyle = '#ffd76e';
    ctx.beginPath(); ctx.arc(sunX, sunY, 26, 0, Math.PI * 2); ctx.fill();
    // Distant skyline silhouette on the horizon.
    ctx.fillStyle = '#241a3a';
    for (let i = 0; i < 26; i += 1) {
      const bx = (i * 53 + 11) % W, bh = 26 + ((i * 37) % 46);
      ctx.fillRect(bx, H * 0.62 - bh, 34, bh);
    }
  }

  function draw() {
    const sx = canvas.width / W, sy = canvas.height / H;
    ctx.setTransform(sx, 0, 0, sy, 0, 0);
    skyAndSun();
    items.sort((a, b) => b.depth - a.depth);
    for (const it of items) {
      if (it.kind === 'poly') {
        ctx.beginPath();
        ctx.moveTo(it.pts[0].x, it.pts[0].y);
        for (let i = 1; i < it.pts.length; i += 1) ctx.lineTo(it.pts[i].x, it.pts[i].y);
        ctx.closePath();
        ctx.fillStyle = it.fill;
        ctx.fill();
        if (it.stroke) { ctx.strokeStyle = it.stroke; ctx.lineWidth = 1; ctx.stroke(); }
      } else if (it.kind === 'rect') {
        ctx.fillStyle = it.fill;
        ctx.fillRect(it.x, it.y, it.w, it.h);
      } else if (it.kind === 'circle') {
        ctx.fillStyle = it.fill;
        ctx.beginPath(); ctx.arc(it.x, it.y, it.r, 0, Math.PI * 2); ctx.fill();
      } else if (it.kind === 'text') {
        ctx.font = `${it.weight} ${it.size}px ${'system-ui, sans-serif'}`;
        ctx.fillStyle = it.color;
        ctx.textAlign = it.align;
        ctx.textBaseline = 'middle';
        ctx.fillText(it.str, it.x, it.y);
      }
    }
    items.length = 0;
  }

  return { setCamera, project, projectNear, box, groundQuad, billboard, poly, text, circle, shade, draw, ctx };
}
