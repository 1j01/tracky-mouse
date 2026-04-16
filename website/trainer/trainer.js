import { TrainerDB } from "./db.js";

const db = new TrainerDB();

// const video = document.createElement('video');
// video.style.width = '100%';
// video.style.maxWidth = '500px';
// video.style.border = '1px solid #ccc';

// const cameraSelect = document.createElement('select');
// cameraSelect.style.marginBottom = '10px';

// const allowButton = document.createElement('button');
// allowButton.textContent = 'Allow Camera';
// allowButton.style.marginRight = '10px';

// const container = document.createElement('div');
// container.style.padding = '20px';
// container.appendChild(allowButton);
// container.appendChild(cameraSelect);
// container.appendChild(video);
// document.getElementById("trainer-applet").appendChild(container);

// allowButton.addEventListener('click', async () => {
// 	try {
// 		const stream = await navigator.mediaDevices.getUserMedia({ video: true });
// 		video.srcObject = stream;
// 		video.play();

// 		// Populate camera selector
// 		const devices = await navigator.mediaDevices.enumerateDevices();
// 		const videoDevices = devices.filter(device => device.kind === 'videoinput');

// 		videoDevices.forEach(device => {
// 			const option = document.createElement('option');
// 			option.value = device.deviceId;
// 			option.textContent = device.label || `Camera ${videoDevices.indexOf(device) + 1}`;
// 			cameraSelect.appendChild(option);
// 		});

// 		allowButton.disabled = true;
// 	} catch (error) {
// 		console.error('Camera access denied:', error);
// 	}
// });

// cameraSelect.addEventListener('change', async () => {
// 	const stream = await navigator.mediaDevices.getUserMedia({
// 		video: { deviceId: cameraSelect.value }
// 	});
// 	video.srcObject = stream;
// });

/* global faceLandmarksDetection */

// const video = document.getElementById("video");
// const canvas = document.getElementById("overlay");
// const ctx = canvas.getContext("2d");

// const poses = {
// 	"tongue-center": { label: "Tongue Center", desc: "Stick your tongue straight out." },
// 	"tongue-left": { label: "Tongue Left", desc: "Stick your tongue out to the left." },
// 	"tongue-right": { label: "Tongue Right", desc: "Stick your tongue out to the right." },
// 	"tongue-up": { label: "Tongue Up", desc: "Stick your tongue out upwards." },
// 	"tongue-down": { label: "Tongue Down", desc: "Stick your tongue out downwards." },
// 	"mouth-open": { label: "Mouth Open", desc: "Open your mouth without sticking out your tongue." },
// 	"mouth-closed": { label: "Mouth Closed", desc: "Keep your mouth closed, but make various facial expressions." }
// };

// let currentPoseIndex = 0;
// let model;

// const buckets = {}; // pose -> pitch -> yaw -> images

// function quantize(angle) {
// 	return Math.max(-40, Math.min(40, Math.round(angle / 10) * 10));
// }

// function estimateHeadPose(landmarks) {
// 	const leftEye = landmarks[33];
// 	const rightEye = landmarks[263];
// 	const nose = landmarks[1];

// 	const dx = rightEye.x - leftEye.x;
// 	const dy = rightEye.y - leftEye.y;

// 	const yaw = (nose.x - (leftEye.x + rightEye.x) / 2) / dx * 100;
// 	const pitch = (nose.y - (leftEye.y + rightEye.y) / 2) / dy * 100;

// 	return {
// 		yaw: quantize(yaw),
// 		pitch: quantize(pitch)
// 	};
// }

// function cropMouth(video, landmarks) {
// 	const mouth = landmarks.slice(61, 88);

// 	let minX = Infinity, minY = Infinity;
// 	let maxX = 0, maxY = 0;

// 	for (let p of mouth) {
// 		minX = Math.min(minX, p.x);
// 		minY = Math.min(minY, p.y);
// 		maxX = Math.max(maxX, p.x);
// 		maxY = Math.max(maxY, p.y);
// 	}

