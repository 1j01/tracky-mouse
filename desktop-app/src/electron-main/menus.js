const { app, dialog, Menu } = require('electron');
const { readFile, writeFile, copyFile } = require('fs').promises;
const { join } = require('path');

const { t } = require('./i18n');

const isMac = process.platform === 'darwin';

// let loadSettings;
// module.exports = (dependencies) => {
// 	loadSettings = dependencies.loadSettings;
// };

// The `about-window` module doesn't support custom version string.
// Also it doesn't give a lot of room for the string, since it's expecting a simple format.
// Should probably just use a custom about window.
const originalAppGetVersion = app.getVersion;
const isCalledFromModule = (moduleName) => new Error().stack.includes(require.resolve(moduleName));
app.getVersion = () =>
	isCalledFromModule("about-window") ?
		require('./version').getVersion().replace(/development/, 'dev') :
		originalAppGetVersion();

function createMenu() {
	const aboutItem = {
		label: t('desktop.menu.help.aboutTrackyMouse', { defaultValue: 'About Tracky Mouse' }),
		click: async () => {
			const openAboutWindow = require('about-window').default;
			openAboutWindow({
				icon_path: join(__dirname, '../../images/tracky-mouse-logo-512.png'),
				bug_report_url: 'https://github.com/1j01/tracky-mouse/issues',
				homepage: 'https://trackymouse.js.org',
				description: t('desktop.menu.help.aboutDescription', { defaultValue: 'Control your computer with your webcam.' }),
				license: 'MIT',
			});
		},
	};
	// Open about window automatically for development
	// (Normally I would use a localStorage flag for this, but localStorage isn't available in the main process.)
	// setTimeout(aboutItem.click, 1000);

	const template = [
		// { role: 'appMenu' }
		...(isMac
			? [{
				label: app.name,
				submenu: [
					aboutItem,
					{ type: 'separator' },
					{ role: 'services' },
					{ type: 'separator' },
					{ role: 'hide' },
					{ role: 'hideOthers' },
					{ role: 'unhide' },
					{ type: 'separator' },
					{ role: 'quit' }
				]
			}]
			: []),
		// { role: 'fileMenu' }
		{
			label: t('desktop.menu.file.label', { defaultValue: 'File' }),
			submenu: [
				{
					label: t('desktop.menu.file.exportSettings.label', { defaultValue: 'Export Settings' }),
					click: async () => {
						const settingsPath = join(app.getPath('userData'), 'tracky-mouse-settings.json');
						const defaultPath = join(app.getPath('documents'), 'tracky-mouse-settings.json');
						const { filePath } = await dialog.showSaveDialog({
							title: t('desktop.menu.file.exportSettings.label', { defaultValue: 'Export Settings' }),
							buttonLabel: t('desktop.settings.export.buttonLabel', { defaultValue: 'Export' }),
							defaultPath,
							filters: [{ name: t('desktop.common.jsonFileType', { defaultValue: 'JSON' }), extensions: ['json'] }],
						});
						if (!filePath) return;
						try {
							await copyFile(settingsPath, filePath);
						} catch (error) {
							await dialog.showErrorBox(
								t('desktop.menu.file.exportSettings.label', { defaultValue: 'Export Settings' }),
								t('desktop.settings.export.errors.exportFailed', { defaultValue: 'Failed to export settings.' }) + '\n\n' + error.message,
							);
						}
					},
				},
				{
					label: t('desktop.menu.file.importSettings.label', { defaultValue: 'Import Settings' }),
					click: async () => {
						const settingsPath = join(app.getPath('userData'), 'tracky-mouse-settings.json');
						const defaultPath = app.getPath('documents');
						const { canceled, filePaths } = await dialog.showOpenDialog({
							title: t('desktop.menu.file.importSettings.label', { defaultValue: 'Import Settings' }),
							buttonLabel: t('desktop.settings.import.buttonLabel', { defaultValue: 'Import' }),
							defaultPath,
							properties: ['openFile'],
							filters: [{ name: t('desktop.common.jsonFileType', { defaultValue: 'JSON' }), extensions: ['json'] }],
						});
						if (canceled) return;
						const [filePath] = filePaths;
						let json;
						try {
							json = await readFile(filePath, 'utf8');
						} catch (error) {
							await dialog.showErrorBox(
								t('desktop.menu.file.importSettings.label', { defaultValue: 'Import Settings' }),
								t('desktop.settings.import.errors.readSelectedFile', { defaultValue: 'Failed to read selected file.' }) + '\n\n' + error.message,
							);
							return;
						}
						// Backup settings
						try {
							const backupPath = settingsPath.replace(/\.json$/, `-backup-${new Date().toISOString().replace(/:/g, '')}.json`);
							console.log('Copying settings to backup path:', backupPath);
							await copyFile(settingsPath, backupPath);
						} catch (error) {
							if (error.code === 'ENOENT') {
								console.log('Never mind, no existing settings to backup.');
							} else {
								await dialog.showErrorBox(
									t('desktop.menu.file.importSettings.label', { defaultValue: 'Import Settings' }),
									t('desktop.settings.import.errors.backupBeforeImport', { defaultValue: 'Failed to backup current settings before import.' }) + '\n\n' + error.message,
								);
								return;
							}
						}
						// Write settings
						console.log('Writing settings:', settingsPath);
						try {
							await writeFile(settingsPath, json);
						} catch (error) {
							await dialog.showErrorBox(
								t('desktop.menu.file.importSettings.label', { defaultValue: 'Import Settings' }),
								t('desktop.settings.import.errors.importFailed', { defaultValue: 'Failed to import settings.' }) + '\n\n' + error.message,
							);
							return;
						}
						// Reload settings
						// loadSettings(); // doesn't actually reload the settings in the app window
						app.relaunch(); // overkill! TODO: apply the settings without restarting the app
						app.quit(); // required for the app to actually restart
					},
				},
				{ type: 'separator' },
				isMac ? { role: 'close' } : { role: 'quit' }
			]
		},
		// { role: 'editMenu' }
		{
			label: t('desktop.menu.edit.label', { defaultValue: 'Edit' }),
			submenu: [
				{ role: 'undo' },
				{ role: 'redo' },
				{ type: 'separator' },
				{ role: 'cut' },
				{ role: 'copy' },
				{ role: 'paste' },
				...(isMac
					? [
						{ role: 'pasteAndMatchStyle' },
						{ role: 'delete' },
						{ role: 'selectAll' },
						{ type: 'separator' },
						{
								label: t('desktop.menu.edit.speech.label', { defaultValue: 'Speech' }),
							submenu: [
								{ role: 'startSpeaking' },
								{ role: 'stopSpeaking' }
							]
						}
					]
					: [
						{ role: 'delete' },
						{ type: 'separator' },
						{ role: 'selectAll' }
					])
			]
		},
		// { role: 'viewMenu' }
		{
			label: t('desktop.menu.view.label', { defaultValue: 'View' }),
			submenu: [
				{ role: 'reload' },
				{ role: 'forceReload' },
				{ role: 'toggleDevTools' },
				{
						label: t('desktop.menu.view.toggleOverlayDevTools', { defaultValue: 'Toggle Developer Tools (Screen Overlay)' }),
					click: async () => {
						const { BrowserWindow } = require('electron');
						// XXX: localization hazard: relying on the untranslated window title
						const screenOverlayWindow = BrowserWindow.getAllWindows().find(window => window.getTitle() === 'Tracky Mouse Screen Overlay');
						if (screenOverlayWindow.webContents.isDevToolsOpened()) {
							screenOverlayWindow.webContents.closeDevTools();
						} else {
							screenOverlayWindow.webContents.openDevTools({ mode: 'detach' });
						}
					},
				},
				{ type: 'separator' },
				{ role: 'resetZoom' },
				{ role: 'zoomIn' },
				{ role: 'zoomOut' },
				{ type: 'separator' },
				{ role: 'togglefullscreen' }
			]
		},
		// { role: 'windowMenu' }
		{
			label: t('desktop.menu.window.label', { defaultValue: 'Window' }),
			submenu: [
				{ role: 'minimize' },
				{ role: 'zoom' },
				...(isMac
					? [
						{ type: 'separator' },
						{ role: 'front' },
						{ type: 'separator' },
						{ role: 'window' }
					]
					: [
						{ role: 'close' }
					])
			]
		},
		{
			role: 'help',
			submenu: [
				{
					label: t('desktop.menu.help.homePage', { defaultValue: 'Home Page' }),
					click: async () => {
						const { shell } = require('electron');
						await shell.openExternal('https://trackymouse.js.org');
					},
				},
				{
					label: t('desktop.menu.help.githubRepository', { defaultValue: 'GitHub Repository' }),
					click: async () => {
						const { shell } = require('electron');
						await shell.openExternal('https://github.com/1j01/tracky-mouse');
					},
				},
				...(isMac
					? [] : [
						aboutItem,
					]
				),
			],
		}
	];
	const menu = Menu.buildFromTemplate(template);
	return menu;
};

function updateMenu() {
	const menu = createMenu();
	Menu.setApplicationMenu(menu);
}

module.exports = { updateMenu };
