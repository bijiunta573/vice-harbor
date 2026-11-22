# Vice Harbor

![make.fun bounty](https://make.fun/badge/gta6-01.svg)
![rank](https://make.fun/badge/gta6-01/bijiunta573/vice-harbor/rank.svg)
![reward](https://make.fun/badge/gta6-01/bijiunta573/vice-harbor/reward.svg)

An original open-world crime game for the [make.fun GTA 6 bounty](https://make.fun/bounty/gta6-01), built from scratch as plain static files — no build step, no libraries, no network requests. Every building, car, sound and line of dialogue is procedural or synthesized in code.

Vice Harbor is a sun-soaked coastal city of named districts — Solana Docks, Marina Row, Palm Heights, Downtown Vice, Coral Market, Azure Beach and North Palms — with a street grid, neon-signed blocks, palm boulevards, parks, a beach, a working harbor with piers and boats, and a bridge across the inlet.

You arrive with $250 and a pistol. Dock fixer **Marisol Vega** is hiring: work her five-job story chain (a pier introduction, a clean getaway for her cousin Rico, a timed parcel run for Old Tomas, a debt collection for Priya Nair, and a harbor finale under full police heat), steal and deliver cars to the chop shop, and hunt the 12 hidden packages. The VHPD answers every crime: a 0–5 star wanted system, cruisers that chase, ram and block, officers on foot, and a heat that only cools while you stay out of sight. Get caught standing still and you are **BUSTED**; run your health to zero and you are **WASTED**.

## Play

Serve the game folder with any static server, or use the bundled one:

```
node serve.ts        # then open http://localhost:8080
```

## Controls

- **WASD / arrow keys** — walk and drive
- **Shift** — sprint on foot
- **Mouse** — aim · **click or Space** — shoot (Space also brakes in a car)
- **E** — enter / exit a car (any car — parked, moving, or police)
- **R** — reload the pistol
- **Enter** — start missions at gold markers, sell cars at the chop shop, confirm
- **P / Esc** — pause · **S** (in pause) — save · **M** — mute

Progress (cash, mission chain, packages, position) saves to `localStorage`; the start screen offers **Continue** when a save exists.

## What's inside

- `game/` — the game itself: `index.html` plus ES modules under `game/src/`, one job each (city generation, vehicle physics and traffic AI, pedestrians, wanted/police AI, the mission chain, rendering and particles, HUD and live minimap, synthesized WebAudio sound, and the main loop/state machine).
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored make.fun library.
- `serve.ts` — a tiny static server for local play.
- `screenshots/` — four 1280×800 captures of the game itself: downtown on foot with a mission briefing, driving in traffic, a four-star police chase, and a second-seed mission scene.
- `shots.json` — the screenshot staging list. The game also supports `?shot=start|foot|drive|chase` and `?seed=<n>` URL parameters that deterministically stage rich scenes for photography.

## License

MIT — see `LICENSE`.
