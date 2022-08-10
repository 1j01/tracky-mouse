# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Desktop app now supports dwell clicking. This means you can use Tracky Mouse with lots of software not designed with head tracking in mind. I just played a game of Mahjongg, and it worked well.
- Desktop app now remembers the window size and position.
- Desktop app lets you regain manual control by simply moving the mouse, pausing temporarily, and resuming.
- Friendly error handling for different camera access failure scenarios.
- API documentation.
- Parameter validation.
- `tracky-mouse.js` includes a CommonJS export, untested. I'm only testing script tag usage. I hope to switch to ES modules soon.
- `beforeDispatch()`/`afterDispatch()` callbacks for detecting untrusted gestures, outside of an event where you could use `event.isTrusted`.
- `initDwellClicking` returns an object `{paused}` which lets you pause and resume dwell clicking.

### Fixed
- Function `average_points` was missing. It existed in JS Paint, the only place I tested the library, since I was extracting the code from JS Paint.
- Similarly, styles for the dwell click indicator and hover halo were missing or not applying. (Since they were provided by CSS in JS Paint, I didn't notice, in my rushed testing.)
- And the JS referenced a global `pointer_active` from JS Paint. Now it checks if that exists first. Eventually this should be replaced with some less "nepotistic" API, so to speak.
- Missing `facemesh.worker.js` file.
- "Mirror" checkbox was too easy to accidentally click due to a large `<label>` (which acts as a hit region).

### Changed
- The webcam view now shrinks to fit the window.
- Sliders now have labels for their min and max values.
- Controls are themed purple.
- All CSS classes are now prefixed with `tracky-mouse-`.
- `shouldDrag`, `noCenter`, `retarget`, `isEquivalentTarget`, and `dwellClickEvenIfPaused` are now optional for `initDwellClicking`.
- You must include a new script `no-eval.js` if you are including Tracky Mouse's dependencies manually. If you are using `loadDependencies()`, it is included automatically.
- Tracky Mouse no longer requires `unsafe-eval` in the Content Security Policy! This is great, because now I can feel better about the Electron app.

## [1.0.0] - 2021-05-20
### Added
- Head tracking based on [Clmtrackr](https://github.com/auduno/clmtrackr), [Facemesh](https://github.com/tensorflow/tfjs-models/tree/master/facemesh#mediapipe-facemesh), and [jsfeat](https://github.com/inspirit/jsfeat).
- Dwell clicker API generalized and extracted from [JS Paint](https://github.com/1j01/jspaint).
- [Electron](https://electronjs.org/) app for desktop.


[Unreleased]: https://github.com/1j01/tracky-mouse/compare/v1.0.0...HEAD
<!-- [1.1.0]: https://github.com/1j01/tracky-mouse/compare/v1.0.0...v1.1.0 -->
[1.0.0]: https://github.com/1j01/tracky-mouse/releases/tag/v1.0.0
