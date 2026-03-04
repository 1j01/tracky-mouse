const { spawnSync } = require("child_process");
const path = require("path");

const allowFailure = process.argv.includes("--allow-failure");

const tmNativeDir = path.join(__dirname, "..", "desktop-app", "tm-native");
const exeName = process.platform === "win32" ? "tm-native.exe" : "tm-native";

console.log(`[tm-native] Building native helper (${exeName}) in ${tmNativeDir}...`);

// Ensure go.sum and dependencies are present
const tidyResult = spawnSync("go", ["mod", "tidy"], {
	cwd: tmNativeDir,
	stdio: "inherit",
	shell: process.platform === "win32",
});

if (tidyResult.error || tidyResult.status !== 0) {
	console.error("[tm-native] Failed to run 'go mod tidy'.");
	if (tidyResult.error) {
		console.error(tidyResult.error);
	}
	if (allowFailure) {
		console.warn("[tm-native] Continuing without native helper. Mouse control will be disabled.");
		process.exit(0);
	}
	process.exit(tidyResult.status || 1);
}

const result = spawnSync("go", ["build", "-o", exeName], {
	cwd: tmNativeDir,
	stdio: "inherit",
	shell: process.platform === "win32",
});

if (result.error || result.status !== 0) {
	console.error("[tm-native] Failed to build native helper.");
	if (result.error) {
		console.error(result.error);
	}
	if (allowFailure) {
		console.warn("[tm-native] Continuing without native helper. Mouse control will be disabled.");
		process.exit(0);
	}
	process.exit(result.status || 1);
}

console.log("[tm-native] Build completed successfully.");
