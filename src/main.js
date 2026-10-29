// Dom-jot entry point.
import { Game } from './controller.js';
import { updateIfStale } from './update.js';

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

const ui = document.getElementById('ui');

if (!webglAvailable()) {
  ui.innerHTML = `<div class="overlay"><div class="card"><h2>3D graphics are not available</h2>
    <p>Dom-jot needs WebGL. Try a current version of Chrome, Edge, Firefox or Safari, and make sure hardware acceleration is on.</p></div></div>`;
} else if (!(await updateIfStale())) {
  const game = new Game({ canvas: document.getElementById('scene'), uiRoot: ui });
  window.domjot = game; // handy for debugging in the browser console
  game.start();
}
