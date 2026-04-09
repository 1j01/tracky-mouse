# Tracky Mouse's Native Component

Written in Go, using robotgo, this module provides mouse control for the Tracky Mouse desktop application as a separate helper process.

Compared to serenade-driver (native Node.js module):
- A separate process can be elevated for Windows UI automation requirements
- No node-gyp! No compilation nightmares like C++ syntax errors showing up due to mismatched versions.
- Hopefully we can fix a macOS issue where mouse down+mouse up doesn't properly click things: [#102](https://github.com/1j01/tracky-mouse/issues/102)
- Hopefully we can fix a Windows issue where clicking on the non-client area can freeze the main process: [#69](https://github.com/1j01/tracky-mouse/issues/69)

## Build

The desktop app builds this process automatically before `start`, `package`, `make`, and `publish`.

To build it manually:

```bash
npm run in-desktop-app -- npm run build-tm-driver
```

The output binary is written to `desktop-app/tm-driver/bin/`.

## Daemon Protocol

`tm-driver` now runs as a daemon process and listens on TCP `127.0.0.1:47047` by default.
The desktop app connects to this daemon; it no longer starts `tm-driver` directly.

Set `TM_DRIVER_ADDR` to change the listen address (for example `127.0.0.1:48000`).

The protocol is JSON-RPC-like over newline-delimited JSON (one JSON object per line).

For compatibility and local testing, `tm-driver --stdio` runs the previous stdin/stdout mode.

Supported methods:
- `setMouseLocation` with params `{ "x": number, "y": number }`
- `getMouseLocation`
- `click` with params `{ "button": "left" | "right" | "middle" }`
- `mouseDown` with params `{ "button": "left" | "right" | "middle" }`
- `mouseUp` with params `{ "button": "left" | "right" | "middle" }`
