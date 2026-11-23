// Dossier screenshot + interactive playtest harness (Node 24 stdlib only).
// Launches the bundled Chromium headless, drives it over CDP, captures 1280x720 JPEGs.
// Usage: node tools/shoot.mjs [--shots-only | --playtest-only]
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..');
const CHROME = process.env.CHROME || `${process.env.HOME}/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`;
const SERVE_PORT = 8901;
const CDP_PORT = 9333;
const shotsOnly = process.argv.includes('--shots-only');
const playtestOnly = process.argv.includes('--playtest-only');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
  const res = await fetch(url);
  return res.json();
}

function connectWs(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let id = 0;
    const pending = new Map();
    const listeners = [];
    ws.onopen = () => resolve({
      send(method, params = {}) {
        return new Promise((res2, rej2) => {
          const mid = ++id;
          pending.set(mid, { res2, rej2 });
          ws.send(JSON.stringify({ id: mid, method, params }));
        });
      },
      onEvent(fn) { listeners.push(fn); },
      close() { ws.close(); },
    });
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { res2, rej2 } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) rej2(new Error(msg.error.message));
        else res2(msg.result);
      } else if (msg.method) {
        for (const fn of listeners) fn(msg);
      }
    };
    ws.onerror = (e) => reject(new Error('ws error ' + e.message));
  });
}

async function waitFor(fn, timeoutMs, label) {
  const start = Date.now();
  for (;;) {
    if (await fn()) return true;
    if (Date.now() - start > timeoutMs) throw new Error('timeout waiting for ' + label);
    await sleep(150);
  }
}

async function main() {
  // Serve game/.
  const server = spawn(process.execPath, ['serve.ts', '--port', String(SERVE_PORT)], { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'] });
  let serverOut = '';
  server.stdout.on('data', (d) => { serverOut += d; });
  server.stderr.on('data', (d) => { serverOut += d; });
  await waitFor(async () => {
    try { const r = await fetch(`http://127.0.0.1:${SERVE_PORT}/`); return r.ok; } catch { return false; }
  }, 10000, 'server');
  console.log('server up:', serverOut.trim());

  const chrome = spawn(CHROME, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
    `--remote-debugging-port=${CDP_PORT}`, '--window-size=1280,720',
    '--user-data-dir=/tmp/gta6-v4-profile', 'about:blank',
  ], { stdio: 'ignore' });

  let targets;
  await waitFor(async () => {
    try { targets = await getJson(`http://127.0.0.1:${CDP_PORT}/json/list`); return targets.some((t) => t.type === 'page'); } catch { return false; }
  }, 15000, 'chrome');
  const page = targets.find((t) => t.type === 'page');
  const cdp = await connectWs(page.webSocketDebuggerUrl);
  const errors = [];
  cdp.onEvent((msg) => {
    if (msg.method === 'Runtime.exceptionThrown') errors.push('EXCEPTION: ' + JSON.stringify(msg.params.exceptionDetails).slice(0, 400));
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push('CONSOLE ERROR: ' + msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 400));
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') errors.push('LOG ERROR: ' + msg.params.entry.text.slice(0, 400));
  });
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });

  async function evalJs(expr) {
    const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true });
    return r.result ? r.result.value : undefined;
  }
  async function shotToFile(url, outPath) {
    await cdp.send('Page.navigate', { url });
    await waitFor(() => evalJs('window.__shotReady === true'), 20000, '__shotReady for ' + url);
    await sleep(150);
    let quality = 82;
    for (;;) {
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality });
      const buf = Buffer.from(data, 'base64');
      writeFileSync(outPath, buf);
      const size = statSync(outPath).size;
      console.log(`${outPath}: ${size} bytes (quality ${quality})`);
      if (size <= 262144 || quality <= 55) {
        if (size > 262144) console.log('  WARNING: over 256 KiB even at quality ' + quality);
        return size;
      }
      quality -= 10;
    }
  }
  async function key(code, keyName, vk) {
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: keyName, windowsVirtualKeyCode: vk });
    await sleep(60);
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: keyName, windowsVirtualKeyCode: vk });
  }
  async function keyDown(code, keyName, vk) {
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: keyName, windowsVirtualKeyCode: vk });
  }
  async function keyUp(code, keyName, vk) {
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: keyName, windowsVirtualKeyCode: vk });
  }
  async function snap(outPath, quality = 82) {
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality });
    writeFileSync(outPath, Buffer.from(data, 'base64'));
    console.log(`${outPath}: ${statSync(outPath).size} bytes`);
  }

  try {
    if (!playtestOnly) {
      mkdirSync(join(repo, 'screenshots'), { recursive: true });
      const shots = [
        ['1-chase.jpg', 'chase'], ['2-street.jpg', 'street'],
        ['3-mission.jpg', 'mission'], ['4-pause.jpg', 'pause'],
      ];
      for (const [name, shot] of shots) {
        await shotToFile(`http://127.0.0.1:${SERVE_PORT}/?shot=${shot}&seed=1`, join(repo, 'screenshots', name));
      }
      console.log('CONSOLE/JS ERRORS during shots:', errors.length ? errors : 'none');
    }

    if (!shotsOnly) {
      const dir = '/tmp/gta6-v4-playtest';
      mkdirSync(dir, { recursive: true });
      errors.length = 0;
      await cdp.send('Page.navigate', { url: `http://127.0.0.1:${SERVE_PORT}/` });
      await sleep(1200);
      console.log('screen at load:', await evalJs('window.__game && window.__game.screen'));
      await snap(join(dir, '1-title.jpg'));
      await key('Enter', 'Enter', 13);
      await sleep(900);
      console.log('screen after Enter:', await evalJs('window.__game && window.__game.screen'));
      await snap(join(dir, '2-hud.jpg'));
      await keyDown('KeyW', 'w', 87);
      await sleep(2000);
      await keyUp('KeyW', 'w', 87);
      await sleep(300);
      console.log('car speed after W:', await evalJs('window.__game && Math.round(window.__game.world.state.car.speed*100)/100'));
      console.log('car pos:', await evalJs('window.__game && JSON.stringify({x: Math.round(window.__game.world.state.car.x), z: Math.round(window.__game.world.state.car.z)})'));
      await snap(join(dir, '3-driving.jpg'));
      await key('KeyE', 'e', 69);
      await sleep(700);
      console.log('onFoot after E:', await evalJs('window.__game && window.__game.world.state.player.onFoot'));
      await snap(join(dir, '4-onfoot.jpg'));
      await key('Escape', 'Escape', 27);
      await sleep(700);
      console.log('screen after Escape:', await evalJs('window.__game && window.__game.screen'));
      await snap(join(dir, '5-pause.jpg'));
      console.log('CONSOLE/JS ERRORS during playtest:', errors.length ? errors : 'none');
    }
  } finally {
    cdp.close();
    chrome.kill();
    server.kill();
  }
}

main().catch((e) => { console.error('HARNESS FAILED:', e.message); process.exit(1); });
