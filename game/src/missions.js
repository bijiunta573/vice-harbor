// Story missions and side income for Vice Harbor. A five-mission chain given by
// original characters around the harbor, plus a repeatable chop-shop car delivery
// and hidden packages scattered across the city.
import { dist } from './random.js';

// Mission stages are simple state machines evaluated each frame in main.js.
// kind: 'goto' reach a point | 'drive' reach a point while in any car |
//       'timed' reach a point before the clock | 'deliverCar' bring a specific car |
//       'survive' keep wanted heat while a timer runs down.
export const STORY = [
  {
    id: 'meet-marisol', giver: 'Marisol Vega', title: 'Harbor Introductions',
    intro: ['Marisol: You are the new wheel in Vice Harbor? Good. I run favors off Pier Three.',
      'Marisol: Walk the pier with me — meet me at the dock office so we talk business.'],
    stages: [{ kind: 'goto', label: 'Meet Marisol at the dock office', x: 500, y: 1980, r: 60 }],
    reward: 150, done: 'Marisol: Sharp. There may be real work for you yet.',
  },
  {
    id: 'getaway', giver: 'Marisol Vega', title: 'Clean Getaway',
    intro: ['Marisol: My cousin Rico lifted ledgers from Coral Market. The heat is coming.',
      'Marisol: Grab any car, pick him up at the market, and lose yourself at Palm Heights.'],
    stages: [
      { kind: 'drive', label: 'Pick up Rico at Coral Market (in a car)', x: 2760, y: 690, r: 80 },
      { kind: 'goto', label: 'Drop Rico at the Palm Heights safehouse', x: 560, y: 560, r: 80 },
    ],
    reward: 400, done: 'Rico: You drive like the tide — nobody catches that. Thanks, friend.',
  },
  {
    id: 'package', giver: 'Old Tomas', title: 'Against the Clock',
    intro: ['Tomas: A parcel on Marina Row spoils in the sun. Ninety seconds, no excuses.',
      'Tomas: Get it to the Azure Beach kiosk before the timer dies.'],
    stages: [
      { kind: 'goto', label: 'Collect the parcel on Marina Row', x: 1560, y: 2010, r: 60 },
      { kind: 'timed', label: 'Deliver the parcel to Azure Beach — hurry!', x: 2960, y: 1980, r: 70, time: 95 },
    ],
    reward: 550, done: 'Tomas: Cold as the morning catch. The harbor provides, eh?',
  },
  {
    id: 'debt', giver: 'Priya Nair', title: 'Collecting Debts',
    intro: ['Priya: A gambler named Doyle owes the Coral Market three weeks of rent.',
      'Priya: Visit his hideout downtown. Scare him — a little noise helps — then report back.'],
    stages: [
      { kind: 'goto', label: "Visit Doyle's hideout in Downtown Vice", x: 1740, y: 880, r: 70, needsNoise: true },
      { kind: 'goto', label: 'Report back to Priya at Coral Market', x: 2760, y: 640, r: 70 },
    ],
    reward: 700, done: 'Priya: Doyle paid in full and apologized twice. Impressive work.',
  },
  {
    id: 'finale', giver: 'Marisol Vega', title: 'The Harbor Finale',
    intro: ['Marisol: One last run. A buyer waits on the east bridge with serious money.',
      'Marisol: Take the marked coupe at the docks, cross the harbor, and hold your nerve — every cruiser in the city will want a word.'],
    stages: [
      { kind: 'goto', label: 'Take the marked coupe at Solana Docks', x: 480, y: 1900, r: 70 },
      { kind: 'drive', label: 'Reach the buyer on the east bridge', x: 3230, y: 2240, r: 90 },
      { kind: 'survive', label: 'Lose the heat — stay out of sight!', time: 1, r: 0 },
    ],
    reward: 1500, done: 'Marisol: Vice Harbor is yours now, captain. The docks salute you.',
  },
];

export function makeMissionState() {
  return {
    index: 0, // next story mission
    active: null, // { mission, stage, timer, noiseDone }
    dialogue: null, dialogueTimer: 0,
    banner: null, bannerTimer: 0,
    chopDeliveries: 0, packagesFound: 0,
    storyComplete: false,
  };
}

export function startNextMission(state, world) {
  if (state.index >= STORY.length) { state.storyComplete = true; return null; }
  const mission = STORY[state.index];
  state.active = { mission, stage: 0, timer: mission.stages[0].time ?? 0, noiseDone: false };
  state.dialogue = mission.intro; state.dialogueTimer = 7;
  return mission;
}

export function currentStage(state) {
  if (!state.active) return null;
  return state.active.mission.stages[state.active.stage];
}

export function advanceStage(state, cashEvents) {
  const a = state.active;
  a.stage += 1; a.noiseDone = false;
  if (a.stage >= a.mission.stages.length) {
    cashEvents.push({ amount: a.mission.reward, label: a.mission.title + ' complete' });
    state.banner = a.mission.title + ' — COMPLETE  +$' + a.mission.reward;
    state.bannerTimer = 3.4;
    state.dialogue = [a.mission.done]; state.dialogueTimer = 5;
    state.active = null; state.index += 1;
    if (state.index >= STORY.length) state.storyComplete = true;
    return { finished: true, reward: a.mission.reward };
  }
  const s = a.mission.stages[a.stage];
  a.timer = s.time ?? 0;
  return { finished: false };
}

export function objectiveText(state, world) {
  const s = currentStage(state);
  if (s) {
    let t = s.label;
    if (s.kind === 'timed' && state.active) t += '  (' + Math.max(0, Math.ceil(state.active.timer)) + 's)';
    return t;
  }
  if (state.storyComplete) return 'Story complete — free roam: chop-shop deliveries and packages pay cash.';
  const next = STORY[state.index];
  return next ? 'Press Enter at the gold marker to start: ' + next.title + ' (' + next.giver + ')' : 'Free roam Vice Harbor.';
}

export function missionMarker(state) {
  const s = currentStage(state);
  if (s && s.kind !== 'survive') return { x: s.x, y: s.y, gold: true };
  if (!state.active && !state.storyComplete) {
    const first = STORY[state.index].stages[0];
    return { x: first.x, y: first.y, gold: true };
  }
  return null;
}

export function checkStage(state, player, dt, events) {
  const s = currentStage(state);
  if (!s) return null;
  if (s.kind === 'timed') {
    state.active.timer -= dt;
    if (state.active.timer <= 0) { events.push({ kind: 'missionFail' }); state.active = null; return 'failed'; }
  }
  if (s.kind === 'survive') {
    return events.includes('heatCleared') ? 'advance' : null;
  }
  const inCar = !!player.inCar;
  if (s.kind === 'drive' && !inCar) return null;
  if (dist(player.x, player.y, s.x, s.y) < s.r) {
    if (s.needsNoise && !state.active.noiseDone) return 'needsNoise';
    return 'advance';
  }
  return null;
}
