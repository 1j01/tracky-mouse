/* global require, __dirname, process */

const path = require('path');
const fs = require('fs/promises');
const { spawn } = require('child_process');

const rootDir = __dirname;
const outDir = path.join(rootDir, 'bin');
const exeName = process.platform === 'win32' ? 'tracky-mouse-driver.exe' : 'tracky-mouse-driver';

// On Linux, robotgo has multiple pure Go backends, and the right one depends on the session type.
// The backend is picked at runtime by the desktop app; see tm-driver-client.js.
const linuxBackends = ['x11', 'wayland', 'libei'];

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

async function build(outPath, tags) {
	await run('go', ['build', '-tags', tags, '-o', outPath, '.'], {
		env: {
			...process.env,
			CGO_ENABLED: '0',
		},
	});
	console.log(`Built tm-driver at ${outPath}`);
}

async function main() {
	await fs.mkdir(outDir, { recursive: true });
	await run('go', ['mod', 'download']);
	if (process.platform === 'linux') {
		for (const backend of linuxBackends) {
			await build(path.join(outDir, `${exeName}-${backend}`), backend);
		}
	} else {
		await build(path.join(outDir, exeName), 'purego');
	}
}

main().catch((error) => {
	console.error(error);
	if (error.code === "ENOENT") {
		console.error("Make sure Go is installed and included in your PATH.");
	}
	process.exit(1);
});
