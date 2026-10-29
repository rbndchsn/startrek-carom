// Table layout, from game_information/table_layout.md.
// Units are inches. Origin near the table center. +x is right, +y is toward the back rail.

export const BALL_RADIUS = 1.0;

// Inner edge of the rail (the playfield outline).
export const OUTLINE = [
  [-54, -8], [-54, 10], [-46, 20], [-12, 22], [-4, 30], [40, 30],
  [54, 18], [54, -18], [42, -30], [6, -30], [-2, -20], [-44, -20],
];

export const HOLE = { x: 2, y: -4, r: 1.6 };

export const BUMPER_RADIUS = 1.5;
export const BUMPER_HEIGHT = 2.5;

export const BUMPERS = [
  { id: 'B1', x: -44, y: 2 },
  { id: 'B2', x: -26, y: 6 },
  { id: 'B3', x: -18, y: 0 },
  { id: 'B4', x: -10, y: 4 },
  { id: 'GATE', x: -3, y: -9, gate: true },
  { id: 'B6', x: 7, y: 17 },
  { id: 'B7', x: 17, y: 5 },
  { id: 'B8', x: 13, y: -1 },
  { id: 'B9', x: 32, y: 16 },
  { id: 'B10', x: 30, y: -16 },
];

export const GATE_INDEX = BUMPERS.findIndex((b) => b.gate);

// Raised curved walls. Angles in degrees, measured from +x toward +y.
export const WALLS = [
  { id: 'W1', cx: 6, cy: 8, r: 16, a0: 55, a1: 125 },
  { id: 'W2', cx: -36, cy: -4, r: 12, a0: 235, a1: 305 },
  { id: 'W3', cx: 16, cy: -6, r: 16, a0: 240, a1: 300 },
];
export const WALL_THICKNESS = 1.0;
export const WALL_HEIGHT = 1.5;

// Flat tape graphics. No effect on play.
export const TAPE_LINES = [
  [[-44, 13], [-34, 13], [-30, 17]],
  [[-32, 8], [-14, -12]],
  [[22, 10], [46, 4]],
];
export const TAPE_WIDTH = 0.5;
export const HEXAGON = { cx: 42, cy: -6, r: 7 };

export const START_SPOTS = {
  human: { x: -40, y: -8 },
  computer: { x: 44, y: -8 },
};

export const RAIL = { height: 2, width: 2 };
export const FRAME_WIDTH = 4;
export const TABLE_HEIGHT = 32;

// Leg centers, under the left section, the back-center and the right section.
export const LEGS = [
  { x: -36, y: 0 },
  { x: -6, y: 16 },
  { x: 34, y: -4 },
];

// Betting tray banks: each sits outside one outline edge (index of its first point).
export const TRAY_BANKS = [
  { edge: 2, count: 4 }, // back-left
  { edge: 6, count: 4 }, // right end
  { edge: 8, count: 4 }, // front-right
];

export const PHYSICS = {
  dt: 1 / 400,               // fixed physics step, seconds
  friction: 30,              // rolling deceleration, inches per second squared
  stopSpeed: 0.6,            // below this a ball stops
  maxShotSpeed: 150,         // full-power shot, inches per second
  minShotSpeed: 4,
  maxBallSpeed: 200,
  restitutionBall: 0.95,
  restitutionRail: 0.8,
  restitutionWall: 0.75,
  restitutionBumper: 0.9,
  bumperKick: 8,             // extra push from a bumper, like a pinball bumper
  holeCaptureRadius: 1.15,   // ball center inside this drops
  holeCaptureMaxSpeed: 110,  // faster balls skip over the hole
  holeLipPull: 20,           // pull on a rolling ball toward the hole center, inside the hole radius
                             // (a ball that stops on the rim stays there)
  maxSimTime: 14,            // safety stop for one shot, seconds
};
