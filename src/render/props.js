// The spring stick, the guide line and the coin.
import * as THREE from 'three';
import { BALL_RADIUS as R, HOLE } from '../data/tableLayout.js';
import { COLORS } from '../data/config.js';
import { toWorld } from './util.js';

const STICK_LENGTH = 19;

// Spring-loaded aluminum stick, 19 inches, in three sections.
export function createStick(scene) {
  const yaw = new THREE.Group();
  const tilt = new THREE.Group();
  tilt.rotation.z = -0.13; // butt end raised
  yaw.add(tilt);
  const metal = new THREE.MeshStandardMaterial({ color: 0xd9dde2, metalness: 0.9, roughness: 0.22 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x5f6064, roughness: 0.95 });
  const along = (geo, x) => {
    geo.rotateZ(Math.PI / 2);
    const m = new THREE.Mesh(geo, geo.userData.mat);
    m.position.x = x;
    m.castShadow = true;
    return m;
  };
  const front = new THREE.CylinderGeometry(0.2, 0.24, 6.5, 16); front.userData.mat = metal;
  const mid = new THREE.CylinderGeometry(0.33, 0.33, 6, 16); mid.userData.mat = rubber;
  const back = new THREE.CylinderGeometry(0.26, 0.3, 6.5, 16); back.userData.mat = metal;
  tilt.add(along(front, -3.25), along(mid, -9.5), along(back, -15.75));
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshBasicMaterial({ color: COLORS.amber }));
  tilt.add(tip);
  yaw.visible = false;
  scene.add(yaw);

  let anim = null;
  return {
    // Places the stick behind a ball. pull: inches drawn back.
    aim(ball, angle, pull, color) {
      yaw.visible = true;
      tip.material.color.setHex(color ?? COLORS.amber);
      const d = R + 0.3 + pull;
      yaw.position.copy(toWorld(ball.x - Math.cos(angle) * d, ball.y - Math.sin(angle) * d, R));
      yaw.rotation.y = angle;
      anim = null;
    },
    // Snap forward to the ball, then hide.
    strike(ball, angle) {
      const from = yaw.position.clone();
      const to = toWorld(ball.x - Math.cos(angle) * (R + 0.05), ball.y - Math.sin(angle) * (R + 0.05), R);
      anim = { t: 0, from, to };
    },
    hide() { yaw.visible = false; anim = null; },
    update(dt) {
      if (!anim) return;
      anim.t += dt;
      if (anim.t < 0.06) yaw.position.lerpVectors(anim.from, anim.to, anim.t / 0.06);
      else if (anim.t > 0.45) { yaw.visible = false; anim = null; }
    },
  };
}

// Guide line from the terik to its first contact.
export function createGuide(scene) {
  const mat = new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 1.2, gapSize: 0.8, transparent: true, opacity: 0.8 });
  const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const line = new THREE.Line(geo, mat);
  const ghost = new THREE.Mesh(
    new THREE.RingGeometry(R * 0.85, R, 32),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
  );
  ghost.rotation.x = -Math.PI / 2;
  line.visible = false;
  ghost.visible = false;
  scene.add(line, ghost);
  return {
    show(from, to, color) {
      const a = toWorld(from.x, from.y, R * 0.3);
      const b = toWorld(to.x, to.y, R * 0.3);
      geo.setFromPoints([a, b]);
      line.computeLineDistances();
      mat.color.setHex(color);
      ghost.material.color.setHex(color);
      ghost.position.copy(toWorld(to.x, to.y, 0.06));
      line.visible = true;
      ghost.visible = true;
    },
    hide() { line.visible = false; ghost.visible = false; },
  };
}

