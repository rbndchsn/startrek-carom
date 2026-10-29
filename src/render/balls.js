// Ball meshes: glowing teriks and frosted obstacle balls.
import * as THREE from 'three';
import { BALL_RADIUS as R, HOLE } from '../data/tableLayout.js';
import { COLORS } from '../data/config.js';
import { toWorld, makeHalo, easeOut } from './util.js';

const sphere = new THREE.SphereGeometry(R, 32, 24);

function makeTerik(owner) {
  const color = COLORS[owner];
  const g = new THREE.Group();
  const core = new THREE.Mesh(sphere, new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: 1.9, roughness: 0.25,
  }));
  core.castShadow = true;
  const shell = new THREE.Mesh(new THREE.SphereGeometry(R * 1.12, 24, 16), new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  const light = new THREE.PointLight(color, 7, 18, 1.3);
  const halo = makeHalo(9, color, 0.6);
  halo.position.y = -R + 0.05;
  g.add(core, shell, light, halo);
  return g;
}

function makeObstacle() {
  const g = new THREE.Group();
  const outer = new THREE.Mesh(sphere, new THREE.MeshPhysicalMaterial({
    color: COLORS.obstacle, roughness: 0.18, metalness: 0, transparent: true, opacity: 0.62,
    clearcoat: 1, clearcoatRoughness: 0.1, depthWrite: true,
  }));
  outer.castShadow = true;
  const core = new THREE.Mesh(new THREE.SphereGeometry(R * 0.55, 16, 12), new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.9, transparent: true, opacity: 0.35,
  }));
  g.add(outer, core);
  return g;
}

export function createBallViews(scene) {
  const views = new Map();
  const anims = new Map(); // id -> { kind: 'drop' | 'appear', t, from }

  function clear() {
    for (const v of views.values()) scene.remove(v);
    views.clear();
    anims.clear();
  }

  return {
    // Builds meshes for every ball in the physics world.
    build(world, { appear = true } = {}) {
      clear();
      world.balls.forEach((b, i) => {
        const v = b.kind === 'terik' ? makeTerik(b.owner) : makeObstacle();
        v.position.copy(toWorld(b.x, b.y, R));
        scene.add(v);
        views.set(b.id, v);
        if (appear) anims.set(b.id, { kind: 'appear', t: -i * 0.07 });
      });
    },

    clear,

    get(id) { return views.get(id); },

    startDrop(id, x, y) {
      anims.set(id, { kind: 'drop', t: 0, from: { x, y } });
    },

    // Shows a ball back on the table with a small drop-in.
    respot(id, x, y) {
      const v = views.get(id);
      v.visible = true;
      v.position.copy(toWorld(x, y, R));
      anims.set(id, { kind: 'appear', t: 0 });
    },

    sync(world, dt) {
      for (const b of world.balls) {
        const v = views.get(b.id);
        if (!v) continue;
        const a = anims.get(b.id);
        if (a && a.kind === 'drop') {
          a.t += dt;
          const k = Math.min(1, a.t / 0.45);
          const e = easeOut(k);
          const x = a.from.x + (HOLE.x - a.from.x) * e;
          const y = a.from.y + (HOLE.y - a.from.y) * e;
          v.position.copy(toWorld(x, y, R - 3.5 * k * k));
          if (k >= 1) { v.visible = false; anims.delete(b.id); }
          continue;
        }
        if (!b.active) continue;
        v.visible = true;
        let h = R;
        if (a && a.kind === 'appear') {
          a.t += dt;
          if (a.t < 0) { v.visible = false; continue; }
          const k = Math.min(1, a.t / 0.5);
          h = R + 9 * (1 - k) * (1 - k) + Math.abs(Math.sin(k * Math.PI * 2)) * (1 - k) * 1.5;
          if (k >= 1) anims.delete(b.id);
        }
        v.position.copy(toWorld(b.x, b.y, h));
      }
    },
  };
}
