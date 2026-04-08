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
			windowsHide: false,
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
	await run('go', ['build', '-o', outPath, '.']);
	console.log(`Built tm-driver at ${outPath}`);
}

main().catch((error) => {
	console.error(error.message || error);
	process.exit(1);
});
