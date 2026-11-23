// Dossier screenshot scenes behind ?shot=chase|street|mission|pause (with &seed=N).
// Each scene is a real staged game state — same seed always gives the same frame —
// rendered a few times so every panel settles, then window.__shotReady is set.
export const SHOTS = ['chase', 'street', 'mission', 'pause'];

export function stageShot(name, world) {
  const safe = SHOTS.includes(name) ? name : 'chase';
  world.stageShot(safe);
  // Fixed clock so rotor angle, pulses and waves are identical every run.
  world.state.time = 2.5;
  world.state.heli.rotor = 1.2;
  return { screen: safe === 'pause' ? 'paused' : 'play', name: safe };
}
