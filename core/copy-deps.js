/* global require */
const fs = require("fs");
const { Readable } = require('stream');
const { finished } = require('stream/promises');

/** Overwrites destination with file downloaded from url */
const downloadFile = (async (url, destination) => {
	const res = await fetch(url);
	const fileStream = fs.createWriteStream(destination);
	await finished(Readable.fromWeb(res.body).pipe(fileStream));
});

fs.mkdirSync("lib/face_mesh", { recursive: true });

// fs.copyFileSync("node_modules/@tensorflow/tfjs-core/dist/tf-core.min.js", "lib/tf-core.min.js");
// fs.copyFileSync("node_modules/@tensorflow/tfjs-core/dist/tf-core.min.js.map", "lib/tf-core.min.js.map");
// fs.copyFileSync("node_modules/@tensorflow/tfjs-backend-webgl/dist/tf-backend-webgl.min.js", "lib/tf-backend-webgl.min.js");
// fs.copyFileSync("node_modules/@tensorflow/tfjs-backend-webgl/dist/tf-backend-webgl.min.js.map", "lib/tf-backend-webgl.min.js.map");
// fs.copyFileSync("node_modules/@tensorflow-models/face-landmarks-detection/dist/face-landmarks-detection.min.js", "lib/face-landmarks-detection.min.js");

// fs.copyFileSync("node_modules/@mediapipe/face_mesh/face_mesh.js", "lib/face_mesh/face_mesh.js");
// fs.copyFileSync("node_modules/@mediapipe/face_mesh/face_mesh_solution_packed_assets_loader.js", "lib/face_mesh/face_mesh_solution_packed_assets_loader.js");
// fs.copyFileSync("node_modules/@mediapipe/face_mesh/face_mesh_solution_simd_wasm_bin.js", "lib/face_mesh/face_mesh_solution_simd_wasm_bin.js");
// fs.copyFileSync("node_modules/@mediapipe/face_mesh/face_mesh.binarypb", "lib/face_mesh/face_mesh.binarypb");
// fs.copyFileSync("node_modules/@mediapipe/face_mesh/face_mesh_solution_packed_assets.data", "lib/face_mesh/face_mesh_solution_packed_assets.data");
// fs.copyFileSync("node_modules/@mediapipe/face_mesh/face_mesh_solution_simd_wasm_bin.wasm", "lib/face_mesh/face_mesh_solution_simd_wasm_bin.wasm");

Promise.all([
	downloadFile("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-core/dist/tf-core.min.js", "lib/tf-core.min.js"),
	downloadFile("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-core/dist/tf-core.min.js.map", "lib/tf-core.min.js.map"),
	downloadFile("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-webgl/dist/tf-backend-webgl.min.js", "lib/tf-backend-webgl.min.js"),
	downloadFile("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-webgl/dist/tf-backend-webgl.min.js.map", "lib/tf-backend-webgl.min.js.map"),
	downloadFile("https://cdn.jsdelivr.net/npm/@tensorflow-models/face-landmarks-detection/dist/face-landmarks-detection.min.js", "lib/face-landmarks-detection.min.js"),
	downloadFile("https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js", "lib/face_mesh/face_mesh.js"),
	downloadFile("https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh_solution_packed_assets_loader.js", "lib/face_mesh/face_mesh_solution_packed_assets_loader.js"),
	downloadFile("https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh_solution_simd_wasm_bin.js", "lib/face_mesh/face_mesh_solution_simd_wasm_bin.js"),
	downloadFile("https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.binarypb", "lib/face_mesh/face_mesh.binarypb"),
	downloadFile("https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh_solution_packed_assets.data", "lib/face_mesh/face_mesh_solution_packed_assets.data"),
	downloadFile("https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh_solution_simd_wasm_bin.wasm", "lib/face_mesh/face_mesh_solution_simd_wasm_bin.wasm"),
]).then(() => {
	console.log("Dependencies copied successfully!");
}, (error) => {
	console.error("Error copying dependencies:", error);
});
