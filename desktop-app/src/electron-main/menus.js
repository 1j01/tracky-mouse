const { app, dialog, Menu } = require('electron');
const { readFile, writeFile, copyFile } = require('fs').promises;
const { join } = require('path');

/** translation placeholder */
const t = (s) => s;

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

const aboutItem = {
	label: t('About Tracky Mouse'),
	click: async () => {
		const openAboutWindow = require('about-window').default;
		openAboutWindow({
			icon_path: join(__dirname, '../../images/tracky-mouse-logo-512.png'),
			bug_report_url: 'https://github.com/1j01/tracky-mouse/issues',
			homepage: 'https://trackymouse.js.org',
			description: t('Control your computer with your webcam.'),
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
		label: t('File'),
		submenu: [
			{
				label: t('Export Settings'),
				click: async () => {
					const settingsPath = join(app.getPath('userData'), 'tracky-mouse-settings.json');
					const defaultPath = join(app.getPath('documents'), 'tracky-mouse-settings.json');
					const { filePath } = await dialog.showSaveDialog({
						title: t('Export Settings'),
						buttonLabel: t('Export'),
						defaultPath,
						filters: [{ name: t('JSON'), extensions: ['json'] }],
					});
					if (!filePath) return;
					await copyFile(settingsPath, filePath);
				},
			},
			{
				label: t('Import Settings'),
				click: async () => {
					const settingsPath = join(app.getPath('userData'), 'tracky-mouse-settings.json');
					const defaultPath = app.getPath('documents');
					const { canceled, filePaths } = await dialog.showOpenDialog({
						title: t('Import Settings'),
						buttonLabel: t('Import'),
						defaultPath,
						properties: ['openFile'],
						filters: [{ name: t('JSON'), extensions: ['json'] }],
					});
					if (canceled) return;
					const [filePath] = filePaths;
					const json = await readFile(filePath, 'utf8');
					// Backup settings
					try {
						const backupPath = settingsPath.replace(/\.json$/, `-backup-${new Date().toISOString().replace(/:/g, '')}.json`);
						console.log('Copying settings to backup path:', backupPath);
						await copyFile(settingsPath, backupPath);
					} catch (error) {
						if (error.code === 'ENOENT') {
							console.log('Never mind, no existing settings to backup.');
						} else {
							throw error;
						}
					}
					// Write settings
					console.log('Writing settings:', settingsPath);
					await writeFile(settingsPath, json);
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
		label: t('Edit'),
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
						label: t('Speech'),
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
		label: t('View'),
		submenu: [
			{ role: 'reload' },
			{ role: 'forceReload' },
			{ role: 'toggleDevTools' },
			{
				label: t('Toggle Developer Tools (Screen Overlay)'),
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
		label: t('Window'),
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
				label: t('Home Page'),
				click: async () => {
					const { shell } = require('electron');
					await shell.openExternal('https://trackymouse.js.org');
				},
			},
			{
				label: t('GitHub Repository'),
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
Menu.setApplicationMenu(menu);
