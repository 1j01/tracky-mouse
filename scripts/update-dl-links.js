const fs = require('fs');
const version = process.env.VERSION;

if (!version) {
	console.error('VERSION env var is not set');
	process.exit(1);
}
if (version !== require('../package.json').version) {
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
