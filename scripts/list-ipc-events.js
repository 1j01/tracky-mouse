// This script was generated with AI from the prompt
// "Write a script to look for all electron IPC event names used in the project"

const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '../desktop-app');

function getAllFiles(dirPath, arrayOfFiles) {
	const files = fs.readdirSync(dirPath);

	arrayOfFiles = arrayOfFiles || [];

	files.forEach(function (file) {
		if (fs.statSync(dirPath + "/" + file).isDirectory()) {
			if (file !== 'node_modules' && file !== '.git' && file !== 'dist' && file !== 'out') {
				arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
			}
		} else {
			arrayOfFiles.push(path.join(dirPath, "/", file));
		}
	});

	return arrayOfFiles;
}

const files = getAllFiles(projectRoot);

const ipcPatterns = [
	/ipcMain\.on\(\s*['"`](.+?)['"`]/g,
	/ipcMain\.handle\(\s*['"`](.+?)['"`]/g,
	/ipcMain\.once\(\s*['"`](.+?)['"`]/g,
	/ipcRenderer\.send\(\s*['"`](.+?)['"`]/g,
	/ipcRenderer\.invoke\(\s*['"`](.+?)['"`]/g,
	/ipcRenderer\.on\(\s*['"`](.+?)['"`]/g,
	/ipcRenderer\.once\(\s*['"`](.+?)['"`]/g,
	/webContents\.send\(\s*['"`](.+?)['"`]/g,
];

const foundEvents = new Set();
const eventLocations = {}; // eventName -> [file:line]

files.forEach(file => {
	if (!file.endsWith('.js') && !file.endsWith('.ts') && !file.endsWith('.html')) {
		return;
	}

	const content = fs.readFileSync(file, 'utf8');

	ipcPatterns.forEach(pattern => {
		let match;
		// Reset regex state since we might reuse it inside the loop
		pattern.lastIndex = 0;

		while ((match = pattern.exec(content)) !== null) {
			const eventName = match[1];
			foundEvents.add(eventName);

			// Find line number
			const index = match.index;
			const lineNumber = content.substring(0, index).split('\n').length;
			// Use tabs for indentation in the console logger later, but saving relative path here
			const relativePath = path.relative(projectRoot, file);

			if (!eventLocations[eventName]) {
				eventLocations[eventName] = [];
			}
			eventLocations[eventName].push(`${relativePath}:${lineNumber}`);
		}
	});
});

console.log('Found IPC Events:');
const sortedEvents = Array.from(foundEvents).sort();
sortedEvents.forEach(event => {
	console.log(`\n- ${event}`);
	eventLocations[event].forEach(loc => {
		console.log(`\t${loc}`);
	});
});
