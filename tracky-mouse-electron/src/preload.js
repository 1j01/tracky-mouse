const { moveMouse } = require('robotjs');
const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld("moveMouse", (...args) => moveMouse(...args));
