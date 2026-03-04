# Tracky Mouse's Native Component

Written in Go, using robotgo, this module provides mouse control for the Tracky Mouse desktop application as a separate helper process.

Compared to serenade-driver (native Node.js module):
- A separate process can be elevated for Windows UI automation requirements
- No node-gyp! No compilation nightmares like C++ syntax errors showing up due to mismatched versions.
- Hopefully we can fix a macOS issue where mouse down+mouse up doesn't properly click things: [#102](https://github.com/1j01/tracky-mouse/issues/102)

## Protocol

The process reads JSON objects, one per line, from stdin and writes JSON responses, one per line, to stdout.

Requests:

- `{ "id": 1, "cmd": "setMouseLocation", "x": 100, "y": 200 }`
- `{ "id": 2, "cmd": "getMouseLocation" }`
- `{ "id": 3, "cmd": "click", "button": "left" }`
- `{ "id": 4, "cmd": "mouseDown", "button": "left" }`
- `{ "id": 5, "cmd": "mouseUp", "button": "left" }`

Responses:

- `{ "id": 1, "ok": true }`
- `{ "id": 2, "ok": true, "x": 100, "y": 200 }`
- `{ "id": 3, "ok": false, "error": "description of error" }`

The desktop app uses the wrapper in `desktop-app/src/native-mouse.js` to talk to this process.
