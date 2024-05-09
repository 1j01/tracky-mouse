const { app, Menu } = require('electron');

const isMac = process.platform === 'darwin';

const template = [
	// { role: 'appMenu' }
	...(isMac
		? [{
			label: app.name,
			submenu: [
				{ role: 'about' },
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
		label: 'File',
		submenu: [
			isMac ? { role: 'close' } : { role: 'quit' }
		]
	},
	// { role: 'editMenu' }
	{
		label: 'Edit',
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
						label: 'Speech',
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
		label: 'View',
		submenu: [
			{ role: 'reload' },
			{ role: 'forceReload' },
			{ role: 'toggleDevTools' },
			{
				label: 'Toggle Developer Tools (Screen Overlay)',
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
		label: 'Window',
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
				label: 'Home Page',
				click: async () => {
					const { shell } = require('electron');
					await shell.openExternal('https://trackymouse.js.org');
				},
			},
			{
				label: 'GitHub Repository',
				click: async () => {
					const { shell } = require('electron');
					await shell.openExternal('https://github.com/1j01/tracky-mouse');
				},
			},
			...(isMac
				? [] : [
					{
						// label: 'About Tracky Mouse',
						role: 'about',
					},
				]
			),
		],
	}
];

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);
