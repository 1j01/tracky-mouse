const { dialog, shell, net } = require('electron');

const REPO = '1j01/tracky-mouse';
let API_URL = `https://api.github.com/repos/${REPO}/releases/latest`;

const TEST_UPDATE_CHECKING = process.env.TEST_UPDATE_CHECKING === 'true';

if (TEST_UPDATE_CHECKING) {
	const http = require('http');
	const url = require('url');

	const PORT = 64207;

	const server = http.createServer((req, res) => {
		const parsedUrl = url.parse(req.url, true);
		const path = parsedUrl.pathname;

		// Match: /repos/{owner}/{repo}/releases/latest
		const match = path.match(/^\/repos\/([^/]+)\/([^/]+)\/releases\/latest$/);

		if (req.method === 'GET' && match) {
			const owner = match[1];
			const repo = match[2];

			const mockResponse = {
				url: `https://api.github.com/repos/${owner}/${repo}/releases/latest`,
				html_url: `https://github.com/${owner}/${repo}/releases/tag/v9001.0.0`,
				tag_name: 'v9001.0.0',
				name: 'Mock Release v9001.0.0',
				draft: false,
				prerelease: false,
				published_at: new Date().toISOString(),
				body: 'This is a mocked GitHub release response.',
				assets: [
					{
						name: `${repo}-v9001.0.0.zip`,
						browser_download_url: `https://example.com/${repo}-v9001.0.0.zip`,
						size: 123456
					}
				]
			};

			res.writeHead(200, {
				'Content-Type': 'application/json',
				'Cache-Control': 'no-cache',
			});
			res.end(JSON.stringify(mockResponse, null, 2));
			return;
		}

		// Fallback for unknown routes
		res.writeHead(418, { 'Content-Type': 'application/json' });
		res.end(JSON.stringify({ message: 'Unexpected route. I can only brew tea.' }));
	});

	server.listen(PORT, () => {
		console.log(`Mock GitHub API running at http://localhost:${PORT}`);
	});

	API_URL = `http://localhost:${PORT}/repos/${REPO}/releases/latest`;
}

function parseVersion(versionString) {
	versionString = versionString.replace(/^v/, '');
	// Removes anything after a hyphen (prerelease info)
	// TODO: handle prerelease versions properly (maybe skip them?)
	const parts = versionString.split('-')[0].split('.').map(Number);
	return parts;
}

function isNewer(current, latest) {
	const currentParts = parseVersion(current);
	const latestParts = parseVersion(latest);

	for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
		const c = currentParts[i] || 0;
		const l = latestParts[i] || 0;
		if (l > c) return true;
		if (l < c) return false;
	}
	return false;
}

module.exports = {
	checkForUpdates: ({ currentVersion, skippedVersion, pleaseSkipThisVersion }) => {
		const request = net.request(API_URL);
		request.on('response', (response) => {
			let body = '';
			response.on('data', (chunk) => {
				body += chunk;
			});
			response.on('end', async () => {
				if (response.statusCode !== 200) {
					console.error('Failed to check for app updates:', response.statusCode, body);
					return;
				}

				let release;
				try {
					release = JSON.parse(body);
				} catch (e) {
					console.error('Error parsing app update GitHub API response:', e);
				}
				const latestVersion = release.tag_name;
				if (typeof release.html_url !== 'string' || release.html_url.match(/^https?:\/\/.+/i) === null) {
					console.error('Invalid release URL in GitHub API response:', release.html_url);
					return;
				}

				if (isNewer(currentVersion, latestVersion)) {
					if (skippedVersion === latestVersion) {
						// User decided to skip this version
						return;
					}

					const { response: buttonIndex } = await dialog.showMessageBox({
						type: 'info',
						title: 'Update Available',
						message: `A new version of Tracky Mouse is available: ${latestVersion}\n\nYou are currently using version ${currentVersion}.`,
						buttons: ['Download', 'Remind me later', 'Skip this version'],
						defaultId: 0,
						cancelId: 1
					});

					if (buttonIndex === 0) {
						shell.openExternal(release.html_url);
					} else if (buttonIndex === 2) {
						pleaseSkipThisVersion(latestVersion);
					}
				}
			});
		});
		request.on('error', (error) => {
			console.error('Network error checking for app updates:', error);
		});
		request.end();
	}
};
