// Solmar Bay — Sunset Run (GTA6-01 v4, Akun 1). All tuning, story and HUD copy in one place.
// The playfield is a fixed 1280x720 logical area; the 3D renderer scales to the window.
// World units are metres. City grid: blocks of 52 with 14-wide roads. Beach + ocean east (x > 150).
export const FIELD = { width: 1280, height: 720 };
export const STEP = 1 / 60;

export const CITY = {
  minX: -182, maxX: 182, minZ: -182, maxZ: 182,
  block: 52, road: 14, beachX: 150, oceanX: 208, boardwalkX: 146,
};

export const CAR = { accel: 26, brake: 42, maxSpeed: 58, reverseMax: 14, steer: 1.9, grip: 6.5 };
export const ONFOOT = { speed: 9.5 };

export const PALETTE = {
  skyTop: '#2b1e5e', skyMid: '#c94b7c', skyLow: '#ff9a52', sun: '#ffd76e',
  ocean: '#1d6f8e', oceanDeep: '#0f4a6b', sand: '#e8c88f', boardwalk: '#8a6a4a',
  asphalt: '#33333d', asphaltLine: '#c9b458', sidewalk: '#55555f',
  buildingA: '#4a3a5e', buildingB: '#5e3a4a', buildingC: '#3a4a5e', buildingD: '#6b4a2f',
  windowLit: '#ffd76e', windowDark: '#2c2438',
  grass: '#3f6b3a', palmTrunk: '#6b4a2f', palmLeaf: '#2f7a3a',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export const MISSIONS = [
  { id: 1, name: 'WELCOME TO SOLMAR', stage: '1/3', objective: 'Meet Rico at the Marina', detail: 'Drive to the yellow marker at the Marina.', rating: 'GOLD' },
  { id: 2, name: 'SUNSET GETAWAY', stage: '2/3', objective: 'Lose the SBPD tail — stay fast', detail: 'Outrun the pursuit units for 45 seconds.', rating: 'SILVER' },
  { id: 3, name: 'NIGHT MARKET HEAT', stage: '1/2', objective: 'Clear the market — 4 targets left', detail: 'On foot. Watch the stalls, mind the crowd.', rating: 'GOLD' },
  { id: 4, name: 'THE GECKO RUN', stage: '2/4', objective: 'Collect Golden Geckos — 7/12', detail: 'Twelve geckos hide across Solmar Bay.', rating: 'BRONZE' },
  { id: 5, name: 'HARBOR LIGHTS', stage: '1/2', objective: 'Steal the boat plans at the harbor', detail: 'Sneak past the dock guards, grab the plans.', rating: 'SILVER' },
  { id: 6, name: 'BEACHFRONT DEAL', stage: '3/3', objective: 'Meet the buyer on North Beach', detail: 'The buyer waits by the kiosk. No cops, no noise.', rating: 'GOLD' },
  { id: 7, name: 'STREET KINGS', stage: '2/3', objective: 'Win the Boardwalk race — LAP 2/3', detail: 'Three laps. No brakes, no mercy.', rating: 'SILVER' },
  { id: 8, name: 'SUNSET RUN', stage: '1/4', objective: 'The final score — reach the penthouse', detail: 'One last job. The whole city is watching.', rating: '—' },
];

export const CREW = [
  { name: 'RICO VANCE', role: 'DRIVER', ability: 'SLIPSTREAM', key: 'F', desc: 'Nitro burst +40% speed', active: true, color: '#ff8c42' },
  { name: 'LENA “GHOST” MARLOW', role: 'HACKER', ability: 'EYES OUT', key: 'H', desc: 'Reveals every unit on the map', active: true, color: '#b388ff' },
  { name: 'DRE CARTER', role: 'MUSCLE', ability: 'SWAP PLATES', key: 'G', desc: 'Drop 2 wanted stars instantly', active: false, color: '#69d67a' },
];

export const DISTRICTS = [
  { name: 'MARINA', standing: 72, label: 'RESPECTED', x: -40, z: 120 },
  { name: 'OLD TOWN', standing: 64, label: 'LIKED', x: -110, z: -40 },
  { name: 'BOARDWALK', standing: 78, label: 'RESPECTED', x: 120, z: 60 },
  { name: 'HARBOR', standing: 45, label: 'NEUTRAL', x: -90, z: 140 },
  { name: 'NORTH BEACH', standing: 88, label: 'FEARED', x: 150, z: -120 },
  { name: 'DOWNTOWN', standing: 58, label: 'LIKED', x: 10, z: -20 },
  { name: 'VICE ROW', standing: 22, label: 'HATED', x: -60, z: -130 },
  { name: 'THE PALMS', standing: 51, label: 'NEUTRAL', x: 60, z: 130 },
];

export const RADIO = [
  { station: 'SOLMAR FM 98.6', song: '“Neon Coast” — Midnight Palms' },
  { station: 'BAY 101.3', song: '“Golden Hour” — The Sunsets' },
  { station: 'PALM RADIO 88.4', song: '“Vice Lights” — DJ Marisol' },
  { station: 'SUNSET 104.2', song: '“Boardwalk Nights” — Coastline' },
];

export const WEAPONS = [
  { name: 'FISTS', ammo: '∞', total: '∞', locked: false },
  { name: 'PISTOL 9MM', ammo: '48', total: '96', locked: false },
  { name: 'SMG', ammo: '120', total: '240', locked: false },
  { name: 'SHOTGUN', ammo: '16', total: '32', locked: true, lockNote: 'UNLOCKS AT RANK 15' },
];

export const DIALOGS = {
  rico: { name: 'RICO VANCE', color: '#ff8c42', initials: 'RV', line: '“Sun’s going down, kid. Solmar Bay belongs to whoever takes it — and tonight, that’s us.”' },
  lena: { name: 'LENA “GHOST” MARLOW', color: '#b388ff', initials: 'LM', line: '“Eyes out — AIR-1 is painting the whole block. Stay in the shadows and keep the revs low.”' },
  dre: { name: 'DRE CARTER', color: '#69d67a', initials: 'DC', line: '“Plates swapped. They’ll be chasing a ghost for the next ten minutes. Move.”' },
};

export const SBPD_UNITS = [
  { call: 'UNIT 7 — “VIPER”', role: 'PURSUIT', dist: '42m' },
  { call: 'UNIT 12 — “HAMMER”', role: 'RAMMING', dist: '68m' },
  { call: 'UNIT 3 — “HOUND”', role: 'SEARCHING', dist: '121m' },
  { call: 'UNIT 21 — “GATE”', role: 'ROADBLOCK', dist: '180m' },
];

export const SAVE_SLOTS = [
  { n: 1, label: 'SLOT 1 — VANCE', detail: '68% complete · $18,700 · 12h 44m', state: 'CONTINUE' },
  { n: 2, label: 'SLOT 2 — EMPTY', detail: 'No save yet — start a new story', state: 'NEW GAME' },
  { n: 3, label: 'SLOT 3 — EMPTY', detail: 'No save yet — start a new story', state: 'NEW GAME' },
];

export const CAREER = [
  { k: 'MISSIONS PASSED', v: '5 / 8' },
  { k: 'REP POINTS', v: '4,280 RP' },
  { k: 'CASH EARNED', v: '$86,400' },
  { k: 'GOLDEN GECKOS', v: '7 / 12' },
  { k: 'TOP SPEED', v: '142 MPH' },
  { k: 'TIME PLAYED', v: '12h 44m' },
  { k: 'MAX WANTED', v: '★★★★★' },
  { k: 'RACES WON', v: '3 / 5' },
  { k: 'BEST DRIFT', v: '1,240 PTS' },
  { k: 'DISTANCE DRIVEN', v: '318 MI' },
];

export const PLAYER = {
  name: 'JAY VANCE', rank: 12, rankName: 'HUSTLER', rp: 4280, rpNext: 5000,
  cash: 18700, hp: 82, armour: 64, rep: 91, carName: 'VESPUCCI GT — “SUNSET”', carDamage: 18,
};
