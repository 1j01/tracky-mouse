const { dialog, shell, net } = require('electron');

const REPO = '1j01/tracky-mouse';

function parseVersion(versionString) {
	// Remove 'v' prefix
	versionString = versionString.replace(/^v/, '');
	// Remove anything after a hyphen (prerelease info), or handle it if you want.
	// For now, let's assume standard semantic versioning x.y.z
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
	checkForUpdates: ({ currentVersion, skippedVersion }) => {
		return new Promise((resolve, reject) => {
			const request = net.request(`https://api.github.com/repos/${REPO}/releases/latest`);
			request.on('response', (response) => {
				let body = '';
				response.on('data', (chunk) => {
					body += chunk;
				});
				response.on('end', async () => {
					if (response.statusCode !== 200) {
						// console.error('Failed to check for updates:', response.statusCode, body);
						resolve(null); // Silent fail
						return;
					}

					try {
						const release = JSON.parse(body);
						const latestVersion = release.tag_name;

						if (isNewer(currentVersion, latestVersion)) {
							if (skippedVersion === latestVersion) {
								resolve(null); // User decided to skip this version
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
								resolve({ action: 'download' });
							} else if (buttonIndex === 2) {
								resolve({ action: 'skip', version: latestVersion });
							} else {
								resolve({ action: 'remind' });
							}
						} else {
							resolve(null);
						}
					} catch (e) {
						console.error('Error parsing update response:', e);
						resolve(null);
					}
				});
			});
			request.on('error', (error) => {
				// console.error('Error checking for updates:', error);
				// Silent fail for network errors
				resolve(null);
			});
			request.end();
		});
	}
};
