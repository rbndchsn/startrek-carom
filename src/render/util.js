// Shared 3D helpers.
import * as THREE from 'three';

// Table coordinates (x right, y back) to 3D world coordinates (y up, z toward the front).
export function toWorld(x, y, h = 0) {
  return new THREE.Vector3(x, h, -y);
}

export function fromWorld(v) {
  return { x: v.x, y: -v.z };
}

// Soft round glow texture, used for light pools on the felt.
let haloTexture = null;
export function getHaloTexture() {
  if (haloTexture) return haloTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  haloTexture = new THREE.CanvasTexture(c);
  haloTexture.colorSpace = THREE.SRGBColorSpace;
  return haloTexture;
}

// A flat glow patch lying on the felt.
export function makeHalo(size, color, opacity = 0.5) {
  const mat = new THREE.MeshBasicMaterial({
    map: getHaloTexture(), color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 2;
  return mesh;
}

// Small tween runner, driven by the render loop.
export class Tweens {
  constructor() { this.list = []; }

  add(duration, onUpdate) {
    return new Promise((resolve) => {
      this.list.push({ t: 0, duration, onUpdate, resolve });
    });
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const tw = this.list[i];
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.duration);
      tw.onUpdate(k);
      if (k >= 1) {
        this.list.splice(i, 1);
        tw.resolve();
      }
    }
  }
}

export const easeInOut = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
export const easeOut = (k) => 1 - (1 - k) ** 3;
