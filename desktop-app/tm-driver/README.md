# tm-driver

Written in Go, using [robotgo](https://github.com/go-vgo/robotgo), this subprocess provides mouse control for the Tracky Mouse desktop application.

Gamepad output is supported on Windows with [ViGEmBus](https://github.com/nefarius/ViGEmBus) and on Linux with [uinput](https://github.com/bendahl/uinput).
On Linux, the kernel's `uinput` device must be enabled and the user running Tracky Mouse must have permission to access `/dev/uinput`.

Previously Tracky Mouse used [serenade-driver](https://github.com/serenadeai/driver), a native Node.js module.

Compared to serenade-driver:
- No node-gyp! No compilation nightmares like C++ syntax errors showing up due to mismatched versions.
- This fixes an issue where mouse down+mouse up wouldn't properly click things (such as dropdowns) on macOS: [#102](https://github.com/1j01/tracky-mouse/issues/102)
- A separate process might avoid issues like [#69](https://github.com/1j01/tracky-mouse/issues/69) although that was already fixed before switching to tm-driver.
- A separate process could be elevated for Windows UI automation requirements... theoretically.
  - See docs for [Security Considerations for Assistive Technologies](https://learn.microsoft.com/windows/win32/winauto/uiauto-securityoverview), [Application Manifests](https://learn.microsoft.com/windows/win32/sbscs/application-manifests), which might be the same thing as [Assembly Manifests](https://learn.microsoft.com/windows/win32/sbscs/assembly-manifests), but is definitely different from the [App package manifest](https://learn.microsoft.com/uwp/schemas/appxpackage/appx-package-manifest) (.appxmanifest, which also includes [capability declarations](https://learn.microsoft.com/windows/apps/package-and-deploy/app-capability-declarations) for UI access, which I've already included), and [Authenticode digital signatures](https://learn.microsoft.com/windows-hardware/drivers/install/authenticode)
  - A key question is whether this requires coughing up cash to Microsoft for a code signing certificate. Allegedly I don't need to when uploading to the Microsoft Store. But so far I don't see anything that says this works with Microsoft's automatic signing when uploading to the Store.
    - Actually, apparently, [`uiAccess="true"` doesn't even work with MSIX](https://github.com/microsoft/WindowsAppSDK/issues/1669)
  - The main process maybe should be elevated too to be able to place the overlay window as "the topmost application in the z-order at any time", which maybe means this being a separate process isn't helpful to achieving full capability anyway.

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
- `setGamepadState` with normalized params `{ "x": number, "y": number }` in the range -1 to 1 (Windows and Linux)
- `setGamepadButton` with params `{ "button": "left" | "right" | "middle", "down": boolean }` (Windows and Linux)
- `ensureCursorVisibility` (Windows only)
- `getMouseLocation`
- `click` with params `{ "button": "left" | "right" | "middle" }`
- `mouseDown` with params `{ "button": "left" | "right" | "middle" }`
- `mouseUp` with params `{ "button": "left" | "right" | "middle" }`
- `ping`
