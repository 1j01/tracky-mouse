/* global require, __dirname, process */

const path = require('path');
const fs = require('fs/promises');
const { spawn } = require('child_process');

const rootDir = __dirname;
const outDir = path.join(rootDir, 'bin');
const exeName = process.platform === 'win32' ? 'tracky-mouse-driver.exe' : 'tracky-mouse-driver';
const outPath = path.join(outDir, exeName);

function run(command, args, options = {}) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			cwd: rootDir,
			stdio: 'inherit',
			...options,
		});
		child.on('error', reject);
		child.on('close', (code) => {
			if (code !== 0) {
				reject(new Error(`Command failed with exit code ${code}: ${command} ${args.join(' ')}`));
				return;
			}
			resolve();
		});
	});
}

async function main() {
	await fs.mkdir(outDir, { recursive: true });
	await run('go', ['mod', 'download']);
	const isWayland = process.platform === 'linux' &&
		(process.env.XDG_SESSION_TYPE === 'wayland' || process.env.WAYLAND_DISPLAY);
	const buildArgs = ['build'];
	const buildEnv = { ...process.env };

	if (isWayland) {
		buildArgs.push('-tags', 'libei');
		buildEnv.CGO_ENABLED = '0';
	}

	buildArgs.push('-o', outPath, '.');
	await run('go', buildArgs, { env: buildEnv });
	console.log(`Built tm-driver at ${outPath}`);
}

main().catch((error) => {
	console.error(error);
	if (error.code === "ENOENT") {
		console.error("Make sure Go is installed and included in your PATH.");
	}
	process.exit(1);
});
