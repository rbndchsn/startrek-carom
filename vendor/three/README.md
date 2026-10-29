# three.js library

- **Version:** three.js r169 (npm `three@0.169.0`), MIT license (see `LICENSE`).
- `three.module.js` is the main library, from `build/three.module.js`.
- `addons/controls/OrbitControls.js` is the camera control add-on, from `examples/jsm/controls/`.
- Kept in the repo so the game does not depend on an outside CDN.
- Loaded through the import map in `index.html`, as `three` and `three/addons/`.
- To upgrade, replace these files with the same paths from a newer release and test the game.
