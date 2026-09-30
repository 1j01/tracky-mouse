# tm-driver

Written in Go, using [robotgo](https://github.com/go-vgo/robotgo), this subprocess provides mouse control for the Tracky Mouse desktop application.

Previously Tracky Mouse used [serenade-driver](https://github.com/serenadeai/driver), a native Node.js module.

Compared to serenade-driver:
- A separate process can be elevated for Windows UI automation requirements.
- No node-gyp! No compilation nightmares like C++ syntax errors showing up due to mismatched versions.
- This fixes an issue where mouse down+mouse up wouldn't properly click things (such as dropdowns) on macOS: [#102](https://github.com/1j01/tracky-mouse/issues/102)
- A separate process might avoid issues like [#69](https://github.com/1j01/tracky-mouse/issues/69) although that was already fixed before switching to tm-driver.

## Build

The desktop app builds this Go binary automatically before `start`, `package`, `make`, and `publish`.

To build it manually:

```bash
npm run in-desktop-app -- npm run build-tm-driver
```

The output binary is written to `desktop-app/tm-driver/bin/`.

## Process Protocol

This helper process reads JSON-based requests from stdin (one JSON object per line)
and writes one JSON response per line to stdout.

Supported methods:
- `setMouseLocation` with params `{ "x": number, "y": number }`
- `moveMouseRelative` with params `{ "x": number, "y": number }`
- `ensureCursorVisibility` (Windows only)
- `getMouseLocation`
- `click` with params `{ "button": "left" | "right" | "middle" }`
- `mouseDown` with params `{ "button": "left" | "right" | "middle" }`
- `mouseUp` with params `{ "button": "left" | "right" | "middle" }`
