import Stats from 'stats.js';
import {
	AmbientLight,
	PCFSoftShadowMap,
	PerspectiveCamera,
	PointLight,
	Scene,
	WebGLRenderer
} from 'three';
import { DancerCore } from './dancer-core.js';

/** @type {HTMLCanvasElement} */
let canvas;
/** @type {WebGLRenderer} */
let renderer;
/** @type {Scene} */
let scene;
/** @type {AmbientLight} */
let ambientLight;
/** @type {PointLight} */
let pointLight;
/** @type {PerspectiveCamera} */
let camera;
/** @type {Stats} */
let stats;

init();
animate();

function init() {
	// ===== 🖼️ CANVAS, RENDERER, & SCENE =====
	{
		canvas = document.createElement('canvas');
		document.body.appendChild(canvas);
		renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = PCFSoftShadowMap;
		scene = new Scene();
	}

	// ===== 💡 LIGHTS =====
	{
		ambientLight = new AmbientLight('white', 0.4);
		pointLight = new PointLight('white', 20, 100);
		pointLight.position.set(-2, 2, 2);
		pointLight.castShadow = true;
		pointLight.shadow.radius = 4;
		pointLight.shadow.camera.near = 0.1;
		pointLight.shadow.camera.far = 1000;
		pointLight.shadow.mapSize.width = 2048;
		pointLight.shadow.mapSize.height = 2048;
		scene.add(ambientLight);
		scene.add(pointLight);
	}

	// ===== 📦 OBJECTS =====
	{
		const core = new DancerCore();
		scene.add(core.group);
	}

	// ===== 🎥 CAMERA =====
	{
		camera = new PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
		camera.position.set(2, 2, 5);
	}

	// ===== 📈 STATS =====
	{
		stats = new Stats();
		document.body.appendChild(stats.dom);
	}
}

function animate() {
	requestAnimationFrame(animate);

	stats.begin();

	if (resizeRendererToDisplaySize(renderer)) {
		const canvas = renderer.domElement;
		camera.aspect = canvas.clientWidth / canvas.clientHeight;
		camera.updateProjectionMatrix();
	}

	renderer.render(scene, camera);
	stats.end();
}

function resizeRendererToDisplaySize(renderer) {
	const canvas = renderer.domElement;
	const width = canvas.clientWidth;
	const height = canvas.clientHeight;
	const needResize = canvas.width !== width || canvas.height !== height;
	if (needResize) {
		renderer.setSize(width, height, false);
	}
	return needResize;
}
