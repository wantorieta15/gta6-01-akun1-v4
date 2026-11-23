# Solmar Bay — Sunset Run (GTA6-01 v4, Akun 1 @walta-exchange)

[![make.fun competition](https://img.shields.io/badge/make.fun-gta6--01-orange)](https://make.fun/c/gta6-01)
[![rank](https://img.shields.io/badge/rank-aiming%20for%20top%2050-blue)](https://make.fun/c/gta6-01)
[![reward](https://img.shields.io/badge/reward-%241%2C666-green)](https://make.fun/c/gta6-01)

3D third-person open-world crime game in the fictional beach city Solmar Bay, at sunset.
Written from scratch for this entry (custom canvas 3D engine, no external libraries).

## What is in the game

- **Open world**: city grid with lit buildings, roads, traffic, palms, a boardwalk, a beach
  (umbrellas, sunbathers, boats, kiosk) and the ocean — all at sunset.
- **8 story missions** with header (name + stage + objective + NEXT), dialog with portraits
  and character names, and a mission-passed banner with rating.
- **5-star police**: SBPD RESPONSE panel with named units + role + distance, roadblocks,
  and a big AIR-1 helicopter with a thick searchlight cone + “AIR UNIT DEPLOYED” banner.
- **Crew of 3** (Rico / Lena / Dre) with abilities: SLIPSTREAM (F), EYES OUT (H), SWAP PLATES (G).
- **Weapon wheel** (Q): FISTS / PISTOL 9MM / SMG / SHOTGUN (locked until rank 15), with ammo.
- **RANK + RP bar**, cash, HP / armour / REP, wanted stars, speedometer + car name + damage,
  radio (4 stations), minimap with district name + **district standing bar in the HUD**.
- **On-foot mode** (E to exit the car): walk + shoot in the night market.
- **Golden Gecko collectibles** (12), drift points, street race laps.
- **Pause / map screen** (ESC): full city map with district standings, career stats,
  mission checklist with ratings, and 3 save slots — all on one screen.
- **Title screen** (bright sunset): logo + 3 save slots.

## Controls

W A S D drive & walk · E enter / exit car · SPACE shoot · Q weapon wheel · 1–4 weapons ·
R radio · F / G / H crew abilities · ESC pause & map · ENTER start

## Dossier screenshots (1280×720, from the real game via `?shot=`)

1. `1-chase.jpg` — 5-star chase, AIR-1 searchlight, SBPD panel, drift popup
2. `2-street.jpg` — on-foot night-market shootout, weapon wheel open
3. `3-mission.jpg` — mission 6 beachfront deal: umbrellas, people, boats, kiosk, MISSION PASSED
4. `4-pause.jpg` — pause / map screen: career stats + 3 save slots + district standing

## Run it

```
node serve.ts            # http://localhost:8080
node tools/shoot.mjs     # captures the 4 dossier screenshots + interactive playtest
```

## Fixes vs v3 (score 990.746, rank #601)

(a) Pause/map screen now shows career stats + 3 save slots on the same screen as the map.
(b) AIR-1 helicopter is much bigger and closer, with a thick visible searchlight cone.
(c) Beach mission scene is filled with umbrellas, people, boats and a kiosk.
(d) HUD layout reworked: money lives in the top-right block, the AIR UNIT banner sits in its
    own centred row below the mission header — no text overlaps.
(e) District standing bar is shown in the HUD under the minimap, not only on the map screen.
