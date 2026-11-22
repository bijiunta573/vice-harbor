// Vice Harbor — entry program for the make.fun gta6-01 bounty.
// The playable game lives in game/ as plain static files (open game/index.html in a
// browser, no build step, no network). This program is the hand-in: it mirrors game/
// and screenshots/ into the output directory and writes dossier.json there with the
// vendored make.fun library, so the scorer can rebuild the exact same bytes.
// Run it locally with:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// (MAKEFUN_OUTPUT_DIR stands in for /output outside the grader.)
// Determinism: nothing here reads the clock or rolls dice — repeated runs on the
// same tree write identical bytes.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoDir, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoDir, 'screenshots'))) {
  cpSync(join(repoDir, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The gate's own limits: the text cap shapes the dossier bytes; the rest refuse an
// entry the scorer would refuse anyway (screenshot count/size, game tree size).
const dossierBytes = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossierBytes);
console.log('Vice Harbor handed in: game/ + screenshots/ + dossier.json ->', outputDir);
