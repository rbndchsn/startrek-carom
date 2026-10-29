// The 3D dom-jot table, built from src/data/tableLayout.js (Sternbach's design).
import * as THREE from 'three';
import {
  OUTLINE, HOLE, BUMPERS, BUMPER_RADIUS, WALLS, WALL_THICKNESS, WALL_HEIGHT, TAPE_LINES, TAPE_WIDTH,
  HEXAGON, START_SPOTS, RAIL, FRAME_WIDTH, TABLE_HEIGHT, LEGS, TRAY_BANKS,
} from '../data/tableLayout.js';
import { COLORS } from '../data/config.js';
import { offsetPolygon, arcPoints } from '../physics/geometry.js';
import { toWorld, makeHalo } from './util.js';

const DARK_LED = 0x3a2e2c;
const ownerColor = (o) => (o ? COLORS[o] : DARK_LED);

function shapeFrom(points, holes = []) {
  const s = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of holes) s.holes.push(h instanceof THREE.Path ? h : new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  return s;
}

// Extrude a 2D table-space shape upward from height y0 by depth.
function extrudeUp(shape, depth, y0, material, curveSegments = 24) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments });
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.y = y0;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function feltTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#c9b8cf';
  g.fillRect(0, 0, 256, 256);
  const img = g.getImageData(0, 0, 256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 18;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(0.08, 0.08);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function trayTexture(seed) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#2a1306';
  g.fillRect(0, 0, 128, 64);
  g.strokeStyle = '#ffb547';
  g.lineWidth = 3;
  g.strokeRect(6, 6, 116, 52);
  g.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const x = 16 + i * 26 + ((seed * 7 + i * 5) % 9);
    g.beginPath();
    g.moveTo(x, 46); g.lineTo(x + 8, 18); g.lineTo(x + 16, 46);
    if ((seed + i) % 2) { g.moveTo(x + 3, 34); g.lineTo(x + 13, 34); }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createTable(scene) {
  const group = new THREE.Group();
  scene.add(group);

  // Felt with the single scratch hole.
  const holePath = new THREE.Path();
  holePath.absarc(HOLE.x, HOLE.y, HOLE.r, 0, Math.PI * 2, true);
  const feltShape = shapeFrom(OUTLINE, [holePath]);
  const feltGeo = new THREE.ShapeGeometry(feltShape, 48);
  feltGeo.rotateX(-Math.PI / 2);
  const felt = new THREE.Mesh(feltGeo, new THREE.MeshStandardMaterial({ map: feltTexture(), roughness: 0.95 }));
  felt.receiveShadow = true;
  group.add(felt);

  // Hole cup.
  const cup = new THREE.Mesh(
    new THREE.CylinderGeometry(HOLE.r, HOLE.r, 5, 32, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x050304, roughness: 1, side: THREE.BackSide }),
  );
  cup.position.copy(toWorld(HOLE.x, HOLE.y, -2.5));
  const cupBottom = new THREE.Mesh(new THREE.CircleGeometry(HOLE.r, 32), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  cupBottom.rotation.x = -Math.PI / 2;
  cupBottom.position.copy(toWorld(HOLE.x, HOLE.y, -5));
  group.add(cup, cupBottom);

  // Under-felt slab so the table looks solid from low angles.
  const slab = extrudeUp(shapeFrom(offsetPolygon(OUTLINE, RAIL.width + FRAME_WIDTH - 0.5)), 3, -6.2,
    new THREE.MeshStandardMaterial({ color: 0x1e1316, roughness: 0.9 }));
  group.add(slab);

  // Rubber bumper rail, felt covered.
  const railMat = new THREE.MeshStandardMaterial({ color: 0x8e7d95, roughness: 0.9 });
  const railOuter = offsetPolygon(OUTLINE, RAIL.width);
  group.add(extrudeUp(shapeFrom(railOuter, [OUTLINE]), RAIL.height, 0, railMat));

  // Wooden frame around the rail, with a thin bright trim strip.
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x4b2c1e, roughness: 0.55, metalness: 0.1 });
  const frameOuter = offsetPolygon(OUTLINE, RAIL.width + FRAME_WIDTH);
  group.add(extrudeUp(shapeFrom(frameOuter, [railOuter]), 4.2, -3.2, frameMat));
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xb08a5a, roughness: 0.35, metalness: 0.6 });
  const trimInner = offsetPolygon(OUTLINE, RAIL.width + FRAME_WIDTH - 0.4);
  group.add(extrudeUp(shapeFrom(frameOuter, [trimInner]), 0.3, 1.0, trimMat));

  // Three V-shaped legs.
  const legMat = new THREE.MeshStandardMaterial({ color: 0x2b1c1b, roughness: 0.7 });
  const legH = TABLE_HEIGHT - 6.2;
  const legShape = shapeFrom([[-9, 0], [9, 0], [5, -legH], [-5, -legH]]);
  for (const l of LEGS) {
    const geo = new THREE.ExtrudeGeometry(legShape, { depth: 12, bevelEnabled: false });
    geo.translate(0, 0, -6);
    const leg = new THREE.Mesh(geo, legMat);
    leg.position.copy(toWorld(l.x, l.y, -6.2));
    leg.castShadow = true;
    group.add(leg);
  }

  // Backlit betting trays.
  const housingMat = new THREE.MeshStandardMaterial({ color: 0x2c1a14, roughness: 0.6 });
  let trayN = 0;
  const outerFar = offsetPolygon(OUTLINE, RAIL.width + FRAME_WIDTH + 4);
  for (const bank of TRAY_BANKS) {
    const i = bank.edge;
    const j = (i + 1) % OUTLINE.length;
    const a = outerFar[i];
    const b = outerFar[j];
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const housing = new THREE.Mesh(new THREE.BoxGeometry(len * 0.75, 3, 7), housingMat);
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    housing.position.copy(toWorld(mid[0], mid[1], -0.6));
    housing.rotation.y = ang;
    housing.castShadow = true;
    group.add(housing);
    for (let k = 0; k < bank.count; k++) {
      const f = 0.2 + (0.6 * k) / Math.max(1, bank.count - 1);
      const px = a[0] + (b[0] - a[0]) * f;
      const py = a[1] + (b[1] - a[1]) * f;
      const tray = new THREE.Mesh(
        new THREE.PlaneGeometry(Math.min(7, (len * 0.6) / bank.count), 4.6),
        new THREE.MeshStandardMaterial({ map: trayTexture(trayN++), emissive: 0xffffff, emissiveMap: null, emissiveIntensity: 0 }),
      );
      tray.material.emissiveMap = tray.material.map;
      tray.material.emissiveIntensity = 0.9;
      tray.rotation.x = -Math.PI / 2;
      tray.rotation.z = ang;
      tray.position.copy(toWorld(px, py, 0.95));
      group.add(tray);
    }
  }

  // Raised curved walls.
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x7c6c83, roughness: 0.85 });
  for (const w of WALLS) {
    const outer = arcPoints(w.cx, w.cy, w.r + WALL_THICKNESS / 2, w.a0, w.a1, 32);
    const inner = arcPoints(w.cx, w.cy, w.r - WALL_THICKNESS / 2, w.a0, w.a1, 32).reverse();
    // Round caps at each end.
    const cap = (deg, from, to) => arcPoints(
      w.cx + w.r * Math.cos((deg * Math.PI) / 180), w.cy + w.r * Math.sin((deg * Math.PI) / 180),
      WALL_THICKNESS / 2, from, to, 8,
    );
    const pts = [...outer, ...cap(w.a1, w.a1, w.a1 + 180), ...inner, ...cap(w.a0, w.a0 + 180, w.a0 + 360)];
    group.add(extrudeUp(shapeFrom(pts), WALL_HEIGHT, 0, wallMat));
  }

  // Flat tape graphics.
  const tapeMat = new THREE.MeshStandardMaterial({ color: 0x2a2f6e, roughness: 0.8 });
  const addTape = (p, q, mat, parent) => {
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len + TAPE_WIDTH, TAPE_WIDTH), mat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = Math.atan2(q[1] - p[1], q[0] - p[0]);
    m.position.copy(toWorld((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, 0.02));
    m.receiveShadow = true;
    parent.add(m);
  };
  for (const line of TAPE_LINES) for (let k = 0; k < line.length - 1; k++) addTape(line[k], line[k + 1], tapeMat, group);
  const hexMat = new THREE.MeshStandardMaterial({ color: 0x2a2f6e, roughness: 0.8, emissive: 0x000000 });
  const hexPts = [];
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3;
    hexPts.push([HEXAGON.cx + HEXAGON.r * Math.cos(a), HEXAGON.cy + HEXAGON.r * Math.sin(a)]);
  }
  for (let k = 0; k < 6; k++) addTape(hexPts[k], hexPts[(k + 1) % 6], hexMat, group);
  const hexHalo = makeHalo(HEXAGON.r * 3.2, 0xffffff, 0);
  hexHalo.position.copy(toWorld(HEXAGON.cx, HEXAGON.cy, 0.05));
  group.add(hexHalo);

  // Start spots: a dot inside a ring, in each player's color.
  for (const [player, s] of Object.entries(START_SPOTS)) {
    const mat = new THREE.MeshStandardMaterial({ color: COLORS[player], emissive: COLORS[player], emissiveIntensity: 0.35, roughness: 0.6 });
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.5, 40), mat);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.45, 24), mat);
    for (const m of [ring, dot]) {
      m.rotation.x = -Math.PI / 2;
      m.position.copy(toWorld(s.x, s.y, 0.025));
      group.add(m);
    }
  }

  // Bumpers with lights.
  const pedestalMat = new THREE.MeshStandardMaterial({ color: 0xbdb7b2, roughness: 0.35, metalness: 0.7 });
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x241d1f, roughness: 0.75 });
  const bumpers = BUMPERS.map((b) => {
    const domeMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff, transparent: true, opacity: 0.3, roughness: 0.05, clearcoat: 1, depthWrite: false,
      emissive: 0x000000,
    });
    const g = new THREE.Group();
    g.position.copy(toWorld(b.x, b.y, 0));
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.75, 24), pedestalMat);
    pedestal.position.y = 0.37;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(BUMPER_RADIUS, BUMPER_RADIUS, 0.55, 32), baseMat);
    base.position.y = 1.02;
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x3b1a12, emissive: 0x000000, roughness: 0.5 });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(BUMPER_RADIUS, 0.07, 8, 40), rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.92;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.05, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
    dome.position.y = 1.29;
    const leds = [];
    for (let k = 0; k < 3; k++) {
      const led = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 12, 8),
        new THREE.MeshBasicMaterial({ color: DARK_LED, toneMapped: false }),
      );
      const a = (k * Math.PI * 2) / 3;
      led.position.set(Math.cos(a) * 0.38, 1.6, Math.sin(a) * 0.38);
      leds.push(led);
      g.add(led);
    }
    // A glow shell around the dome, seen from any angle.
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(1.35, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    glow.position.y = 1.2;
    const light = new THREE.PointLight(0xffffff, 0, 20, 1.2);
    light.position.y = 2.2;
    const halo = makeHalo(13, 0xffffff, 0);
    halo.position.y = 0.04;
    for (const m of [pedestal, base, rim]) { m.castShadow = true; m.receiveShadow = true; }
    g.add(pedestal, base, rim, dome, glow, light, halo);
    group.add(g);
    return { group: g, leds, light, halo, rimMat, domeMat, glow, owner: null, flash: 0 };
  });

  let showTime = -1;
  let hexOwner = null;

  function applyBumper(bp, color, on, intensity = 1) {
    for (const led of bp.leds) led.material.color.setHex(color);
    bp.light.color.setHex(color);
    bp.light.intensity = on ? 30 * intensity : 0;
    bp.halo.material.color.setHex(color);
    bp.halo.material.opacity = on ? Math.min(1, 0.85 * intensity) : 0;
    bp.rimMat.emissive.setHex(on ? color : 0x000000);
    bp.rimMat.emissiveIntensity = on ? 2 * intensity : 0;
    bp.domeMat.emissive.setHex(on ? color : 0x000000);
    bp.domeMat.emissiveIntensity = on ? 0.9 * intensity : 0;
    bp.domeMat.opacity = on ? 0.55 : 0.3;
    bp.glow.material.color.setHex(color);
    bp.glow.material.opacity = on ? Math.min(0.6, 0.28 * intensity) : 0;
  }

  return {
    group,

    setBumperOwner(i, owner, flash = true) {
      const bp = bumpers[i];
      bp.owner = owner;
      if (flash && owner) bp.flash = 1;
      applyBumper(bp, ownerColor(owner), !!owner);
    },

    setAllBumpers(owners) {
      owners.forEach((o, i) => this.setBumperOwner(i, o, false));
    },

    setHexGlow(owner) {
      hexOwner = owner;
      if (owner) {
        hexMat.emissive.setHex(COLORS[owner]);
        hexMat.emissiveIntensity = 1.6;
        hexHalo.material.color.setHex(COLORS[owner]);
        hexHalo.material.opacity = 0.45;
      } else {
        hexMat.emissive.setHex(0x000000);
        hexHalo.material.opacity = 0;
      }
    },

    startLightShow() { showTime = 0; },

    stopLightShow() {
      showTime = -1;
      bumpers.forEach((bp) => applyBumper(bp, ownerColor(bp.owner), !!bp.owner));
    },

    update(dt, time) {
      if (showTime >= 0) {
        showTime += dt;
        const palette = [COLORS.human, COLORS.computer, COLORS.amber, 0xff4a3a, 0xffffff];
        bumpers.forEach((bp, i) => {
          const c = palette[(Math.floor(showTime * 9) + i) % palette.length];
          applyBumper(bp, c, true, 0.8 + 0.4 * Math.sin(showTime * 20 + i));
        });
        return;
      }
      for (const bp of bumpers) {
        if (bp.flash > 0) {
          bp.flash = Math.max(0, bp.flash - dt * 2.5);
          applyBumper(bp, ownerColor(bp.owner), !!bp.owner, 1 + bp.flash * 1.5);
        }
      }
      if (hexOwner) {
        hexMat.emissiveIntensity = 1.2 + 0.6 * Math.sin(time * 4);
        hexHalo.material.opacity = 0.35 + 0.15 * Math.sin(time * 4);
      }
    },
  };
}
