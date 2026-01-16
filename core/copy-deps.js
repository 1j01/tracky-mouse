/* global require */
const fs = require("fs");

fs.mkdirSync("lib/face_mesh", { recursive: true });

// When using `runtime: 'mediapipe'`, tf.js is not needed, except for some `instanceof Tensor` checks.
// An alternative to the patching below is to create a fake tf object providing a dummy Tensor class:
// window.tf ??= {
// 	Tensor: function () { }
// };
// However, I prefer not to modify the global scope, so I've patched the library code instead.

const faceLandmarksDetectionJS = fs.readFileSync("node_modules/@tensorflow-models/face-landmarks-detection/dist/face-landmarks-detection.min.js", "utf8")
	.replace(/instanceof ([a-zA-Z0-9_]+\.)?Tensor\b/g, "instanceof class FakeTensor {/*patched via copy-deps.js to avoid dependency on tfjs-core*/}");
fs.writeFileSync("lib/face-landmarks-detection.min.js", faceLandmarksDetectionJS);

fs.copyFileSync("node_modules/@mediapipe/face_mesh/face_mesh.js", "lib/face_mesh/face_mesh.js");
fs.copyFileSync("node_modules/@mediapipe/face_mesh/face_mesh_solution_packed_assets_loader.js", "lib/face_mesh/face_mesh_solution_packed_assets_loader.js");
fs.copyFileSync("node_modules/@mediapipe/face_mesh/face_mesh.binarypb", "lib/face_mesh/face_mesh.binarypb");
fs.copyFileSync("node_modules/@mediapipe/face_mesh/face_mesh_solution_packed_assets.data", "lib/face_mesh/face_mesh_solution_packed_assets.data");
fs.copyFileSync("node_modules/@mediapipe/face_mesh/face_mesh_solution_simd_wasm_bin.js", "lib/face_mesh/face_mesh_solution_simd_wasm_bin.js");
fs.copyFileSync("node_modules/@mediapipe/face_mesh/face_mesh_solution_simd_wasm_bin.wasm", "lib/face_mesh/face_mesh_solution_simd_wasm_bin.wasm");
fs.copyFileSync("node_modules/@mediapipe/face_mesh/face_mesh_solution_wasm_bin.js", "lib/face_mesh/face_mesh_solution_wasm_bin.js");
fs.copyFileSync("node_modules/@mediapipe/face_mesh/face_mesh_solution_wasm_bin.wasm", "lib/face_mesh/face_mesh_solution_wasm_bin.wasm");

fs.copyFileSync("node_modules/@david18284/one-euro-filter/dist/OneEuroFilter.js", "lib/OneEuroFilter.js");

console.log("Dependencies copied successfully!");