function coinFace(kind) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(110, 100, 10, 128, 128, 128);
  grad.addColorStop(0, '#fff1b0');
  grad.addColorStop(0.6, '#d6a93a');
  grad.addColorStop(1, '#8a6316');
  g.fillStyle = grad;
  g.beginPath(); g.arc(128, 128, 128, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#7a5410';
  g.lineWidth = 8;
  g.beginPath(); g.arc(128, 128, 112, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#5a3c08';
  g.strokeStyle = '#5a3c08';
  if (kind === 'starfleet') {
    // A delta arrowhead emblem.
    g.beginPath();
    g.moveTo(128, 42);
    g.quadraticCurveTo(160, 120, 186, 206);
    g.quadraticCurveTo(128, 160, 70, 206);
    g.quadraticCurveTo(96, 120, 128, 42);
    g.fill();
    g.fillStyle = '#e8c35a';
    g.beginPath();
    g.moveTo(128, 104); g.lineTo(140, 140); g.lineTo(128, 132); g.lineTo(116, 140);
    g.closePath(); g.fill();
  } else {
    // An angular Nausicaan-style glyph.
    g.lineWidth = 14;
    g.lineCap = 'square';
    g.beginPath();
    g.moveTo(80, 70); g.lineTo(128, 120); g.lineTo(176, 70);
    g.moveTo(128, 120); g.lineTo(128, 196);
    g.moveTo(88, 160); g.lineTo(168, 160);
    g.moveTo(88, 160); g.lineTo(74, 186);
    g.moveTo(168, 160); g.lineTo(182, 186);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// The coin: Starfleet emblem on top (human first), Nausicaan glyph underneath (computer first).
export function createCoin(scene) {
  const side = new THREE.MeshStandardMaterial({ color: 0xc89b32, metalness: 0.9, roughness: 0.3 });
  const top = new THREE.MeshStandardMaterial({ map: coinFace('starfleet'), metalness: 0.7, roughness: 0.35 });
  const bottom = new THREE.MeshStandardMaterial({ map: coinFace('glyph'), metalness: 0.7, roughness: 0.35 });
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.16, 48), [side, top, bottom]);
  mesh.castShadow = true;
  const spin = new THREE.Group(); // flips around its local x axis
  spin.add(mesh);
  const holder = new THREE.Group();
  holder.add(spin);
  holder.visible = false;
  scene.add(holder);

  return {
    holder,
    // Plays the toss. humanFirst decides which face lands up. intoHole plays the re-toss mishap.
    // Returns a promise. tweens: the shared tween runner.
    toss(tweens, { humanFirst, land, intoHole = false }) {
      holder.visible = true;
      const start = toWorld(land.x - 14, land.y - 22, 3);
      const end = toWorld(land.x, land.y, 0.08);
      const turns = 6 + Math.floor(Math.random() * 3);
      const finalFlip = turns * Math.PI * 2 + (humanFirst ? 0 : Math.PI);
      holder.rotation.y = Math.random() * Math.PI * 2;
      return tweens.add(1.5, (k) => {
        holder.position.lerpVectors(start, end, k);
        holder.position.y = start.y + (end.y - start.y) * k + 30 * 4 * k * (1 - k);
        spin.rotation.x = finalFlip * k;
      }).then(() => tweens.add(0.7, (k) => {
        // Bounce and wobble to rest.
        const bounce = Math.abs(Math.sin(k * Math.PI * 3)) * (1 - k) * 1.8;
        holder.position.y = end.y + bounce;
        spin.rotation.x = finalFlip + Math.sin(k * 18) * (1 - k) * 0.35;
        spin.rotation.z = Math.cos(k * 14) * (1 - k) * 0.25;
      })).then(() => {
        spin.rotation.x = finalFlip;
        spin.rotation.z = 0;
        if (!intoHole) return null;
        const from = holder.position.clone();
        const hole = toWorld(HOLE.x, HOLE.y, -3);
        return tweens.add(0.9, (k) => {
          holder.position.lerpVectors(from, hole, k * k);
          spin.rotation.z = k * 1.4;
        });
      });
    },
    hide() { holder.visible = false; },
  };
}
