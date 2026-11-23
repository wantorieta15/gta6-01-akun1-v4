// Boot + main loop. Screens: title -> play -> paused -> play.
// ?shot=chase|street|mission|pause stages that scene, paints it, sets window.__shotReady.
// ?seed=N fixes the world layout; without it the seed is random per visit.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { createRenderer } from './render.js';
import { createInput } from './input.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas, world);

function announce(msg) { status.textContent = msg; }

if (shot) {
  // Screenshot mode: stage, paint a few frames (panels + minimap settle), signal ready.
  const staged = stageShot(shot, world);
  let painted = 0;
  function paint() {
    renderer.draw(staged.screen, world.state.time);
    painted += 1;
    if (painted < 4) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
} else {
  const input = createInput();
  let screen = 'title';
  let accumulator = 0;
  let last = performance.now();
  let shootCooldown = 0;
  const MAX_FRAME = 0.25;

  function startGame() {
    world.reset();
    screen = 'play';
    announce('Playing. Mission 6, Beachfront Deal. Drive to the yellow marker.');
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    shootCooldown = Math.max(0, shootCooldown - (now - (frame._prev || now)) / 1000);
    frame._prev = now;

    const edges = input.takeEdges();
    const mv = input.move();

    if (screen === 'title' && edges.confirm) startGame();
    else if (screen === 'play' && edges.pause) { screen = 'paused'; announce('Paused. Map, career, missions and saves.'); }
    else if (screen === 'paused' && (edges.pause || edges.confirm)) { screen = 'play'; announce('Playing.'); }

    if (screen === 'play') {
      const st = world.state;
      // One-shot actions, mapped onto the world's input shape.
      const w = {
        up: mv.up, down: mv.down, left: mv.left, right: mv.right,
        exit: !!edges.exit,
        shoot: false, radioNext: !!edges.radio, wheelToggle: !!edges.wheel,
        ability: edges.slipstream ? 'slipstream' : edges.plates ? 'plates' : edges.eyes ? 'eyes' : null,
        weaponCycle: false,
      };
      if (edges.weapon1) st.weaponIdx = 0;
      if (edges.weapon2) st.weaponIdx = 1;
      if (edges.weapon3) st.weaponIdx = 2;
      if (edges.weapon4) st.weaponIdx = 3;
      if (edges.shoot && shootCooldown <= 0 && st.player.onFoot) { w.shoot = true; shootCooldown = 0.28; }
      while (accumulator >= STEP) {
        world.step(STEP, w);
        w.exit = false; w.shoot = false; w.radioNext = false; w.wheelToggle = false; w.ability = null;
        accumulator -= STEP;
      }
      renderer.draw('play', st.time);
    } else if (screen === 'title') {
      // Attract mode: the city orbits slowly behind the bright title card.
      world.state.time += Math.min(0.05, accumulator);
      accumulator = 0;
      renderer.draw('title', world.state.time);
    } else {
      accumulator = 0;
      renderer.draw('paused', world.state.time);
    }
  }

  announce('Solmar Bay Sunset Run. Press Enter to start.');
  requestAnimationFrame(frame);
}

// Debug handle for the local playtest harness.
window.__game = { world, get screen() { return document.getElementById('pause-screen').style.display !== 'none' ? 'paused' : document.getElementById('title-screen').style.display !== 'none' ? 'title' : 'play'; } };
