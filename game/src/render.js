// Rendering: turns world state into the 3D canvas frame and keeps every HUD panel in sync.
// Screens: title (orbiting city), play (chase cam), paused (dimmed city + map overlay).
import { CITY, CREW, DIALOGS, DISTRICTS, FIELD, MISSIONS, PALETTE, PLAYER, RADIO, SAVE_SLOTS, SBPD_UNITS, WEAPONS, CAREER } from './config.js';
import { createCamera, createScene } from './engine3d.js';

const $ = (id) => document.getElementById(id);

function fmt(n) { return n.toLocaleString('en-US'); }

export function createRenderer(canvas, world) {
  const scene = createScene(canvas);
  const cam = createCamera();
  const state = world.state;
  let lastShotFlash = -10;
  let lastShots = 0;

  function near(x, z, r) {
    const dx = x - cam.pos.x, dz = z - cam.pos.z;
    return dx * dx + dz * dz < r * r;
  }

  function drawGround() {
    const tile = 26;
    for (let x = CITY.minX; x < CITY.oceanX + 40; x += tile) {
      for (let z = CITY.minZ; z < CITY.maxZ; z += tile) {
        const cx = x + tile / 2, cz = z + tile / 2;
        if (!near(cx, cz, 175)) continue;
        let fill;
        if (cx > CITY.oceanX) fill = (Math.floor(cx / 26) + Math.floor(cz / 26)) % 2 ? PALETTE.ocean : PALETTE.oceanDeep;
        else if (cx > CITY.beachX) fill = PALETTE.sand;
        else if (cx > CITY.boardwalkX - 8 && cx < CITY.boardwalkX + 4) fill = PALETTE.boardwalk;
        else fill = PALETTE.sidewalk;
        scene.groundQuad(x, z, x + tile, z + tile, 0, fill);
      }
    }
    // Roads: asphalt strips along every grid line, with centre dashes — drawn over the
    // sidewalk base so the street network reads clearly from the chase camera.
    for (let k = 0; k <= 7; k += 1) {
      const v = CITY.minX + k * CITY.block;
      for (let z = CITY.minZ; z < CITY.maxZ; z += tile) {
        if (!near(v, z + 13, 175)) continue;
        scene.groundQuad(v - 7, z, v + 7, z + tile, 0.01, PALETTE.asphalt, -0.25);
        if (near(v, z + 13, 95) && Math.floor((z + 13) / 14) % 2 === 0) scene.groundQuad(v - 0.4, z + 10, v + 0.4, z + 16, 0.02, PALETTE.asphaltLine, -0.5);
      }
      for (let x = CITY.minX; x < CITY.beachX; x += tile) {
        if (!near(x + 13, v, 175)) continue;
        scene.groundQuad(x, v - 7, x + tile, v + 7, 0.01, PALETTE.asphalt, -0.25);
        if (near(x + 13, v, 95) && Math.floor((x + 13) / 14) % 2 === 0) scene.groundQuad(x + 10, v - 0.4, x + 16, v + 0.4, 0.02, PALETTE.asphaltLine, -0.5);
      }
    }
    // Ocean wave lines.
    for (let i = 0; i < 8; i += 1) {
      const z = -160 + i * 46 + Math.sin(state.time * 0.7 + i) * 3;
      scene.groundQuad(CITY.oceanX + 6, z, CITY.oceanX + 60, z + 1.2, 0.03, 'rgba(255,255,255,0.25)', -0.4);
    }
  }

  function drawCar(x, z, heading, color, opts = {}) {
    const fx = Math.sin(heading), fz = Math.cos(heading);
    const rx = Math.cos(heading), rz = -Math.sin(heading);
    const y = 0.55;
    const rot = heading;
    // Body + cabin + hood details (rotated to the car's heading).
    scene.box(x, y, z, 2.1, 0.75, 4.6, color, { top: scene.shade(color, 1.25), rot });
    scene.box(x + fx * -0.3, y + 0.62, z + fz * -0.3, 1.8, 0.6, 2.4, '#1c2733', { top: '#2c3e50', rot });
    // Wheels.
    for (const [sx, sz] of [[-1, 1.5], [1, 1.5], [-1, -1.5], [1, -1.5]]) {
      scene.box(x + rx * sx * 1.0 + fx * sz, 0.35, z + rz * sx * 1.0 + fz * sz, 0.35, 0.7, 0.9, '#111111', { rot });
    }
    // Headlights (front) + taillights.
    const hx = x + fx * 2.35, hz = z + fz * 2.35;
    scene.circle(hx + rx * 0.7, 0.6, hz + rz * 0.7, 0.5, '#fff2b0');
    scene.circle(hx - rx * 0.7, 0.6, hz - rz * 0.7, 0.5, '#fff2b0');
    if (opts.police) {
      // Light bar — red/blue flash, alternating with time.
      const phase = Math.floor(state.time * 4) % 2 === 0;
      scene.box(x + fx * -0.3, y + 1.05, z + fz * -0.3, 1.1, 0.22, 0.5, phase ? '#ff2d2d' : '#2255ff', { rot });
      scene.box(x, y + 0.15, z, 2.16, 0.5, 4.66, '#f2f2f2', { rot });
      scene.text('SBPD', x, 1.4, z, 16, '#111111', 'center', '900');
    }
    if (opts.player) {
      // Sunset stripe + spoiler.
      scene.box(x + fx * -2.1, y + 0.75, z + fz * -2.1, 1.9, 0.14, 0.5, '#ffd76e', { rot });
    }
  }

  function drawPerson(x, z, shirt, opts = {}) {
    const h = opts.lying ? 0.5 : 1.75;
    const bob = opts.lying ? 0 : Math.sin(state.time * 3 + (opts.phase || 0)) * 0.04;
    scene.box(x, h / 2 + bob, z, 0.7, h, 0.45, shirt);
    if (!opts.lying) scene.circle(x, 1.95 + bob, z, 0.42, '#e8b98a');
    else scene.circle(x + 0.5, 0.55, z, 0.42, '#e8b98a');
    if (opts.gun) {
      const fx = Math.sin(opts.heading || 0), fz = Math.cos(opts.heading || 0);
      scene.box(x + fx * 0.7, 1.2, z + fz * 0.7, 0.16, 0.16, 0.9, '#222222', { rot: opts.heading || 0 });
    }
  }

  function drawPalm(x, z, h, lean) {
    scene.box(x, h / 2, z, 0.35, h, 0.35, PALETTE.palmTrunk);
    const top = { x: x + lean, y: h, z };
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2 + 0.4;
      const tip = { x: top.x + Math.cos(a) * 2.4, y: top.y - 1.1, z: top.z + Math.sin(a) * 2.4 };
      const p0 = scene.project(top.x, top.y, top.z);
      const p1 = scene.project(tip.x, tip.y, tip.z);
      const p2 = scene.project(top.x + Math.cos(a + 0.5) * 1.4, top.y - 0.5, top.z + Math.sin(a + 0.5) * 1.4);
      if (p0 && p1 && p2) scene.poly([p0, p1, p2], i % 2 ? '#2f7a3a' : '#3a8a44', Math.hypot(top.x - cam.pos.x, top.z - cam.pos.z));
    }
    // Coconuts.
    scene.circle(top.x, top.y - 0.3, top.z, 0.5, '#6b4a2f');
  }

  function drawUmbrella(u) {
    scene.box(u.x, 1.1, u.z, 0.14, 2.2, 0.14, '#e8e8e8');
    const apex = scene.project(u.x, 2.6, u.z);
    if (!apex) return;
    const rim = [];
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      rim.push(scene.project(u.x + Math.cos(a) * 2.1, 1.9, u.z + Math.sin(a) * 2.1));
    }
    const depth = Math.hypot(u.x - cam.pos.x, u.z - cam.pos.z);
    for (let i = 0; i < 8; i += 1) {
      const p1 = rim[i], p2 = rim[(i + 1) % 8];
      if (!p1 || !p2) continue;
      scene.poly([apex, p1, p2], i % 2 ? u.color : '#ffffff', depth);
    }
  }

  function drawBoat(b) {
    const bob = Math.sin(state.time * 0.9 + b.bob) * 0.25;
    scene.box(b.x, 0.5 + bob, b.z, 2.4, 0.9, 6.5, b.color, { top: scene.shade(b.color, 1.2) });
    scene.box(b.x, 2.2 + bob, b.z, 0.12, 3.4, 0.12, '#8a6a4a');
    const apex = scene.project(b.x, 3.9 + bob, b.z + 1.2);
    const p1 = scene.project(b.x, 0.6 + bob, b.z + 2.6);
    const p2 = scene.project(b.x, 0.6 + bob, b.z - 1.6);
    if (apex && p1 && p2) scene.poly([apex, p1, p2], '#ffffff', Math.hypot(b.x - cam.pos.x, b.z - cam.pos.z));
  }

  function drawHeli() {
    const h = state.heli;
    if (!h.visible) return;
    // BIG helicopter: bright white body + orange stripe so it reads against dark buildings.
    // Body, tail, skids, wide spinning rotor, searchlight cone.
    scene.box(h.x, h.y, h.z, 7.0, 4.5, 9.6, '#e8e8e8', { top: '#ffffff' });
    scene.box(h.x, h.y + 0.7, h.z - 8.6, 1.6, 1.6, 10.0, '#e8e8e8');
    scene.box(h.x, h.y + 2.8, h.z - 13.2, 0.8, 3.2, 0.7, '#e5534b');
    scene.box(h.x - 2.4, h.y - 2.8, h.z + 1.6, 0.4, 0.9, 6.2, '#111111');
    scene.box(h.x + 2.4, h.y - 2.8, h.z + 1.6, 0.4, 0.9, 6.2, '#111111');
    // Rotor: two long blades rotating, drawn as a wide thin box pair.
    const ra = h.rotor;
    const tip1 = { x: h.x + Math.cos(ra) * 10.5, z: h.z + Math.sin(ra) * 10.5 };
    const tip2 = { x: h.x - Math.cos(ra) * 10.5, z: h.z - Math.sin(ra) * 10.5 };
    const p0 = scene.project(h.x, h.y + 2.8, h.z);
    const p1 = scene.project(tip1.x, h.y + 1.5, tip1.z);
    const p2 = scene.project(tip2.x, h.y + 1.5, tip2.z);
    if (p0 && p1 && p2) {
      scene.poly([p0, p1, p2], 'rgba(220,220,220,0.55)', Math.hypot(h.x - cam.pos.x, h.z - cam.pos.z));
      scene.poly([p0, scene.project(tip1.x, h.y + 2.6, tip1.z), scene.project(tip2.x, h.y + 2.6, tip2.z)], 'rgba(180,180,180,0.4)', Math.hypot(h.x - cam.pos.x, h.z - cam.pos.z));
    }
    // Orange stripe so the white body reads against dark buildings; label UNDER the heli
    // so it never hides behind the mission header panel.
    scene.box(h.x, h.y - 0.6, h.z, 7.1, 0.7, 9.7, '#ff8c42');
    scene.text('AIR-1', h.x, h.y - 4.8, h.z, 20, '#ffd76e', 'center', '900');
    // Searchlight: thick cone from belly to the player + bright ground pool.
    const belly = scene.project(h.x, h.y - 2.4, h.z);
    const ground = scene.project(state.player.x, 0.1, state.player.z);
    if (belly && ground) {
      const spread = 62;
      scene.poly([
        belly,
        { x: ground.x - spread, y: ground.y, depth: belly.depth },
        { x: ground.x + spread, y: ground.y, depth: belly.depth },
      ], 'rgba(255,240,170,0.20)', belly.depth - 1);
      scene.poly([
        belly,
        { x: ground.x - spread * 0.55, y: ground.y - 26, depth: belly.depth },
        { x: ground.x + spread * 0.55, y: ground.y - 26, depth: belly.depth },
      ], 'rgba(255,240,170,0.13)', belly.depth - 1);
    }
    scene.circle(state.player.x, 0.15, state.player.z, 2.2, 'rgba(255,240,170,0.22)');
    scene.circle(state.player.x, 0.15, state.player.z, 1.3, 'rgba(255,240,170,0.3)');
  }

  function drawMarker() {
    const m = state.marker;
    const pulse = 0.75 + Math.sin(state.time * 3) * 0.25;
    // Light pillar (narrow, faint — it must not hide the player standing in the lane).
    scene.billboard(m.x, 5, m.z, 1.4, 9, `rgba(255,215,110,${0.12 * pulse})`);
    // Floating diamond.
    const cy = 7 + Math.sin(state.time * 2) * 0.5;
    const d = 1.6;
    const pts = [
      scene.project(m.x, cy + d, m.z), scene.project(m.x + d, cy, m.z),
      scene.project(m.x, cy - d, m.z), scene.project(m.x - d, cy, m.z),
    ];
    if (pts.every(Boolean)) scene.poly(pts, '#ffd76e', Math.hypot(m.x - cam.pos.x, m.z - cam.pos.z));
    scene.circle(m.x, 0.2, m.z, 2.2, 'rgba(255,215,110,0.4)');
  }

  function drawWorld3D() {
    scene.setCamera(cam);
    drawGround();
    for (const b of world.buildings) {
      if (!near(b.x, b.z, 210)) continue;
      scene.box(b.x, b.h / 2, b.z, b.w, b.h, b.d, b.color, { top: scene.shade(b.color, 1.3), win: { cols: b.winCols, rows: b.winRows, seed: b.seed } });
    }
    for (const pl of world.palms) if (near(pl.x, pl.z, 160)) drawPalm(pl.x, pl.z, pl.h, pl.lean);
    // Night-market stalls.
    for (const s of world.stalls) {
      if (!near(s.x, s.z, 150)) continue;
      scene.box(s.x, 1.1, s.z, 4.4, 2.2, 3, '#7a5a3a');
      scene.box(s.x, 2.5, s.z, 5, 0.35, 3.6, s.color);
      scene.box(s.x, 1.0, s.z + 1.8, 4.4, 1.4, 0.3, s.color);
      for (let i = 0; i < 5; i += 1) {
        const lx = s.x - 2 + i;
        scene.circle(lx, 2.9, s.z + 1.9, 0.35, i % 2 ? '#ffd76e' : '#ff9a52');
      }
      scene.text('MARKET', s.x, 3.1, s.z, 12, '#ffd76e', 'center', '800');
    }
    // Beach kiosk + umbrellas + people + boats.
    const k = world.kiosk;
    if (near(k.x, k.z, 200)) {
      scene.box(k.x, 1.5, k.z, 5, 3, 4, '#f2e8d5');
      for (let i = 0; i < 5; i += 1) scene.box(k.x - 2.2 + i * 1.1, 3.2, k.z + 2.2, 1.1, 0.25, 0.6, i % 2 ? '#ff5a5a' : '#ffffff');
      scene.text('BEACH KIOSK', k.x, 4.2, k.z, 18, '#ffd76e', 'center', '900');
      scene.text('COLD DRINKS · SUNSET TOURS', k.x, 1.5, k.z + 2.1, 10, '#5a3a1a', 'center', '700');
    }
    for (const u of world.umbrellas) if (near(u.x, u.z, 150)) drawUmbrella(u);
    for (const bp of world.beachPeople) {
      if (!near(bp.x, bp.z, 120)) continue;
      drawPerson(bp.x, bp.z, bp.shirt, { lying: bp.lying, phase: bp.phase });
    }
    for (const b of world.boats) if (near(b.x, b.z, 220)) drawBoat(b);
    // Golden Geckos.
    for (const g of world.geckos) {
      if (g.taken || !near(g.x, g.z, 120)) continue;
      const bob = 1 + Math.sin(state.time * 2.4 + g.phase) * 0.35;
      scene.circle(g.x, bob, g.z, 1.6, 'rgba(255,215,110,0.35)');
      scene.circle(g.x, bob, g.z, 0.9, '#ffd76e');
      scene.text('🦎', g.x, bob + 0.6, g.z, 18, '#7a4a00', 'center', '900');
    }
    // Pedestrians.
    for (const pd of world.peds) if (near(pd.x, pd.z, 130)) drawPerson(pd.x, pd.z, pd.shirt, { phase: pd.phase });
    // Market targets (mission 3).
    for (const t of world.targets) {
      if (t.down) continue;
      drawPerson(t.x, t.z, '#e5534b', { phase: t.phase, gun: true, heading: Math.PI });
      scene.text('TARGET', t.x, 2.6, t.z, 14, '#ff6b6b', 'center', '900');
    }
    // Traffic + police.
    for (const t of world.traffic) if (near(t.x, t.z, 170)) drawCar(t.x, t.z, t.heading, t.color);
    for (const u of world.police) if (near(u.x, u.z, 190)) drawCar(u.x, u.z, u.heading, '#f2f2f2', { police: true });
    // Player car (always) + on-foot figure.
    const c = state.car;
    drawCar(c.x, c.z, c.heading, '#ff6b35', { player: true });
    if (state.player.onFoot) {
      drawPerson(state.player.walkX, state.player.walkZ, '#ff6b35', { phase: 0, gun: state.weaponIdx > 0, heading: state.player.footHeading });
      if (state.shotsFired !== lastShots) { lastShotFlash = state.time; lastShots = state.shotsFired; }
      if (state.time - lastShotFlash < 0.09) {
        const fx = Math.sin(state.player.footHeading), fz = Math.cos(state.player.footHeading);
        scene.circle(state.player.walkX + fx * 1.4, 1.3, state.player.walkZ + fz * 1.4, 1.4, 'rgba(255,220,120,0.9)');
      }
    }
    drawHeli();
    drawMarker();
    scene.draw();
  }

  function frameCamera(screen, t) {
    if (screen === 'title') {
      const a = t * 0.045;
      cam.pos.x = Math.sin(a) * 120; cam.pos.y = 42; cam.pos.z = Math.cos(a) * 120;
      cam.yaw = Math.atan2(-cam.pos.x, -cam.pos.z); cam.pitch = -0.3;
      return;
    }
    const p = state.player;
    if (p.onFoot) cam.follow({ x: p.walkX, z: p.walkZ, y: 1 }, p.footHeading, 10, 4.5, 9);
    else if (state.shotName === 'mission') cam.follow({ x: state.car.x, z: state.car.z, y: 0 }, state.car.heading, 17, 6.5, 12);
    else cam.follow({ x: state.car.x, z: state.car.z, y: 0 }, state.car.heading, 10, 4.2, 10);
    cam.pitch = -0.16;
  }

  // ---------- HUD ----------
  function setText(id, v) {
    const el = $(id);
    if (el && el.textContent !== v) el.textContent = v;
  }
  function show(id, on) {
    const el = $(id);
    if (el) el.style.display = on ? '' : 'none';
  }

  function updateHud() {
    const m = world.mission();
    const d = world.districtAt(state.player.x, state.player.z);
    const mph = Math.round(Math.abs(state.player.onFoot ? 0 : state.car.speed) * 2.24);
    setText('hud-stars', '★'.repeat(state.stars) + '☆'.repeat(5 - state.stars));
    setText('hud-money', '$' + fmt(state.cash));
    setText('hud-rank', `RANK ${PLAYER.rank} — ${PLAYER.rankName}`);
    setText('hud-rp', `${fmt(state.rp)} / ${fmt(PLAYER.rpNext)} RP`);
    $('hud-rpfill').style.width = `${Math.min(100, (state.rp / PLAYER.rpNext) * 100)}%`;
    setText('hud-hp', `HP ${state.hp}`);
    setText('hud-armour', `ARMOUR ${state.armour}`);
    setText('hud-rep', `REP ${PLAYER.rep}`);
    $('hud-hpfill').style.width = `${state.hp}%`;
    $('hud-armfill').style.width = `${state.armour}%`;
    setText('hud-mission-name', `${m.id}. ${m.name}`);
    setText('hud-mission-stage', `STAGE ${m.stage}`);
    setText('hud-mission-obj', m.objective);
    setText('hud-mission-next', `NEXT ▸ ${MISSIONS[Math.min(7, m.id)].name}`);
    show('hud-airbanner', state.airBanner);
    show('hud-sbpd', state.wanted > 0); // no pursuit, no panel — keeps the beach shot clean
    // SBPD unit rows (name + role + LIVE distance from the police cars).
    const rows = $('hud-sbpd-rows');
    if (rows) {
      const dists = world.police.map((u) => Math.round(Math.hypot(u.x - state.player.x, u.z - state.player.z)) + 'm');
      rows.innerHTML = SBPD_UNITS.map((u, i) => `<div class="sbpd-row"><span class="sbpd-call">${u.call}</span><span class="sbpd-role">${u.role}</span><span class="sbpd-dist">${i < 3 ? dists[i] : u.dist}</span></div>`).join('');
    }
    // Crew panel.
    const crew = $('hud-crew-rows');
    if (crew && !crew.dataset.built) {
      crew.dataset.built = '1';
      crew.innerHTML = CREW.map((c, i) => `<div class="crew-row"><span class="crew-dot" style="background:${c.color}"></span><span class="crew-name">${c.name}</span><span class="crew-role">${c.role}</span><span class="crew-ability">[${c.key}] ${c.ability}</span><span class="crew-state">${c.active ? 'READY' : 'COOLDOWN'}</span></div>`).join('');
    }
    // Speedo / car / radio.
    setText('hud-speed', String(mph));
    setText('hud-car', state.player.onFoot ? `ON FOOT — ${d.name}` : PLAYER.carName);
    setText('hud-damage', `DAMAGE ${PLAYER.carDamage}%`);
    $('hud-dmgfill').style.width = `${100 - PLAYER.carDamage}%`;
    const r = RADIO[state.radioIdx];
    setText('hud-radio-station', '♪ ' + r.station);
    setText('hud-radio-song', r.song);
    // District + standing (HUD copy — fix (e)).
    setText('hud-district', d.name);
    setText('hud-standing-label', `${d.label} — ${d.standing}%`);
    $('hud-standing-fill').style.width = `${d.standing}%`;
    setText('hud-gecko', `🦎 GOLDEN GECKO  ${state.geckosGot}/12`);
    // Toast / drift / mission-passed.
    show('hud-toast', state.messageTimer > 0);
    setText('hud-toast-text', state.message);
    show('hud-drift', state.driftPop > 0);
    setText('hud-drift-text', `DRIFT +${fmt(state.driftTotal)} PTS`);
    show('hud-passed', state.missionPassed && state.passTimer > 0);
    setText('hud-passed-text', `MISSION PASSED — “${m.name}”  ·  RATING ${m.rating}`);
    // Weapon wheel.
    show('hud-wheel', state.wheelOpen);
    const wheel = $('hud-wheel-slots');
    if (wheel && !wheel.dataset.built) {
      wheel.dataset.built = '1';
      wheel.innerHTML = WEAPONS.map((w, i) => `<div class="wheel-slot${w.locked ? ' locked' : ''}" data-i="${i}"><b>${i + 1} · ${w.name}</b><span>${w.locked ? w.lockNote : 'AMMO ' + w.ammo + ' / ' + w.total}</span></div>`).join('');
    }
    if (wheel) {
      for (const el of wheel.children) el.classList.toggle('sel', Number(el.dataset.i) === state.weaponIdx);
    }
    // Dialog.
    show('hud-dialog', state.dialogOn);
    if (state.dialogOn) {
      const dg = DIALOGS[state.dialog];
      setText('hud-dialog-name', dg.name);
      setText('hud-dialog-line', dg.line);
      const av = $('hud-dialog-avatar');
      av.textContent = dg.initials;
      av.style.background = dg.color;
    }
    drawMinimap($('hud-minimap'), 168, false);
  }

  // ---------- Minimap / pause map ----------
  function drawMinimap(cv, size, big) {
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const S = size;
    const scale = S / (CITY.maxX - CITY.minX + 120);
    const ox = S / 2, oz = S / 2;
    const X = (x) => ox + x * scale;
    const Z = (z) => oz + z * scale;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#14121f';
    ctx.fillRect(0, 0, S, S);
    // Ocean + sand.
    ctx.fillStyle = '#0f4a6b';
    ctx.fillRect(X(CITY.oceanX), 0, S - X(CITY.oceanX), S);
    ctx.fillStyle = '#e8c88f';
    ctx.fillRect(X(CITY.beachX), 0, X(CITY.oceanX) - X(CITY.beachX), S);
    // Roads.
    ctx.strokeStyle = '#3a3a46';
    ctx.lineWidth = big ? 5 : 3;
    for (let k = 0; k <= 7; k += 1) {
      const v = CITY.minX + k * CITY.block;
      ctx.beginPath(); ctx.moveTo(X(v), Z(CITY.minZ)); ctx.lineTo(X(v), Z(CITY.maxZ)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(X(CITY.minX), Z(v)); ctx.lineTo(X(CITY.beachX), Z(v)); ctx.stroke();
    }
    // District dots + labels on the big map.
    if (big) {
      ctx.font = '700 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      for (const d of DISTRICTS) {
        ctx.fillStyle = '#ffd76e';
        ctx.beginPath(); ctx.arc(X(d.x), Z(d.z), 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText(d.name, X(d.x), Z(d.z) - 8);
        ctx.fillStyle = d.standing >= 70 ? '#69d67a' : d.standing >= 45 ? '#ffd76e' : '#ff6b6b';
        ctx.fillText(`${d.label} ${d.standing}%`, X(d.x), Z(d.z) + 16);
      }
    }
    // Geckos.
    ctx.fillStyle = '#ffd76e';
    for (const g of world.geckos) {
      if (g.taken) continue;
      ctx.beginPath(); ctx.arc(X(g.x), Z(g.z), big ? 3 : 2, 0, Math.PI * 2); ctx.fill();
    }
    // Mission marker.
    ctx.fillStyle = '#ffd76e';
    const mx = X(state.marker.x), mz = Z(state.marker.z);
    ctx.beginPath(); ctx.moveTo(mx, mz - 7); ctx.lineTo(mx + 6, mz); ctx.lineTo(mx, mz + 7); ctx.lineTo(mx - 6, mz); ctx.closePath(); ctx.fill();
    // Police + heli.
    ctx.fillStyle = '#4fc3f7';
    for (const u of world.police) { ctx.beginPath(); ctx.arc(X(u.x), Z(u.z), 3, 0, Math.PI * 2); ctx.fill(); }
    if (state.heli.visible) {
      ctx.fillStyle = '#ff8c42';
      ctx.beginPath(); ctx.arc(X(state.heli.x), Z(state.heli.z), 4, 0, Math.PI * 2); ctx.fill();
    }
    // Player arrow.
    const px = X(state.player.x), pz = Z(state.player.z);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(Math.atan2(Math.sin(state.player.heading), Math.cos(state.player.heading)) * -1 + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // ---------- Pause overlay ----------
  function updatePause() {
    drawMinimap($('pause-map'), 360, true);
    const list = $('pause-districts');
    if (list && !list.dataset.built) {
      list.dataset.built = '1';
      list.innerHTML = DISTRICTS.map((d) => `<div class="district-row"><span>${d.name}</span><span class="district-bar"><i style="width:${d.standing}%;background:${d.standing >= 70 ? '#69d67a' : d.standing >= 45 ? '#ffd76e' : '#ff6b6b'}"></i></span><span>${d.label} ${d.standing}%</span></div>`).join('');
    }
    const stats = $('pause-stats');
    if (stats && !stats.dataset.built) {
      stats.dataset.built = '1';
      stats.innerHTML = CAREER.map((c) => `<div class="stat-row"><span>${c.k}</span><b>${c.v}</b></div>`).join('');
    }
    const checks = $('pause-missions');
    if (checks && !checks.dataset.built) {
      checks.dataset.built = '1';
      checks.innerHTML = MISSIONS.map((m) => `<div class="check-row"><span class="check-${m.id <= 5 ? 'done' : m.id === 6 ? 'now' : 'todo'}">${m.id <= 5 ? '✓' : m.id === 6 ? '▶' : '○'}</span><span>${m.id}. ${m.name}</span><span>${m.objective}</span><b>${m.rating}</b></div>`).join('');
    }
    const slots = $('pause-slots');
    if (slots && !slots.dataset.built) {
      slots.dataset.built = '1';
      slots.innerHTML = SAVE_SLOTS.map((s) => `<div class="slot${s.n === 1 ? ' sel' : ''}"><b>${s.label}</b><span>${s.detail}</span><i>${s.state}</i></div>`).join('');
    }
  }

  // ---------- Title overlay ----------
  function updateTitle() {
    const slots = $('title-slots');
    if (slots && !slots.dataset.built) {
      slots.dataset.built = '1';
      slots.innerHTML = SAVE_SLOTS.map((s) => `<div class="slot${s.n === 1 ? ' sel' : ''}"><b>${s.label}</b><span>${s.detail}</span><i>${s.state}</i></div>`).join('');
    }
  }

  // ---------- Main draw ----------
  function draw(screen, t) {
    frameCamera(screen, t);
    drawWorld3D();
    if (screen === 'play') {
      show('hud', true); show('title-screen', false); show('pause-screen', false);
      updateHud();
    } else if (screen === 'title') {
      show('hud', false); show('title-screen', true); show('pause-screen', false);
      updateTitle();
    } else if (screen === 'paused') {
      show('hud', false); show('title-screen', false); show('pause-screen', true);
      updatePause();
    }
  }

  return { draw, updateHud, updatePause, updateTitle };
}
