const fs = require("fs");
const path = require("path");
const glob = require("glob");

const logFile = fs.createWriteStream(path.join(__dirname, "forge-hook.log"));
logFile.write(`Hello from ${__filename}\n\n`);


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
module.exports = {
	packagerConfig: {
		icon: "./images/tracky-mouse-logo",
		name: "Tracky Mouse",
		executableName: "tracky-mouse",
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
	makers: [
		{
			name: "@electron-forge/maker-squirrel",
			config: {
				name: "tracky-mouse",
				exe: "tracky-mouse.exe",
				title: "Tracky Mouse",
				description: "Hands-free mouse control",
				iconUrl: "https://raw.githubusercontent.com/1j01/tracky-mouse/4f22321a3f65ecf66d0a9ed431a24a76d547ea4c/images/tracky-mouse-logo-512.png",
				setupIcon: "./images/tracky-mouse-logo.ico",
				// loadingGif: "images/install.gif",
			},
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
		}
	],
	publishers: [
		{
			name: '@electron-forge/publisher-github',
			config: {
				repository: {
					owner: '1j01',
					name: 'tracky-mouse'
				},
				prerelease: true,
				draft: true,
			}
		}
	],
	hooks: {
		packageAfterPrune: (config, buildPath, electronVersion, platform, arch) => {
			logFile.write("packageAfterPrune hook\n\n");
			if (platform === "win32") {
				logFile.write("packageAfterPrune hook: skipping linked module workaround, not needed on Windows\n\n");
				return;
			}
			logFile.write("packageAfterPrune hook: copying linked module to workaround broken link on macOS and Linux\n\n");
			return new Promise((resolve, reject) => {
				const fromFolder = path.dirname(require.resolve("tracky-mouse"));
				const toFolder = `${buildPath}/node_modules/tracky-mouse`;
				const fromGlob = `${fromFolder}/**`;
				logFile.write(`fromFolder: ${fromFolder}\n\n`);
				logFile.write(`toFolder: ${toFolder}\n\n`);
				logFile.write(`fromGlob: ${fromGlob}\n\n`);
				glob(fromGlob, {
					ignore: [
						".*/**",
						"**/node_modules/**",
						"**/private/**",
					]
				}, async (error, files) => {
					logFile.write("glob callback, files:\n" + JSON.stringify(files) + "\n\n");

					if (error) {
						logFile.write("Failed to copy files:\n" + error);
						reject(error);
						return;
					}
					for (const file of files) {
						const newFile = path.join(toFolder, path.relative(fromFolder, file));
						if (!fs.statSync(file).isDirectory()) {
							await fs.promises.mkdir(path.dirname(newFile), { recursive: true });
							logFile.write("Copy: " + file + "\n");
							logFile.write("To: " + newFile + "\n");
							await fs.promises.copyFile(file, newFile);
						} else {
							// logFile.write("Dir: " + file + "\n");
						}
					}
					resolve();
				});
			});
		}
	}
};
