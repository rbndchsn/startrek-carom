// Builds the balls for a new round and returns balls to their starting places.
import { HUMAN, COMPUTER } from '../data/config.js';
import { START_SPOTS } from '../data/tableLayout.js';
import { PhysicsWorld } from '../physics/physics.js';
import { randomObstaclePositions, nearestFreeSpot } from '../physics/placement.js';
import { terikId } from './rules.js';

export const OBSTACLE_COUNT = 13;

// Returns { world, startPositions } where startPositions maps ball id to {x, y}.
export function createRoundWorld(rng = Math.random) {
  const world = new PhysicsWorld();
  const startPositions = {};
  for (const p of [HUMAN, COMPUTER]) {
    const s = START_SPOTS[p];
    world.addBall({ id: terikId(p), kind: 'terik', owner: p, x: s.x, y: s.y });
    startPositions[terikId(p)] = { x: s.x, y: s.y };
  }
  const spots = randomObstaclePositions(OBSTACLE_COUNT, rng);
  spots.forEach((s, i) => {
    const id = `obstacle-${i}`;
    world.addBall({ id, kind: 'obstacle', x: s.x, y: s.y });
    startPositions[id] = { x: s.x, y: s.y };
  });
  return { world, startPositions };
}

// Puts a dropped ball back at its start position, or the nearest free spot.
export function respotBall(world, startPositions, id) {
  const start = startPositions[id];
  const others = world.balls.filter((b) => b.active && b.id !== id);
  const spot = nearestFreeSpot(start.x, start.y, others);
  world.placeBall(id, spot.x, spot.y);
  return spot;
}
