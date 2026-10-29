// Renderer, camera, bar lighting and camera views.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TABLE_HEIGHT } from '../data/tableLayout.js';
import { toWorld, easeInOut } from './util.js';

export function createScene(canvas) {
  const isTouch = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0c080b);
  scene.fog = new THREE.FogExp2(0x160e12, 0.0042);

  const camera = new THREE.PerspectiveCamera(45, 1, 1, 2000);
  camera.position.set(0, 80, 115);

  // Dim, warm bar atmosphere.
  scene.add(new THREE.AmbientLight(0x8a6d5c, 0.6));
  scene.add(new THREE.HemisphereLight(0xffdcb8, 0x2a1620, 0.55));

  // Overhead lights above the table, casting soft ball shadows.
  for (const x of [-30, 30]) {
    const spot = new THREE.SpotLight(0xffe4c4, 2.4, 0, 0.62, 0.65, 0);
    spot.position.set(x, 95, 4);
    spot.target.position.set(x * 0.6, 0, 0);
    spot.castShadow = true;
    // Smaller shadow maps on phones and tablets to keep the frame rate up.
    spot.shadow.mapSize.set(isTouch ? 1024 : 2048, isTouch ? 1024 : 2048);
    spot.shadow.bias = -0.0004;
    spot.shadow.camera.near = 40;
    spot.shadow.camera.far = 140;
    scene.add(spot, spot.target);
  }

  // Floor and a few dim bar-room shapes in the haze.
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(400, 48),
    new THREE.MeshStandardMaterial({ color: 0x1a1113, roughness: 1 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -TABLE_HEIGHT;
  floor.receiveShadow = true;
  scene.add(floor);
  addBarRoom(scene);

  const resize = () => {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // On narrow screens, widen the view so the whole table still fits across.
    const minAspect = 1.35;
    camera.fov = camera.aspect >= minAspect ? 45
      : Math.min(95, (2 * Math.atan(Math.tan((45 * Math.PI) / 360) * (minAspect / camera.aspect)) * 180) / Math.PI);
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  resize();

  return { renderer, scene, camera };
}

function addBarRoom(scene) {
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x24161a, roughness: 0.95 });
  const glowMat = (c) => new THREE.MeshBasicMaterial({ color: c });
  // Back bar counter with warm shelf lights, far behind the table.
  const counter = new THREE.Mesh(new THREE.BoxGeometry(260, 40, 20), wallMat);
  counter.position.set(0, -12, -190);
  scene.add(counter);
  for (let i = -5; i <= 5; i++) {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(18, 1.2, 1), glowMat(i % 2 ? 0xff9a4a : 0xd8613a));
    shelf.position.set(i * 22, 22 + (i % 3) * 9, -199);
    scene.add(shelf);
  }
  // Hanging lamps over the table.
  for (const x of [-30, 30]) {
    const shade = new THREE.Mesh(
      new THREE.ConeGeometry(7, 6, 24, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x3a2418, roughness: 0.6, side: THREE.DoubleSide, emissive: 0x2a1408 }),
    );
    shade.position.set(x, 100, 4);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 12), glowMat(0xffe0b0));
    bulb.position.set(x, 98, 4);
    scene.add(shade, bulb);
  }
}

// Orbit controls: left-drag rotates, wheel zooms, right-drag slides.
// Create after the shot input so the shot input can claim drags on the terik first.
export function createControls(camera, canvas) {
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 22;
  controls.maxDistance = 260;
  controls.maxPolarAngle = Math.PI * 0.47; // never below the felt
  controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  controls.target.set(0, 0, 0);
  controls.addEventListener('change', () => {
    // Keep the orbit point on the table.
    const t = controls.target;
    t.x = Math.max(-60, Math.min(60, t.x));
    t.z = Math.max(-34, Math.min(34, t.z));
    t.y = Math.max(-2, Math.min(10, t.y));
  });
  controls.update();
  return controls;
}

// Camera views and smooth moves between them.
export class CameraRig {
  constructor(camera, controls, tweens) {
    this.camera = camera;
    this.controls = controls;
    this.tweens = tweens;
  }

  flyTo(position, target, duration = 0.9) {
    const p0 = this.camera.position.clone();
    const t0 = this.controls.target.clone();
    return this.tweens.add(duration, (k) => {
      const e = easeInOut(k);
      this.camera.position.lerpVectors(p0, position, e);
      this.controls.target.lerpVectors(t0, target, e);
    });
  }

  overhead() {
    return this.flyTo(new THREE.Vector3(0, 165, 0.5), new THREE.Vector3(0, 0, 0));
  }

  bar() {
    return this.flyTo(new THREE.Vector3(0, 78, 112), new THREE.Vector3(0, 0, -2));
  }

  // Low behind a ball, looking along an angle (table coordinates).
  player(ball, angle) {
    const back = toWorld(ball.x - Math.cos(angle) * 34, ball.y - Math.sin(angle) * 34, 15);
    const ahead = toWorld(ball.x + Math.cos(angle) * 18, ball.y + Math.sin(angle) * 18, 0);
    return this.flyTo(back, ahead);
  }

  lookAt(x, y, dist = 40, height = 30) {
    return this.flyTo(toWorld(x, y - dist, height), toWorld(x, y, 0), 0.8);
  }
}
