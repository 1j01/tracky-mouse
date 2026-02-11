const os = require('os');

/** For maker-deb, this has to match name from package.json of the desktop app */
const executableName = os.platform() === "linux" ? "tracky-mouse-electron" : "tracky-mouse";

const sharedDebRpmOptions = {
	name: "tracky-mouse",
	productName: "Tracky Mouse",
	productDescription: "Hands-free mouse control",
	genericName: "Facial Mouse",
	homepage: "https://trackymouse.js.org/",
	icon: "images/tracky-mouse-logo-512.png",
	categories: [
		"Utility",
	],
	mimeType: [
		// Affects whether the app shows as a recommended app in the "Open With" menu/dialog.
		// Not sure if this would be useful for a config file format, or only standard file formats.
		// "application/x-tracky-mouse",
	],
};

/** @type {import('@electron-forge/shared-types').ForgeConfig} */
module.exports = {
	packagerConfig: {
		icon: "./images/tracky-mouse-logo",
		name: "Tracky Mouse",
		executableName,
		appBundleId: "io.isaiahodhner.tracky-mouse",
		appCategoryType: "public.app-category.utilities",
		appCopyright: "© 2024 Isaiah Odhner",
		junk: true,
		// TODO: assess filtering of files; check node_modules to make sure prune is working
		ignore: [
			".history", // VS Code "Local History" extension
			// TODO: organize image files so I can ignore most of them
			// Maybe add a custom lint script to check that no images are being used by the app
			// that won't be packaged, and that all images are being used
		],
		// TODO: maybe
		// https://electron.github.io/packager/main/interfaces/Options.html#darwinDarkModeSupport
	},
	hooks: {
		packageAfterPrune: async (_forgeConfig, buildPath) => {
			// Fix broken symlinks in the packaged app.
			// This is needed due to https://github.com/electron/forge/issues/3238

			const sourceAppRoot = __dirname;
			const log = (...args) => {
				console.log("[fix-broken-symlinks]", ...args);
			};

			log("🔧 Fixing broken symlinks in packaged app...");

			const { unlink } = require('fs').promises;
			const { dirname, join } = require('path');
			const { execSync } = require('child_process');
			const modulesToCopy = ['tracky-mouse'];
			for (const moduleName of modulesToCopy) {
				const sourcePath = dirname(require.resolve(join(moduleName, 'package.json')));
				const destPath = join(buildPath, 'node_modules', moduleName);
				log(`Deleting presumed broken symlink: ${destPath}`);
				await unlink(destPath);
				log(`Packing module: ${moduleName}`);
				const tarballName = execSync(`npm pack ${sourcePath}`, { cwd: sourceAppRoot }).toString().trim();
				const tarballPath = join(sourceAppRoot, tarballName);
				log(`Created tarball: ${tarballPath}`);
				log(`Installing tarball into ${buildPath}`);
				execSync(`npm install --no-save ${tarballPath} --prefix ${buildPath}`);
				log(`Removing tarball: ${tarballPath}`);
				await unlink(tarballPath);
			}
		},
	},
	makers: [
		{
			name: "@electron-forge/maker-squirrel",
			config: {
				name: "tracky-mouse",
				exe: `${executableName}.exe`,
				title: "Tracky Mouse",
				description: "Hands-free mouse control",
				iconUrl: "https://raw.githubusercontent.com/1j01/tracky-mouse/4f22321a3f65ecf66d0a9ed431a24a76d547ea4c/images/tracky-mouse-logo-512.png",
				setupIcon: "./images/tracky-mouse-logo.ico",
				loadingGif: "./images/tracky-mouse-logo-thick-360-spin.gif",
			},
		},
		{
			name: '@electron-forge/maker-msix',
			config: {
				appManifest: './Package.appxmanifest',
				logLevel: 'debug',
			}
		},
		{
			name: "@electron-forge/maker-zip",
			platforms: [
				"darwin",  // macOS uses a .zip, which may be automatically extracted when opened
			],
		},
		{
			name: "@electron-forge/maker-deb",
			config: {
				options: {
					...sharedDebRpmOptions,
					section: "utils",
					maintainer: "Isaiah Odhner <isaiahodhner@gmail.com>",
				},
			},
		},
		{
			name: "@electron-forge/maker-rpm",
			config: {
				options: {
					...sharedDebRpmOptions,
					license: "MIT",
				},
			},
		},
		{
			name: "@reforged/maker-appimage",
			config: {
				options: {
					// No productDescription field?
					// There is an option to a desktopFile...
					bin: executableName,
					name: "tracky-mouse",
					productName: "Tracky Mouse",
					genericName: "Facial Mouse",
					homepage: "https://trackymouse.js.org/",
					icon: "images/tracky-mouse-logo-512.png",
					categories: [
						"Utility",
						"Accessibility",
					],
					keywords: [
						"camera mouse",
						"mouse",
						"camera",
						"webcam",
						"head tracker",
						"head tracking",
						"facial recognition",
						"face tracker",
						"face tracking",
						"headmouse",
						"facial mouse",
						"facemesh",
						"eye tracker",
						"eye tracking",
						"eye gaze",
						"accessibility",
						"assistive-technology",
						"cursor",
						"pointer",
						"pointing",
						"input method",
						"hands-free",
						"handsfree",
						"desktop automation",
						"telekinesis",
					],
				}
			}
		},
	],
	publishers: [
		{
			name: '@electron-forge/publisher-github',
			config: {
				repository: {
					owner: '1j01',
					name: 'tracky-mouse'
				},
				prerelease: false,
				draft: true,
			}
		}
	],
};
