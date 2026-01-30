const fs = require('fs');
const version = process.env.VERSION;

if (!version) {
	console.error('VERSION env var is not set');
	process.exit(1);
}
if (version !== require('../../package.json').version) {
	console.error('VERSION env var does not match package.json version');
	process.exit(1);
}
const filesWithDownloadLinks = ["README.md", "website/index.html"];
const releaseDownloadLinkRegex = /(https:\/\/github.com\/1j01\/tracky-mouse\/releases\/download\/)[^/]*(\/Tracky.Mouse.)[^/)'"]*(.Setup.exe)/g;
for (const file of filesWithDownloadLinks) {
	fs.writeFileSync(file, fs.readFileSync(file, 'utf8')
		.replace(releaseDownloadLinkRegex, '$1v' + version + '$2' + version + '$3')
	);
}

console.log(`Updated download links in ${filesWithDownloadLinks.join(', ')} to version ${version}.`);

// Check for any other files with download links that might have been missed
const glob = require('fast-glob');
const path = require('path');
const files = glob.sync(['**/*.*'], {
	cwd: process.cwd(),
	absolute: true,
	ignore: ['**/node_modules/**', '**/dist/**', '**/out/**']
});
for (const file of files) {
	if (filesWithDownloadLinks.some(f => path.resolve(f) === path.resolve(file))) {
		continue;
	}
	const content = fs.readFileSync(file, 'utf8');
	if (content.match(releaseDownloadLinkRegex)) {
		console.warn(`Warning: Found download link in ${file} that is not in the list of files to update.`);
	}
}