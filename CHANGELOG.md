# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Renamed "Open mouth to click" mode to "Open mouth to click (with eye modifiers)"

### Added

- Added two simplified "Open mouth to click" modes ([issue #126](https://github.com/1j01/tracky-mouse/issues/126))
  - **Open mouth to click (simple)**: Left click by opening mouth. Closing both eyes still prevents clicks. Recommended mode to avoid accidental clicks.
  - **Open mouth to click (ignoring eyes)**: Left click by opening mouth. Eye state is fully ignored. This may be preferred if blink detection is not working correctly.

### Fixed
- Fixed sporadic error "o.Facemesh is not a constructor" on load ([issue #113](https://github.com/1j01/tracky-mouse/issues/113))
- Fixed silent failure when trying to import settings if settings haven't been modified (due to trying to back up a settings file that doesn't necessarily exist yet)
- It will now show a dialog if importing/exporting settings fails.
- Tracky Mouse will no longer get stuck "enabled" if it fails to access the camera. The Start/Stop button should always toggle when clicked.
- In case the camera device ID has changed or the camera is no longer plugged in, after selecting a specific camera for Video > Camera source,
  previously it showed an irrelevant error message ("Webcam does not support the required resolution. Please change your settings.")
  - It will now fall back to matching a camera by name in case the device ID has changed.
  - It will show a more appropriate error message if it still can't find the camera.
- In order to handle a case where permissions are revoked, after selecting a specific camera for Video > Camera source, in which case the browser gives a fake list of devices and requesting a real device ID will not work:
  - It will now first request camera access in general and then when granted (at which point it can see the real list of devices) it will request access to the configured device.
  - This may cause multiple permission prompts in a row unless you specify to allow all cameras in the first prompt.
- It will now show a slightly more general error message for `AbortError`, since this error can be received for reasons other than the camera being used by another program, and simply trying again can work in some cases.

## [2.3.0] - 2026-02-14

### Changed
- In "Open mouth to click" mode, it should no longer click if both your eyes are closed. ([issue #106](https://github.com/1j01/tracky-mouse/issues/106))
- In "Open mouth to click" mode, it will now show eye visuals as red (indicating it's part of an active gesture) even after an eye is reopened, if the eye is modifying a click. This makes it easier to see when you're doing a modified click, and to know which eye is modifying the click.

### Added
- Now available for Linux!
  - For most Linux distributions, you can download the `.AppImage` file, which should work without installation.
    - You may need to make it executable first by right-clicking the file, selecting "Properties", going to the "Permissions" tab, and checking "Allow this file to run as a program" or "Is executable" or similar (depending on your file manager). Then you can double-click it to run it. See [How to run an AppImage](https://discourse.appimage.org/t/how-to-run-an-appimage/80) for more details.
  - For Ubuntu, Mint, Kali, elementary OS, or Pop!_OS, the `.deb` package can also be used.
  - For Fedora, RHEL, or openSUSE, the `.rpm` package can also be used.
- For Windows, there is now an MSIX build.
  - It's an alternative to the setup `.exe` that gets blocked by "Windows SmartScreen" (DumbScreen).
  - To install: After downloading the `.msix` file, right click on it, select Properties, go to the Digital Signatures tab, select the embedded signature from the list, click Details, click View Certificate, and install the certificate. Then double click the `.msix` file. Then click "Restart as administrator" to restart the installer (you do not need to restart your computer, don't worry). Say Yes to allow App Installer to make changes to the device. Then click Install.
  - (Soon to be published to the Windows Store! Hopefully!)
- Added setting **General > Close eyes to start/stop**. With this enabled, you can toggle mouse control by holding both your eyes shut for a few seconds. ([issue #105](https://github.com/1j01/tracky-mouse/issues/105))
  - This lets you take breaks without needing to touch the mouse or keyboard. It's useful for watching videos, or just pausing to think without worrying about clicking on things accidentally. It's also great as a casual user for when you lean back away from the keyboard and mouse but then realize you want to interact with something. You can now do so while staying relaxed.
- Added setting **General > Check for updates**. This lets you disable automatic update checking on startup, which can be useful in case new versions become incompatible with your operating system version. ([issue #83](https://github.com/1j01/tracky-mouse/issues/83))
- If the desktop app is running from source code, it will now offer to update to a new version directly through Git instead of sending you to the download page.

### Fixed
- Fixed slider labels overlapping when the window is narrow (like on a phone). ([issue #112](https://github.com/1j01/tracky-mouse/issues/112))
- The settings can now be scrolled when they overflow the window. (part of [issue #78](https://github.com/1j01/tracky-mouse/issues/78))
- It now shows a friendlier error message when camera settings can't be shown, on platforms where ffmpeg doesn't support the `-list_devices` option.
- Documented `config.isHeld` in the dwell clicker API.

## [2.2.0] - 2026-01-22

### Changed

- There's a **new dependency** (optional but recommended). If you are using `loadDependencies()`, it will be included automatically. If you are including dependencies manually, you can add it with:
  ```html
  <script src="node_modules/tracky-mouse/lib/OneEuroFilter.js"></script>
  ```
  This adds a One Euro Filter to smooth out head tilt values, which can be very jittery otherwise.
- **Improved open mouth detection** by using mouth aspect ratio instead of a simple distance between two lip points. If you make a narrow "O" shape with your mouth, it will detect that more reliably. ([issue #97](https://github.com/1j01/tracky-mouse/issues/97))
- Tweaked layout of mouth and eye meters in cursor-attached HUD. Each meter is now anchored at its vertical center, and meters better avoid being occluded by the cursor or cut off.
- Settings UI:
  - Mirror setting is now grouped under "Video".
  - Renamed "Head Tracking" section to "Cursor Movement"
  - Point tracking settings are now grouped under "Point Tracking" subsection.
  - Tweaked settings UI spacing.
  - Controls are now disabled when inapplicable.
  - Added tooltips to settings. Hover over each setting to see a description. ([issue #79](https://github.com/1j01/tracky-mouse/issues/79))

### Added

- **Camera source** setting. You can now select your preferred camera from a dropdown.
- **Open Camera Settings** button in desktop app. This opens the system camera settings dialog for your selected camera, if available. (Probably only works on Windows.) ([issue #110](https://github.com/1j01/tracky-mouse/issues/110))
- **Direct head tilt based control**
  - **Tilt influence** slider. This lets you blend between using point tracking (existing behavior) and directly detected head tilt. ([issue #45](https://github.com/1j01/tracky-mouse/issues/45))
    - At 0% it will use only point tracking, as before. This moves the cursor according to visible movement of 2D points on your face within the camera's view, so it responds to both head rotation and translation.
    - At 100% it will use only head tilt. This uses Facemesh's estimate of your face's orientation in 3D space, and ignores head translation. Note that this is smoothed, so it's not as responsive as point tracking. In this mode you never need to recenter by pushing the cursor to the edge of the screen.
    - In between it will behave like an automatic calibration, subtly adjusting the point tracking to match the head tilt. This works by slowing down mouse movement that is moving away from the position that would be expected based on the head tilt, and (only past 80% on the slider) actively moving towards it. 
  - **Head tilt calibration settings.** You can adjust the horizontal and vertical tilt range and offset. This allows the head tilt feature to be used with different camera placements (above or below the screen) and postures, and lets you balance comfort+speed and precision. ([issue #103](https://github.com/1j01/tracky-mouse/issues/103))
    - Recommended: switch to 100% tilt influence while adjusting these settings, so you can see the effect directly.
- **Eye modifiers** in "Open mouth to click" mode.
  - With your left eye closed, open your mouth to right click.
  - With your right eye closed, open your mouth to middle click.
  - This makes it a three-button mouse! Universal computer control.
- Installer includes a new animated loading GIF. ([issue #86](https://github.com/1j01/tracky-mouse/issues/86))
- Added a new [Goodies](https://trackymouse.js.org/goodies) page to the website, with wallpaper downloads and text art.

### Fixed

- Fixed a crash on launch on macOS 10.14 with Xcode 10.3
- The yellow status text at the bottom of the screen now avoids the taskbar on Windows and the dock on macOS. ([issue #76](https://github.com/1j01/tracky-mouse/issues/76))
- The screen overlay will now adapt to screen resolution changes.

## [2.1.0] - 2026-01-14

### Changed


- **Improved blink detection** by using eye aspect ratio instead of a simple distance between two eyelid points.
- **Removed minimum time between clicks** for the "Wink to click" and "Open mouth to click" modes. You can now double click naturally, as long as you can keep the cursor still.
- **Stabilized blink and open mouth detection** by using a separate threshold for opening and closing. This means it won't rapidly oscillate between open and closed states when on the edge of open and closed.
- **Involuntary blinks** should now be ignored in most cases.
- "Wink to click" and "Open mouth to click" are no longer labeled as experimental.
- **Redesigned settings**: settings are now grouped into collapsible sections.
- Tons of cleanup of the codebase, and development process improvements.

### Added

- **You can now click and drag** with the "Wink to click" and "Open mouth to click" modes.
- **Motion threshold** slider, similar to the setting in [eViacam](https://eviacam.crea-si.com/). This helps keep the mouse still when you stop moving your head, at the cost of precision.
- **Delay before dragging** slider, which prevents moving the mouse during a click. This makes it easier to perform single and double clicks in clicking modes that allow dragging. You might want to set it to zero if you're going to be drawing on a canvas, or crank it up if you don't need to drag anything.
- Blink detection includes a visualization in the camera view. It may make it look like you're wearing glasses. 😎
- Open mouth detection includes a visualization in the camera view. This is drawn as two lines for now.
- **Cursor HUD**: Visual feedback is now shown near the mouse cursor for blink detection and open mouth detection, so you can be confident when it's clicking, even if what you're clicking on doesn't respond with any visual feedback.
- **Update checking**: The app will now automatically check for updates on startup. You'll still have to download the new installer yourself for now.

### Fixed

![manual takeback indicator](https://raw.githubusercontent.com/1j01/tracky-mouse/main/images/manual-takeback.svg)

- Manual takeback indicator (hand on mouse with arrows) now shows regardless of clicking mode.
- Status text at bottom of screen now correctly reflects enabled/disabled state regardless of clicking mode.
- Removed visual offsetting of facemesh dots overlay by the previous movement from the point tracking, which should no longer provide any smoothing benefit since the facemesh pipeline has been updated in the last release and now runs within one frame.

## [2.0.0] - 2026-01-07

### Changed

- Tracky Mouse once again requires `unsafe-eval` in the Content Security Policy in Chrome, due to usage of WebAssembly. See [this Chromium issue](https://issues.chromium.org/issues/41457889).
- New dependencies must be included as script tags if not using `loadDependencies()`:
  ```html
  <script src="node_modules/tracky-mouse/lib/face_mesh/face_mesh.js"></script>
  <script src="node_modules/tracky-mouse/lib/face-landmarks-detection.min.js"></script>
  ```
- Updated facemesh pipeline, improving performance significantly, and opening the door to implementing blink detection.
  - A web worker is no longer used for facemesh, however one is still used for clmtrackr.
- stats.js performance monitor, if enabled, now scrolls with the page, using `fixed` positioning instead of `absolute`.
- A friendly "webcam may already be in use" message is now shown also for `AbortError` in Firefox.

### Added
- You can now disable dwell clicking in the desktop app without disabling mouse movement, by setting "Clicking mode" to "Off". ([issue #63](https://github.com/1j01/tracky-mouse/issues/63))
- A first version of blink detection for clicking is now available in the desktop app (under the "Clicking mode" setting).
  - This needs refinement to avoid false positives (likely including a threshold setting). Expect undesired clicks for now.
  - You can't click and drag with this method yet, only perform single clicks.
  - I found there to be significant latency in my testing.
- A first version of open mouth detection for clicking is now available in the desktop app (under the "Clicking mode" setting).
  - It takes some skill to open your mouth without moving the cursor.
  - You can't click and drag with this method yet, only perform single clicks.
  - I found there to be significant latency in my testing.
- [Sentry](https://sentry.io/) is now used for error reporting in the desktop app.
  - No personally identifiable information is collected, only stack traces and environment details.
  - (Only the main process is monitored for now, due to the technical hurdles of sandboxing.)

### Fixed
- The dwell clicking indicator (shrinking red circle) should no longer show while disabled.
- The desktop app now takes into account the screen scale factor (including changes at runtime) when positioning the mouse, so it should reach the edges of the screen correctly on high-DPI displays. ([issue #64](https://github.com/1j01/tracky-mouse/issues/64))
  - Tested only on Windows. Hopefully this is also a fix for macOS and Linux, but it COULD have the opposite effect. I am currently unable to test on those platforms due to hardware and software issues.

## [1.2.0] - 2024-12-17

### Deprecated
- `TrackyMouse.cleanupDwellClicking()` is deprecated in favor of calling `dispose()` on the object returned by `TrackyMouse.initDwellClicking()`.

### Changed
- The Tracky Mouse UI no longer includes a stats.js performance monitor by default. You can still enable it by passing `{statsJs: true}` to `TrackyMouse.init()` and, if needed, also to `TrackyMouse.loadDependencies()`.

### Added
- `TrackyMouse.init()` now returns an object with a `dispose()` method, which you can call to stop head tracking and remove the UI.
- The object returned by `TrackyMouse.initDwellClicking()` now has a `dispose()` method as well, which you can use instead of `TrackyMouse.cleanupDwellClicking()`.

### Fixed
- `TrackyMouse.cleanupDwellClicking()` now handles multiple dwell clickers, not that I know of any use case for that.

## [1.1.0] - 2024-10-20

### Added
- Start/stop button. This toggles head tracking, and, in the desktop app, dwell clicking as well. In the web library, dwell clicking is set up separately, and is not currently controlled by this button (or the keyboard shortcut F9).
- Desktop app now supports dwell clicking. This means you can use Tracky Mouse with lots of software not designed with head tracking in mind. I just played a game of Mahjongg, and it worked well.
- Settings are now persisted, both in the desktop app and in the browser.
- Desktop app includes menu items for exporting and importing settings.
- Desktop app now remembers the window size and position.
- Desktop app lets you regain manual control by simply moving the mouse, pausing temporarily, and resuming when you stop moving the mouse.
- Friendly error handling for different camera access failure scenarios.
- Command line interface to control the desktop app, supporting `--start` and `--stop` to toggle head tracking.
- API documentation.
- Website at [TrackyMouse.js.org](https://trackymouse.js.org/).
- Parameter validation.
- `tracky-mouse.js` includes a CommonJS export, untested. I'm only testing script tag usage. I hope to switch to ES modules soon.
- `beforeDispatch()`/`afterDispatch()` callbacks for detecting untrusted gestures, outside of an event where you could use `event.isTrusted`.
- `beforePointerDownDispatch()`/`afterReleaseDrag()` callbacks for JS Paint to replace accessing global `pointers` array.
- `initDwellClicking` returns an object `{paused}` which lets you pause and resume dwell clicking.

### Fixed
- Function `average_points` was missing. It existed in JS Paint, the only place I had tested the library, since I was extracting the code from JS Paint.
- Similarly, styles for the dwell click indicator and hover halo were missing or not applying. (Since they were provided by CSS in JS Paint, I didn't notice, in my rushed testing.)
- The JS assumed the existence of a global `pointer_active` from JS Paint. This has been replaced with `config.isHeld()`.
- Missing `facemesh.worker.js` file.
- "Mirror" checkbox was too easy to accidentally click due to a large `<label>` (which acts as a hit region).

### Changed
- The software now starts disabled (by default), to avoid clicking on things before you're ready. This is especially important for the desktop app. The installer on Windows actually installs and launches the app without any interaction, so it would be *very surprising* if it started clicking right away.
- The webcam view now shrinks to fit the window.
- Sliders now have labels for their min and max values, and are widened to make it easier to click precisely.
- Controls are themed purple.
- All CSS classes are now prefixed with `tracky-mouse-`.
- `shouldDrag`, `noCenter`, `retarget`, `isEquivalentTarget`, and `dwellClickEvenIfPaused` are now optional for `initDwellClicking`.
- You must include a new script `no-eval.js` if you are including Tracky Mouse's dependencies manually. If you are using `loadDependencies()`, it is included automatically.
- Tracky Mouse no longer requires `unsafe-eval` in the Content Security Policy! This is great, because now I can feel better about usage in Electron, both for the Tracky Mouse desktop app and for JS Paint.
- Globals used by the Electron app (`moveMouse`, `onShortcut`, etc.) are now namespaced under `window.electronAPI`. For `moveMouse`, use `TrackyMouse.onPointerMove` instead.
- Will no longer set global `pointers` to an empty array before dispatching `pointerdown` or after releasing a drag. Replaced with `config.beforePointerDownDispatch()` and `config.afterReleaseDrag()`

## [1.0.0] - 2021-05-20
### Added
- Head tracking based on [Clmtrackr](https://github.com/auduno/clmtrackr), [Facemesh](https://github.com/tensorflow/tfjs-models/tree/master/facemesh#mediapipe-facemesh), and [jsfeat](https://github.com/inspirit/jsfeat).
- Dwell clicker API generalized and extracted from [JS Paint](https://github.com/1j01/jspaint).
- [Electron](https://electronjs.org/) app for desktop (not yet packaged for distribution).


[Unreleased]: https://github.com/1j01/tracky-mouse/compare/v2.3.0...HEAD
[2.3.0]: https://github.com/1j01/tracky-mouse/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/1j01/tracky-mouse/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/1j01/tracky-mouse/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/1j01/tracky-mouse/compare/v1.2.0...v2.0.0
[1.2.0]: https://github.com/1j01/tracky-mouse/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/1j01/tracky-mouse/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/1j01/tracky-mouse/releases/tag/v1.0.0