// 	const size = Math.max(maxX - minX, maxY - minY) * 1.5;

// 	const temp = document.createElement("canvas");
// 	temp.width = temp.height = 128;

// 	const tctx = temp.getContext("2d");
// 	tctx.drawImage(
// 		video,
// 		minX - size / 4,
// 		minY - size / 4,
// 		size,
// 		size,
// 		0,
// 		0,
// 		128,
// 		128
// 	);

// 	return new Promise(res => temp.toBlob(res));
// }

// function ensureBucket(pose, pitch, yaw) {
// 	if (!buckets[pose]) buckets[pose] = {};
// 	if (!buckets[pose][pitch]) buckets[pose][pitch] = {};
// 	if (!buckets[pose][pitch][yaw]) buckets[pose][pitch][yaw] = [];
// 	return buckets[pose][pitch][yaw];
// }

// async function loop() {
// 	const preds = await model.estimateFaces(video);

// 	if (preds.length) {
// 		const lm = preds[0].scaledMesh;

// 		const { pitch, yaw } = estimateHeadPose(lm);
// 		const pose = poses[currentPoseIndex];

// 		const bucket = ensureBucket(pose, pitch, yaw);

// 		if (bucket.length < 5) {
// 			const blob = await cropMouth(video, lm);
// 			bucket.push(blob);

// 			await db.save(pose, pitch, yaw, bucket.length, blob);
// 			updateGrid();
// 		}

// 		checkAdvance(pose);
// 	}

// 	requestAnimationFrame(loop);
// }

// function checkAdvance(pose) {
// 	const grid = buckets[pose];
// 	if (!grid) return;

// 	let allReady = true;

// 	for (let p = -40; p <= 40; p += 10) {
// 		for (let y = -40; y <= 40; y += 10) {
// 			const count = grid?.[p]?.[y]?.length || 0;
// 			if (count < 2) {
// 				allReady = false;
// 				break;
// 			}
// 		}
// 	}

// 	if (allReady && currentPoseIndex < poses.length - 1) {
// 		currentPoseIndex++;
// 		updateUI();
// 	}
// }

// function updateUI() {
// 	document.getElementById("poseLabel").innerText =
// 		"Pose: " + poses[currentPoseIndex];
// }

// function updateGrid() {
// 	const gridEl = document.getElementById("grid");
// 	gridEl.innerHTML = "";

// 	const pose = poses[currentPoseIndex];

// 	for (let p = -40; p <= 40; p += 10) {
// 		for (let y = -40; y <= 40; y += 10) {
// 			const div = document.createElement("div");
// 			div.className = "bucket";

// 			const imgs = buckets?.[pose]?.[p]?.[y] || [];

// 			imgs.forEach(blob => {
// 				const img = document.createElement("img");
// 				img.src = URL.createObjectURL(blob);
// 				div.appendChild(img);
// 			});

// 			if (imgs.length >= 2) div.classList.add("filled");

// 			gridEl.appendChild(div);
// 		}
// 	}
// }

// async function setupCamera() {
// 	const devices = await navigator.mediaDevices.enumerateDevices();
// 	const select = document.getElementById("cameraSelect");

// 	devices
// 		.filter(d => d.kind === "videoinput")
// 		.forEach(d => {
// 			const opt = document.createElement("option");
// 			opt.value = d.deviceId;
// 			opt.text = d.label || "Camera";
// 			select.appendChild(opt);
// 		});
// }

// async function startCamera() {
// 	const deviceId = document.getElementById("cameraSelect").value;

// 	const stream = await navigator.mediaDevices.getUserMedia({
// 		video: { deviceId }
// 	});

// 	video.srcObject = stream;
// }

// document.getElementById("selectFolder").onclick = () => db.selectFolder();
// document.getElementById("startCamera").onclick = startCamera;

// await setupCamera();

// model = await faceLandmarksDetection.load(
// 	faceLandmarksDetection.SupportedPackages.mediapipeFacemesh
// );

// updateUI();
// loop();