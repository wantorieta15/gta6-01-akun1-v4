// Solmar Bay world: deterministic city, beach, traffic, police, heli, missions, collectibles.
// No drawing here — render.js turns this state into pixels. Pure state + rules.
import { CAR, CITY, CREW, DISTRICTS, MISSIONS, ONFOOT, PLAYER, RADIO, WEAPONS } from './config.js';
import { createRandom, pick, range } from './random.js';

export const EVENT_NONE = 0;
export const EVENT_GECKO = 1;
export const EVENT_MISSION = 2;
export const EVENT_HIT = 4;
export const EVENT_BOUNTY = 8;

const BUILD_COLORS = ['#4a3a5e', '#5e3a4a', '#3a4a5e', '#6b4a2f', '#54423f', '#41355e'];

function inBuilding(b, x, z, pad) {
  return x > b.x - b.w / 2 - pad && x < b.x + b.w / 2 + pad && z > b.z - b.d / 2 - pad && z < b.z + b.d / 2 + pad;
}

export function createWorld(seed) {
  const rand = createRandom(seed);
  const buildings = [];
  // City blocks: roads every 52 units, buildings inside each block.
  for (let gx = CITY.minX + 26; gx < CITY.beachX - 10; gx += CITY.block) {
    for (let gz = CITY.minZ + 26; gz < CITY.maxZ - 10; gz += CITY.block) {
      const n = 1 + Math.floor(rand() * 2);
      for (let i = 0; i < n; i += 1) {
        const w = range(rand, 14, 26), d = range(rand, 14, 26);
        const x = gx + range(rand, -8, 8) + (i === 1 ? 14 : -4);
        const z = gz + range(rand, -8, 8) + (i === 1 ? -10 : 6);
        buildings.push({ x, z, w, d, h: range(rand, 10, 58), color: pick(rand, BUILD_COLORS), seed: Math.floor(rand() * 1000), winCols: 3 + Math.floor(rand() * 4), winRows: 2 + Math.floor(rand() * 6) });
      }
    }
  }
  // Palms along the boardwalk + a few on main roads.
  const palms = [];
  for (let z = -160; z <= 170; z += 22) palms.push({ x: CITY.boardwalkX - 4, z, h: range(rand, 7, 10), lean: range(rand, -0.2, 0.2) });
  for (let i = 0; i < 14; i += 1) {
    const px = range(rand, -160, 130), pz = range(rand, -160, 160);
    if (Math.hypot(px + 62, pz + 120) < 28) continue; // keep the market lane clear
    palms.push({ x: px, z: pz, h: range(rand, 6, 9), lean: range(rand, -0.15, 0.15) });
  }
  // Night-market stalls (Vice Row) — two columns flanking a clear lane at x=-62,
  // so the on-foot camera looks down the lane, not into a stall wall.
  const stalls = [];
  for (let i = 0; i < 8; i += 1) {
    stalls.push({ x: i % 2 === 0 ? -72 : -52, z: -100 - Math.floor(i / 2) * 12, color: pick(rand, ['#e5534b', '#f2c94c', '#4fc3f7', '#ff8c42', '#b388ff']), seed: i });
  }
  // Beach props for mission 6 (North Beach): umbrellas, sunbathers, boats, kiosk.
  const umbrellas = [];
  const beachPeople = [];
  for (let i = 0; i < 9; i += 1) {
    const x = range(rand, 156, 196), z = -150 + i * 9 + range(rand, -3, 3);
    umbrellas.push({ x, z, color: pick(rand, ['#ff5a5a', '#ffd76e', '#4fc3f7', '#ff8c42', '#ffffff']) });
    beachPeople.push({ x: x + range(rand, -4, 4), z: z + range(rand, -2, 4), shirt: pick(rand, ['#ff5a5a', '#4fc3f7', '#69d67a', '#ffd76e']), lying: rand() < 0.55, phase: rand() * 6 });
  }
  for (let i = 0; i < 4; i += 1) beachPeople.push({ x: range(rand, 152, 190), z: range(rand, -90, 120), shirt: pick(rand, ['#e8e8e8', '#ff8c42', '#b388ff']), lying: false, phase: rand() * 6 });
  const boats = [];
  for (let i = 0; i < 5; i += 1) boats.push({ x: range(rand, 214, 246), z: -140 + i * 62 + range(rand, -8, 8), color: pick(rand, ['#ffffff', '#ff8c42', '#4fc3f7', '#e5534b']), bob: rand() * 6 });
  const kiosk = { x: 170, z: -110, color: '#ff8c42' };
  // Golden Geckos — 12 collectibles across the city.
  const geckos = [];
  const geckoSpots = [[-40, 118], [120, 58], [168, -96], [-66, -118], [10, -20], [-110, -40], [60, 130], [-90, 140], [150, -120], [-60, -130], [30, 60], [140, 110]];
  for (const [x, z] of geckoSpots) geckos.push({ x, z, taken: false, phase: rand() * 6 });
  // Pedestrians wandering sidewalks / market / beach.
  const peds = [];
  for (let i = 0; i < 16; i += 1) {
    peds.push({ x: range(rand, -170, 140), z: range(rand, -170, 170), shirt: pick(rand, ['#ff5a5a', '#4fc3f7', '#69d67a', '#ffd76e', '#e8e8e8', '#b388ff']), dir: rand() * Math.PI * 2, speed: range(rand, 1, 2.4), phase: rand() * 6 });
  }
  // Market targets for mission 3 (on-foot shootout) — standing in the open lane.
  const targets = [];
  const targetSpots = [[-56, -116], [-68, -128], [-58, -140], [-66, -152]];
  for (let i = 0; i < 4; i += 1) targets.push({ x: targetSpots[i][0], z: targetSpots[i][1], down: false, phase: i });
  // Traffic cars on the road grid.
  const traffic = [];
  const trafficColors = ['#c94b7c', '#4fc3f7', '#e8e8e8', '#69d67a', '#f2c94c', '#8b93a3'];
  for (let i = 0; i < 10; i += 1) {
    const horizontal = rand() < 0.5;
    traffic.push({
      x: horizontal ? range(rand, -170, 140) : -169 + Math.floor(rand() * 7) * 52,
      z: horizontal ? -169 + Math.floor(rand() * 7) * 52 : range(rand, -170, 170),
      heading: horizontal ? (rand() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rand() < 0.5 ? 0 : Math.PI),
      speed: range(rand, 9, 15), color: pick(rand, trafficColors),
    });
  }
  const police = [];
  for (let i = 0; i < 3; i += 1) police.push({ x: -60 + i * 40, z: -60 - i * 30, heading: 0, speed: 0 });

  const state = {
    time: 0, elapsed: 0, shotName: '',
    player: { x: -20, z: 78, y: 0, heading: Math.PI / 2, speed: 0, onFoot: false, walkX: 0, walkZ: 0, footHeading: 0 },
    car: { x: -20, z: 78, heading: Math.PI / 2, speed: 0 },
    wanted: 3, stars: 3,
    cash: PLAYER.cash, rp: PLAYER.rp, hp: PLAYER.hp, armour: PLAYER.armour,
    missionIdx: 5, // mission 6 — Beachfront Deal (the staged story beat)
    missionStage: 2, targetsLeft: 4, geckosGot: 7,
    dialog: 'lena', dialogOn: true,
    radioIdx: 0, weaponIdx: 1, wheelOpen: false,
    drift: 0, driftTotal: 0, driftPop: 0,
    heli: { x: -8, z: 60, y: 10, rotor: 0, visible: true },
    heliDeployed: true, airBanner: true,
    missionPassed: false, passTimer: 0,
    marker: { x: 170, z: -110 },
    raceLap: 2, raceTotal: 3,
    shotsFired: 0, hits: 0,
    slipstream: 0, platesCooldown: 0, eyesOut: 0,
    message: '', messageTimer: 0,
  };
  // Mark the 7 geckos the career already owns as taken.
  for (let i = 0; i < 7; i += 1) geckos[i].taken = true;

  function districtAt(x, z) {
    let best = DISTRICTS[0], bd = Infinity;
    for (const d of DISTRICTS) {
      const dd = (d.x - x) ** 2 + (d.z - z) ** 2;
      if (dd < bd) { bd = dd; best = d; }
    }
    return best;
  }

  function mission() { return MISSIONS[state.missionIdx]; }

  function reset() {
    state.shotName = '';
    Object.assign(state.player, { x: -20, z: 78, heading: Math.PI / 2, speed: 0, onFoot: false });
    Object.assign(state.car, { x: -20, z: 78, heading: Math.PI / 2, speed: 0 });
    state.wanted = 3; state.stars = 3; state.cash = PLAYER.cash; state.rp = PLAYER.rp;
    state.hp = PLAYER.hp; state.armour = PLAYER.armour;
    state.missionIdx = 5; state.missionStage = 2; state.targetsLeft = 4;
    state.geckosGot = 7; state.dialog = 'lena'; state.dialogOn = true;
    state.radioIdx = 0; state.weaponIdx = 1; state.wheelOpen = false;
    state.drift = 0; state.driftTotal = 0; state.missionPassed = false; state.passTimer = 0;
    state.heliDeployed = true; state.airBanner = true;
    state.marker = { x: 170, z: -110 };
    for (let i = 0; i < geckos.length; i += 1) geckos[i].taken = i < 7;
    for (const t of targets) t.down = false;
  }

  function collide(x, z, pad) {
    for (const b of buildings) {
      if (inBuilding(b, x, z, pad)) {
        // Push out along the smallest penetration axis.
        const dxl = x - (b.x - b.w / 2 - pad), dxr = (b.x + b.w / 2 + pad) - x;
        const dzl = z - (b.z - b.d / 2 - pad), dzr = (b.z + b.d / 2 + pad) - z;
        const m = Math.min(dxl, dxr, dzl, dzr);
        if (m === dxl) x = b.x - b.w / 2 - pad;
        else if (m === dxr) x = b.x + b.w / 2 + pad;
        else if (m === dzl) z = b.z - b.d / 2 - pad;
        else z = b.z + b.d / 2 + pad;
        return { x, z, hit: true };
      }
    }
    return { x, z, hit: false };
  }

  function step(dt, input) {
    state.time += dt;
    state.elapsed += dt;
    let events = EVENT_NONE;
    const p = state.player;

    // Crew abilities.
    if (state.slipstream > 0) state.slipstream -= dt;
    if (state.platesCooldown > 0) state.platesCooldown -= dt;
    if (state.eyesOut > 0) state.eyesOut -= dt;
    if (state.messageTimer > 0) state.messageTimer -= dt;
    if (state.driftPop > 0) state.driftPop -= dt;
    if (state.passTimer > 0) state.passTimer -= dt;

    if (input.ability === 'slipstream' && state.slipstream <= 0) {
      state.slipstream = 3; state.message = 'SLIPSTREAM — RICO hits the nitro!'; state.messageTimer = 2.5;
    }
    if (input.ability === 'plates' && state.platesCooldown <= 0 && state.wanted > 0) {
      state.wanted = Math.max(0, state.wanted - 2); state.stars = state.wanted;
      state.platesCooldown = 20; state.message = 'SWAP PLATES — DRE drops 2 wanted stars'; state.messageTimer = 2.5;
    }
    if (input.ability === 'eyes' && state.eyesOut <= 0) {
      state.eyesOut = 8; state.message = 'EYES OUT — LENA reveals every SBPD unit'; state.messageTimer = 2.5;
    }
    if (input.radioNext) { state.radioIdx = (state.radioIdx + 1) % RADIO.length; state.message = RADIO[state.radioIdx].station; state.messageTimer = 2; }
    if (input.weaponCycle) { state.weaponIdx = (state.weaponIdx + 1) % WEAPONS.length; }
    if (input.wheelToggle) state.wheelOpen = !state.wheelOpen;

    if (!p.onFoot) {
      // --- Driving ---
      const c = state.car;
      const boost = state.slipstream > 0 ? 1.4 : 1;
      const maxSpd = CAR.maxSpeed * boost;
      if (input.up) c.speed += CAR.accel * boost * dt;
      else if (input.down) c.speed -= (c.speed > 0.5 ? CAR.brake : CAR.accel * 0.6) * dt;
      else c.speed -= Math.sign(c.speed) * Math.min(Math.abs(c.speed), 9 * dt);
      c.speed = Math.max(-CAR.reverseMax, Math.min(maxSpd, c.speed));
      const steerInput = (input.left ? 1 : 0) - (input.right ? 1 : 0);
      const spdF = Math.min(1, Math.abs(c.speed) / 18);
      c.heading += steerInput * CAR.steer * spdF * dt * Math.sign(c.speed || 1);
      // Drift: hard steering at speed builds drift points.
      if (Math.abs(steerInput) > 0 && Math.abs(c.speed) > 30) {
        state.drift += Math.abs(c.speed) * dt * 2.2;
        if (state.drift > 400) { state.driftTotal += Math.round(state.drift); state.driftPop = 2; state.drift = 0; state.rp += 25; }
      } else if (state.drift > 0) { state.driftTotal += Math.round(state.drift); state.drift = 0; }
      const nx = c.x + Math.sin(c.heading) * c.speed * dt;
      const nz = c.z + Math.cos(c.heading) * c.speed * dt;
      const sand = nx > CITY.beachX;
      const hit = collide(nx, nz, 2.2);
      if (hit.hit && Math.abs(c.speed) > 8) {
        c.speed *= -0.25; state.hp = Math.max(0, state.hp - 2); state.wanted = Math.min(5, state.wanted + (Math.random() < 0.3 ? 1 : 0)); state.stars = state.wanted;
        events |= EVENT_HIT;
      }
      c.x = Math.max(CITY.minX, Math.min(CITY.oceanX - 4, hit.x));
      c.z = Math.max(CITY.minZ, Math.min(CITY.maxZ, hit.z));
      if (sand) c.speed *= (1 - 0.4 * dt);
      p.x = c.x; p.z = c.z; p.heading = c.heading; p.speed = c.speed;
      // Wanted rises with reckless speed, falls when calm.
      if (Math.abs(c.speed) > 40 && state.wanted < 5 && Math.random() < dt * 0.05) { state.wanted += 1; state.stars = state.wanted; }
      if (input.exit) {
        p.onFoot = true; p.walkX = c.x + 3; p.walkZ = c.z + 3; p.footHeading = c.heading; p.speed = 0; c.speed = 0;
        state.message = 'On foot — press E near the car to get back in'; state.messageTimer = 3;
      }
    } else {
      // --- On foot ---
      const sp = ONFOOT.speed;
      let mx = 0, mz = 0;
      if (input.up) { mx += Math.sin(p.footHeading); mz += Math.cos(p.footHeading); }
      if (input.down) { mx -= Math.sin(p.footHeading); mz -= Math.cos(p.footHeading); }
      if (input.left) p.footHeading += 2.4 * dt;
      if (input.right) p.footHeading -= 2.4 * dt;
      const len = Math.hypot(mx, mz) || 1;
      const nx = p.walkX + (mx / len) * sp * dt * (mx || mz ? 1 : 0);
      const nz = p.walkZ + (mz / len) * sp * dt * (mx || mz ? 1 : 0);
      const hit = collide(nx, nz, 0.8);
      p.walkX = Math.max(CITY.minX, Math.min(CITY.oceanX - 2, hit.x));
      p.walkZ = Math.max(CITY.minZ, Math.min(CITY.maxZ, hit.z));
      p.x = p.walkX; p.z = p.walkZ; p.heading = p.footHeading; p.speed = (mx || mz) ? sp : 0;
      if (input.exit) {
        const d = Math.hypot(state.car.x - p.walkX, state.car.z - p.walkZ);
        if (d < 6) { p.onFoot = false; state.message = 'Back in the VESPUCCI GT'; state.messageTimer = 2; }
        else { state.message = 'Too far from the car — get closer'; state.messageTimer = 2; }
      }
      if (input.shoot && state.weaponIdx > 0) {
        const w = WEAPONS[state.weaponIdx];
        if (!w.locked) {
          state.shotsFired += 1;
          // Hit the nearest standing target roughly ahead of the player.
          let bestT = null, bd = 26;
          for (const t of targets) {
            if (t.down) continue;
            const d = Math.hypot(t.x - p.walkX, t.z - p.walkZ);
            if (d < bd) { bd = d; bestT = t; }
          }
          if (bestT) {
            bestT.down = true; state.hits += 1; state.targetsLeft = Math.max(0, state.targetsLeft - 1);
            state.rp += 120; state.cash += 250; events |= EVENT_HIT;
            if (state.targetsLeft === 0 && state.missionIdx === 2) {
              state.missionPassed = true; state.passTimer = 5; state.cash += 2400; state.rp += 600; events |= EVENT_MISSION;
            }
          }
        }
      }
    }

    // Golden Gecko pickup (driving or on foot).
    for (const g of geckos) {
      if (g.taken) continue;
      if (Math.hypot(g.x - p.x, g.z - p.z) < 4) {
        g.taken = true; state.geckosGot += 1; state.rp += 150; state.cash += 100;
        state.message = 'GOLDEN GECKO FOUND!  +150 RP'; state.messageTimer = 2.5; events |= EVENT_GECKO;
      }
    }

    // Mission marker: reach it to advance the story beat (the big banner announces it).
    const md = Math.hypot(state.marker.x - p.x, state.marker.z - p.z);
    if (md < 7 && !state.missionPassed) {
      state.missionPassed = true; state.passTimer = 5;
      state.cash += 3200; state.rp += 800;
      events |= EVENT_MISSION;
    }

    // Traffic moves along the grid and wraps.
    for (const t of traffic) {
      t.x += Math.sin(t.heading) * t.speed * dt;
      t.z += Math.cos(t.heading) * t.speed * dt;
      if (t.x > CITY.beachX - 6 || t.x < CITY.minX || t.z > CITY.maxZ || t.z < CITY.minZ) {
        t.heading += Math.PI; // turn around at the edge
      }
    }
    // Pedestrians wander.
    for (const pd of peds) {
      pd.dir += (Math.random() - 0.5) * dt * 0.8;
      pd.x += Math.sin(pd.dir) * pd.speed * dt;
      pd.z += Math.cos(pd.dir) * pd.speed * dt;
      if (pd.x > CITY.beachX - 2 || pd.x < CITY.minX || pd.z > CITY.maxZ || pd.z < CITY.minZ) pd.dir += Math.PI;
    }
    // Police chase the player when wanted.
    const want = state.wanted;
    for (let i = 0; i < police.length; i += 1) {
      const u = police[i];
      if (want === 0) { u.speed = Math.max(0, u.speed - 10 * dt); continue; }
      const dx = p.x - u.x, dz = p.z - u.z;
      const dist = Math.hypot(dx, dz) || 1;
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - u.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      u.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, dh));
      u.speed = Math.min(34 + want * 2, u.speed + 12 * dt);
      if (dist > 90) { // respawn closer so the chase never dies
        u.x = p.x - Math.sin(p.heading) * 55 + (i - 1) * 14;
        u.z = p.z - Math.cos(p.heading) * 55;
      }
      u.x += Math.sin(u.heading) * u.speed * dt;
      u.z += Math.cos(u.heading) * u.speed * dt;
      if (dist < 5 && Math.abs(p.speed) > 2) { p.speed *= 0.9; }
    }
    // Heli shadows the player at 3+ stars — low and ahead, so it stays in frame.
    const h = state.heli;
    h.rotor += dt * 22;
    h.visible = want >= 3;
    state.heliDeployed = want >= 3;
    state.airBanner = want >= 3;
    if (h.visible) {
      h.x += (p.x + Math.sin(p.heading) * 26 - h.x) * Math.min(1, dt * 0.8);
      h.z += (p.z + Math.cos(p.heading) * 26 - h.z) * Math.min(1, dt * 0.8);
      h.y += (10 - h.y) * Math.min(1, dt * 0.5);
    }
    return events;
  }

  // Stage a fixed scene for a dossier screenshot (deterministic, no input).
  function stageShot(name) {
    reset();
    state.shotName = name;
    state.time = 0;
    if (name === 'chase') {
      state.missionIdx = 1; state.missionStage = 2;
      state.wanted = 5; state.stars = 5;
      // On road z=26, heading east — car, police and traffic all on the same road.
      state.player.x = -60; state.player.z = 26; state.player.heading = Math.PI / 2; state.player.speed = 46;
      state.car.x = -60; state.car.z = 26; state.car.heading = Math.PI / 2; state.car.speed = 46;
      // Heli BIG and in-frame: just ahead-left of the player, low.
      state.heli.x = -30; state.heli.z = 22; state.heli.y = 9; state.heli.visible = true;
      state.heliDeployed = true; state.airBanner = true;
      state.dialog = 'rico'; state.dialogOn = true;
      state.marker = { x: 60, z: 26 };
      police[0].x = -82; police[0].z = 26; police[0].heading = Math.PI / 2; police[0].speed = 40;
      police[1].x = -38; police[1].z = 31; police[1].heading = Math.PI / 2; police[1].speed = 38;
      police[2].x = -58; police[2].z = 52; police[2].heading = Math.PI / 2; police[2].speed = 36;
      traffic[0].x = -20; traffic[0].z = 26; traffic[0].heading = Math.PI / 2; traffic[0].speed = 12;
      traffic[1].x = -95; traffic[1].z = 30; traffic[1].heading = -Math.PI / 2; traffic[1].speed = 12;
      state.driftTotal = 1240; state.driftPop = 3;
      state.message = ''; state.messageTimer = 0;
    } else if (name === 'street') {
      state.missionIdx = 2; state.missionStage = 1;
      state.wanted = 4; state.stars = 4;
      state.player.onFoot = true;
      state.player.walkX = -58; state.player.walkZ = -100; state.player.footHeading = Math.PI;
      state.player.x = -58; state.player.z = -100; state.player.heading = Math.PI;
      state.car.x = -78; state.car.z = -92; state.car.heading = Math.PI / 2; state.car.speed = 0;
      state.weaponIdx = 2; state.wheelOpen = true;
      state.dialog = 'dre'; state.dialogOn = true;
      state.heli.x = -48; state.heli.z = -126; state.heli.y = 10; state.heli.visible = true;
      state.heliDeployed = true; state.airBanner = true;
      targets[0].down = true; state.targetsLeft = 3;
      state.marker = { x: -62, z: -128 };
      police[0].x = -40; police[0].z = -140; police[0].heading = Math.PI; police[0].speed = 20;
      state.message = 'TARGET DOWN — 3 LEFT'; state.messageTimer = 3;
    } else if (name === 'mission') {
      state.missionIdx = 5; state.missionStage = 3;
      state.wanted = 0; state.stars = 0;
      state.player.x = 150; state.player.z = -112; state.player.heading = 1.15; state.player.speed = 0;
      state.car.x = 146; state.car.z = -118; state.car.heading = 1.15; state.car.speed = 0;
      state.heli.visible = false; state.heliDeployed = false; state.airBanner = false;
      state.dialog = 'rico'; state.dialogOn = true;
      state.missionPassed = true; state.passTimer = 6;
      state.marker = { x: 170, z: -110 };
      state.message = ''; state.messageTimer = 0;
    } else if (name === 'pause') {
      state.missionIdx = 5; state.missionStage = 3;
      state.wanted = 2; state.stars = 2;
      state.player.x = 40; state.player.z = 78; state.player.heading = Math.PI / 2; state.player.speed = 0;
      state.car.x = 40; state.car.z = 78; state.car.heading = Math.PI / 2; state.car.speed = 0;
      state.heli.visible = false; state.heliDeployed = false; state.airBanner = false;
      state.dialogOn = false;
      state.marker = { x: 170, z: -110 };
    }
    return state;
  }

  return {
    state, buildings, palms, stalls, umbrellas, beachPeople, boats, kiosk,
    geckos, peds, targets, traffic, police,
    districtAt, mission, reset, step, stageShot,
  };
}
