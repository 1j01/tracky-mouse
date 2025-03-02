// import express from 'express';
// import { createServer } from 'http';
// import WebSocket from 'ws';

// const __dirname = import.meta.dirname;
const express = require('express');
const { createServer } = require('http');
const WebSocket = require('ws');

// Start a websocket server to receive mouse position data from the laser pointer app.
const server = createServer();
const wss = new WebSocket.Server({ server });
const app = express();
let onPointerMove = null;

app.use(express.static('public'));

app.get('/', (req, res) => {
	res.sendFile(__dirname + '/index.html');
});

wss.on('connection', (ws) => {
	ws.on('message', (message) => {
		const { x, y } = JSON.parse(message);
		if (onPointerMove) {
			onPointerMove(x, y);
		}
	});
});

server.listen(8080, () => {
	console.log('WebSocket server started on port 8080');
});

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
	onChangeDwellClicking: (callback) => ipcRenderer.on('change-dwell-clicking', callback),
	// Note terrible naming inconsistency.
	onMouseMove: (callback) => { onPointerMove = callback },

	// This is pretty weird but I'm giving the overlay window control over clicking,
	// whereas the app window has control over moving the mouse.
	// The app window has the head tracker, which moves the mouse,
	// and the overlay window handles the dwell clicking (rendering, and, in this case, clicking).
	// It's quite the hacky architecture.
	// A more sane architecture might have the overlay window, which can't receive any input directly,
	// as purely a visual output, rather than containing business logic for handling clicks.
	// But this let me reuse my existing code for dwell clicking, without tearing it apart.

	mouseClick: (x, y) => ipcRenderer.send('click', x, y, performance.now()),
});
