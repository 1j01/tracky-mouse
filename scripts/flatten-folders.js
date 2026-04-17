#!/usr/bin/env node

/*
Script to copy files from a directory tree while flattening hierarchy.
Non-unique file names will be numbered to avoid collisions.
Usage:
  node flatten-folders.js <sourceDir> <destinationDir> [--preserve=N] [--dry-run]
Example:
  node flatten-folders.js ./mouth-pose-dataset/poses ./mouth-pose-dataset/poses-flat --preserve=1
*/

const fs = require("fs");
const path = require("path");
const fg = require("fast-glob");

async function main() {
	const sourceDir = process.argv[2];
	const destinationDir = process.argv[3];
	const dryRun = process.argv.includes("--dry-run");
	if (!sourceDir || !destinationDir) {
		console.error("Usage: node flatten-folders.js <sourceDir> <destinationDir> [--preserve=N] [--dry-run]");
		process.exit(1);
	}
	let preserveCountArg = process.argv.find(arg => arg.startsWith("--preserve"));
	let preserveCount = 0;
	if (preserveCountArg === "--preserve") {
		preserveCountArg = process.argv[process.argv.indexOf(preserveCountArg) + 1];
		if (!preserveCountArg) {
			console.error("Error: --preserve flag requires a number argument");
			process.exit(1);
		}
		preserveCount = parseInt(preserveCountArg, 10);
	} else if (preserveCountArg?.includes("=")) {
		preserveCount = parseInt(preserveCountArg.split("=")[1], 10);
	}

	const entries = await fg(["**/*"], { cwd: sourceDir, onlyFiles: true });
	const usedPaths = new Map();
	for (const entry of entries) {
		const parts = entry.split("/");
		const preservedParts = parts.slice(0, preserveCount);
		const fileName = parts[parts.length - 1];
		let destinationPath = [destinationDir, ...preservedParts, fileName].join("/");
		let counter = 1;
		while (usedPaths.has(destinationPath)) {
			const ext = path.extname(fileName);
			const baseName = path.basename(fileName, ext);
			destinationPath = [destinationDir, ...preservedParts, `${baseName}_${counter}${ext}`].join("/");
			counter++;
		}
		usedPaths.set(destinationPath, true);
		await fs.promises.mkdir(path.dirname(destinationPath), { recursive: true });
		if (!dryRun) {
			await fs.promises.copyFile(path.join(sourceDir, entry), destinationPath);
			console.log(`Copied ${entry} -> ${path.relative(process.cwd(), destinationPath)}`);
		} else {
			console.log(`[Dry Run] ${entry} -> ${path.relative(process.cwd(), destinationPath)}`);
		}
	}

}

main().catch(err => {
	console.error(err);
	process.exit(1);
});