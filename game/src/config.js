// Vice Harbor — tuning constants and palette. Every number the game balances on lives here.
export const WORLD_W = 3600;
export const WORLD_H = 2600;
export const TILE_ROAD = 92; // road width in px
export const BLOCK = 460; // distance between road centerlines
export const VIEW_W = 1280;
export const VIEW_H = 800;

export const PLAYER = {
  walkSpeed: 168,
  sprintSpeed: 268,
  radius: 13,
  maxHealth: 100,
  pistolDamage: 34,
  fireCooldown: 0.22,
  magazine: 12,
  reloadTime: 1.1,
};

export const WANTED = {
  maxStars: 5,
  decayDelay: 7, // seconds out of sight before stars start cooling
  decayRate: 14, // heat points per second while hidden
  heatForStar: 100,
};

export const PALETTE = {
  skyTop: '#ffd9a0',
  skyBottom: '#7fd4e8',
  water: '#1d7f9e',
  waterDeep: '#14607c',
  sand: '#f2d492',
  grass: '#5fae5f',
  grassDark: '#4c9450',
  sidewalk: '#c9c2b4',
  road: '#3c4048',
  roadLine: '#f5d76e',
  curb: '#9d968a',
};

export const DISTRICTS = [
  { name: 'Solana Docks', x: 300, y: 2050 },
  { name: 'Marina Row', x: 1500, y: 2150 },
  { name: 'Palm Heights', x: 500, y: 500 },
  { name: 'Downtown Vice', x: 1650, y: 800 },
  { name: 'Coral Market', x: 2700, y: 600 },
  { name: 'Azure Beach', x: 2900, y: 1900 },
  { name: 'North Palms', x: 2900, y: 300 },
];

export const CAR_TYPES = [
  { name: 'Coupe', w: 46, h: 22, top: 330, accel: 260, colors: ['#e74c3c', '#f39c12', '#ecf0f1', '#9b59b6'] },
  { name: 'Sedan', w: 50, h: 23, top: 290, accel: 220, colors: ['#3498db', '#2ecc71', '#95a5a6', '#34495e'] },
  { name: 'Truck', w: 58, h: 26, top: 240, accel: 170, colors: ['#e67e22', '#7f8c8d', '#16a085', '#c0392b'] },
  { name: 'Cabrio', w: 44, h: 21, top: 350, accel: 290, colors: ['#ff5da2', '#ffd23f', '#3ee6c4', '#ff7f50'] },
];

export const SAVE_KEY = 'vice-harbor-save-v1';
