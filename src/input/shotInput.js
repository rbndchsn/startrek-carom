// Slingshot shot input: press on your terik, pull back, release.
// Must be created before the orbit controls so it can claim drags that start on the terik.
import * as THREE from 'three';
import { BALL_RADIUS as R } from '../data/tableLayout.js';
import { toWorld } from '../render/util.js';

export const MAX_PULL = 28;        // inches of pull for full power
const DEAD_ZONE = 1.2;             // pulls shorter than this do nothing
const FINE_STEP = (0.25 * Math.PI) / 180;

// ctx: { canvas, camera, canAim(), getBall(), onAim(state), onShoot(state), onCancel() }
export function createShotInput(ctx) {
  const { canvas, camera } = ctx;
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -R);
  // Generous grab area: a press within about 4 inches of your terik picks it up.
  const pickSphere = new THREE.Sphere(new THREE.Vector3(), 4.2);
  const hitPoint = new THREE.Vector3();
  let aiming = null; // { pointerId, angleOffset, lastPull: {x, y}, state }

  function setRay(e) {
    const rect = canvas.getBoundingClientRect();
    ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
  }

  function overBall(e) {
    const b = ctx.getBall();
    if (!b || !b.active) return false;
    setRay(e);
    pickSphere.center.copy(toWorld(b.x, b.y, R));
    return raycaster.ray.intersectsSphere(pickSphere);
  }

  function compute() {
    const b = ctx.getBall();
    const px = aiming.lastPull.x;
    const py = aiming.lastPull.y;
    const dist = Math.hypot(px, py);
    const baseAngle = Math.atan2(-py, -px);
    const angle = baseAngle + aiming.angleOffset;
    const pull = Math.min(dist, MAX_PULL);
    const power = dist < DEAD_ZONE ? 0 : ((pull - DEAD_ZONE) / (MAX_PULL - DEAD_ZONE)) ** 1.6;
    aiming.state = { angle, power, pull: power > 0 ? pull * 0.35 : 0, ball: { x: b.x, y: b.y } };
    ctx.onAim(aiming.state);
  }

  function updatePull(e) {
    setRay(e);
    if (!raycaster.ray.intersectPlane(plane, hitPoint)) return;
    const b = ctx.getBall();
    aiming.lastPull = { x: hitPoint.x - b.x, y: -hitPoint.z - b.y };
    compute();
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !ctx.canAim() || !overBall(e)) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    aiming = { pointerId: e.pointerId, angleOffset: 0, lastPull: { x: 0, y: 0 }, state: null };
    canvas.style.cursor = 'grabbing';
    updatePull(e);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (aiming && e.pointerId === aiming.pointerId) {
      e.stopImmediatePropagation();
      updatePull(e);
      return;
    }
    if (!aiming) canvas.style.cursor = ctx.canAim() && overBall(e) ? 'grab' : '';
  });

  const finish = (e, cancel) => {
    if (!aiming || (e && e.pointerId !== aiming.pointerId)) return;
    if (e) e.stopImmediatePropagation();
    const st = aiming.state;
    aiming = null;
    canvas.style.cursor = '';
    if (!cancel && st && st.power > 0.01) ctx.onShoot(st);
    else ctx.onCancel();
  };
  canvas.addEventListener('pointerup', (e) => finish(e, false));
  canvas.addEventListener('pointercancel', (e) => finish(e, true));

  window.addEventListener('keydown', (e) => {
    if (!aiming) return;
    if (e.key === 'ArrowLeft') { aiming.angleOffset += FINE_STEP; compute(); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { aiming.angleOffset -= FINE_STEP; compute(); e.preventDefault(); }
    else if (e.key === 'Escape') { finish(null, true); e.preventDefault(); }
  });

  return {
    isAiming: () => !!aiming,
    cancel: () => finish(null, true),
  };
}
