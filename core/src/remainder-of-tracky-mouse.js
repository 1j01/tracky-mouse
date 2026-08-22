/* global Stats, clm, faceLandmarksDetection, OneEuroFilter */

import { initDwellClicking } from "./dwell-clicker.js";
import { initScreenOverlay } from "./hud.js";

export const TrackyMouse = {
	dependenciesRoot: new URL("..", import.meta.url).href.replace(/\/+$/, ""),
};

// Deprecation notice for `TrackyMouse.dependenciesRoot`
let _dependenciesRoot = TrackyMouse.dependenciesRoot;
Object.defineProperty(TrackyMouse, "dependenciesRoot", {
	set(value) {
		console.warn("TrackyMouse.dependenciesRoot is deprecated, and no longer needs to be set. You can remove it from your code. Dependencies will be loaded relative to the tracky-mouse.js module.");
		_dependenciesRoot = value.replace(/\/+$/, "");
	},
	get() {
		return _dependenciesRoot;
	},
});

TrackyMouse.loadDependencies = function ({ statsJs = false } = {}) {
	const loadScript = src => {
		return new Promise((resolve, reject) => {
			// This wouldn't wait for them to load
			// for (const script of document.scripts) {
			// 	if (script.src.includes(src)) {
			// 		resolve();
			// 		return;
			// 	}
			// }
			const script = document.createElement('script');
			script.type = 'text/javascript';
			script.onload = resolve;
			script.onerror = reject;
			script.src = src;
			document.head.append(script);
		});
	};
	const scriptFiles = [
		`${TrackyMouse.dependenciesRoot}/lib/no-eval.js`, // generated with eval-is-evil.html, this instruments clmtrackr.js so I don't need unsafe-eval in the CSP
		`${TrackyMouse.dependenciesRoot}/lib/clmtrackr.js`,
		`${TrackyMouse.dependenciesRoot}/lib/face_mesh/face_mesh.js`,
		`${TrackyMouse.dependenciesRoot}/lib/OneEuroFilter.js`,
	];
	// face-landmarks-detection.min.js depends on face_mesh.js
	// avoid sporadic "TypeError: o.Facemesh is not a constructor" by loading face-landmarks-detection after face_mesh.js
	// TODO: preload in parallel?
	const moreScriptFiles = [
		`${TrackyMouse.dependenciesRoot}/lib/face-landmarks-detection.min.js`,
	];
	if (statsJs) {
		scriptFiles.push(`${TrackyMouse.dependenciesRoot}/lib/stats.js`);
	}
	return Promise.all(scriptFiles.map(loadScript)).then(() => {
		return Promise.all(moreScriptFiles.map(loadScript));
	});
};

TrackyMouse.initDwellClicking = function (config) {
	return initDwellClicking(config);
};

;


TrackyMouse.initScreenOverlay = initScreenOverlay;
