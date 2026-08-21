
const TrackyMouse = {
	dependenciesRoot: "./tracky-mouse",
};

TrackyMouse.loadDependencies = function ({ statsJs = false } = {}) {
	TrackyMouse.dependenciesRoot = TrackyMouse.dependenciesRoot.replace(/\/+$/, "");
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
	}).then(async () => {
		const core = await import("./src/tracky-mouse.js");
		console.log("dependenciesRoot before:", TrackyMouse.dependenciesRoot);
		Object.assign(TrackyMouse, core.TrackyMouse);
		console.log("dependenciesRoot after:", TrackyMouse.dependenciesRoot);
	});
};
