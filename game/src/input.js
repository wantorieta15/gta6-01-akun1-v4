// Keyboard input: held movement keys + edge-triggered one-shot actions, consumed once per frame.
export function createInput() {
  const held = new Set();
  const edges = {};
  const MOVE = new Set(['KeyW', 'ArrowUp', 'KeyS', 'ArrowDown', 'KeyA', 'ArrowLeft', 'KeyD', 'ArrowRight']);
  const EDGE_MAP = {
    Enter: 'confirm', KeyE: 'exit', Space: 'shoot', KeyR: 'radio', KeyQ: 'wheel',
    Escape: 'pause', KeyP: 'pause', KeyF: 'slipstream', KeyG: 'plates', KeyH: 'eyes',
    Digit1: 'weapon1', Digit2: 'weapon2', Digit3: 'weapon3', Digit4: 'weapon4',
  };

  window.addEventListener('keydown', (event) => {
    if (MOVE.has(event.code)) {
      held.add(event.code);
      event.preventDefault();
    } else if (EDGE_MAP[event.code]) {
      if (!event.repeat) edges[EDGE_MAP[event.code]] = true;
      if (event.code === 'Space') event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => { held.delete(event.code); });
  window.addEventListener('blur', () => { held.clear(); });

  function has(...codes) { return codes.some((c) => held.has(c)); }

  return {
    // Held movement, read every frame.
    move() {
      return {
        up: has('KeyW', 'ArrowUp'), down: has('KeyS', 'ArrowDown'),
        left: has('KeyA', 'ArrowLeft'), right: has('KeyD', 'ArrowRight'),
      };
    },
    // One-shot presses since the last call; each flag is reported once.
    takeEdges() {
      const out = { ...edges };
      for (const k of Object.keys(edges)) delete edges[k];
      return out;
    },
    // Click / tap also confirms (title screen).
    bindConfirm(fn) {
      window.addEventListener('pointerdown', () => { edges.confirm = true; fn(); });
    },
  };
}
