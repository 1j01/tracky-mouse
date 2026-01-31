# ![](./images/tracky-mouse-logo-32.png) Tracky Mouse

> Control your computer by moving your head.

Tracky Mouse is a desktop application providing **hands-free universal computer access**.

It's also embeddable in web applications as a JavaScript library. See the [API docs](./core/README.md).

Features include:
- [x] Move your head to move the mouse pointer.
- [x] Dwell to click.
- [x] Blink to click mode (desktop app only).
- [x] Open mouth to click mode (desktop app only). This provides **three-button mouse** functionality using closed eyes as modifiers.
- [x] The screen overlay provides visual feedback for dwell clicking and facial gestures at your cursor.
- [x] Settings for sensitivity, acceleration, running at login, and more.
- [x] Moving the mouse manually (with a physical mouse or touchpad) automatically pauses control.

By building it as a desktop app *and* an embeddable web UI, users can try it out right away in their browser, and then install the desktop app for full computer control.
<!-- Building Tracky Mouse as a desktop app *and* an embeddable web UI means you can try it out right away in their browser, and then install the desktop app for full computer control. -->

<!--
Users will even be able to share settings between the embedded web UI and desktop app.
I also have plans for a browser extension https://github.com/1j01/tracky-mouse/issues/27
making this a three-in-one project: desktop app, JavaScript library, and browser extension.
Settings could be shared between all three products (with import/export, which is already implemented in the desktop app, and possibly cloud syncing, but also just through familiarity with the settings UI).
-->

[✨👉 **Try out the Demo!** 👈✨](https://trackymouse.js.org/)

## Install Desktop App

<!-- Note: the Linux versions do not actually exist for 2.2.0; but these will be replaced automatically with the next release. -->

- [⬇️ Download for Windows](https://github.com/1j01/tracky-mouse/releases/download/v2.2.0/Tracky.Mouse-2.2.0.Setup.exe) and run the installer.
- [⬇️ Download for Linux (.deb)](https://github.com/1j01/tracky-mouse/releases/download/v2.2.0/tracky-mouse_2.2.0_amd64.deb)
- [⬇️ Download for Linux (.rpm)](https://github.com/1j01/tracky-mouse/releases/download/v2.2.0/tracky-mouse-2.2.0-1.x86_64.rpm)

Pre-built binaries are not yet available for macOS, due to a couple issues: [camera permissions](https://github.com/1j01/tracky-mouse/issues/119), and [the more powerful clicking modes not clicking properly](https://github.com/1j01/tracky-mouse/issues/102).
You *can* still run the app on macOS. See [Development Setup](#development-setup).

## Usage Guide

These instructions apply to using the desktop app or the web UI.

### Set up your camera and environment:
- Make sure to have **good lighting** on your face. Placing a lamp beside your monitor can help a lot!
- Back-lighting can be problematic, especially if your head moves in and out from occluding the light during use, but also due to glare.
- Your webcam should be centered in front of your head, with your head fully visible when sitting comfortably.

### Start using Tracky Mouse:
- Press the "Start" button to start moving the mouse and clicking. You can also use the keyboard shortcut <kbd>F9</kbd>. When using the desktop app, this shortcut works even when the app is not in focus.
- Dwell in one spot to click. To avoid clicking, you have to keep moving your head, or pause the app with <kbd>F9</kbd>.
- (Desktop app only) Try changing **Clicking mode** to **Wink to click** or **Open mouth to click** in the settings. 
  - With **Wink to click**:
    - Close your right eye to left click
    - Close your left eye to right click.
    - If this feels backwards, you can enable "Swap mouse buttons"
  - With **Open mouth to click**:
    - Close your right eye and open your mouth to middle click
    - Close your left eye and open your mouth to right click
    - Open your mouth with both eyes open to left click.

### General usage tips:
- Adjust the settings until you can comfortably move the mouse to the edges of the screen with some accuracy.
- Advice for point tracking mode:
  - If the mouse cursor feels off-center, you can recalibrate by simply moving your head past where the cursor meets the edge of the screen.
  - Note that not only rotating your head, but translating your head (moving it left/right, up/down, or forward/backward) moves the mouse.
    - One nuance to this is, if the camera is positioned above your head, leaning forward generally moves the pointer down, whereas if the camera is below your head, leaning forward generally moves the pointer up.
- Using the **Tilt influence** slider: This setting lets you blend between using 2D point tracking and 3D head tilt.
  - At 0% it will use only point tracking. This moves the cursor according to visible movement of 2D points on your face, so it responds to both head rotation and translation. It's very accurate and responsive, but can get out of sync with your head orientation over time, requiring you to recenter by pushing the cursor to the edge of the screen.
    - Recommended: high acceleration
  - At 100% it will use only head tilt. This uses an estimate of your face's rotation in 3D space, and ignores head translation. Note that this signal is smoothed (as it's very jittery otherwise), so it's not as responsive as point tracking. In this mode you never need to recenter by pushing the cursor to the edge of the screen, but you do need to calibrate it in the **Head tilt calibration settings** section first.
    - Acceleration does not apply, as movement is absolute based on head tilt.
  - In between it will behave like an automatic calibration, subtly adjusting the point tracking to match the head tilt. This works by slowing down mouse movement that is moving away from the position targeted based on the head tilt, and (only past 80% on the slider) actively moving towards it. 
    - Recommended: medium point tracking acceleration; point tracking sensitivity should roughly match head tilt sensitivity.
- **Head tilt calibration settings:** You can adjust the horizontal and vertical tilt range and offset. This allows the head tilt feature to be used with different camera placements (above or below the screen) and postures, and lets you balance comfort+speed and precision.

### Troubleshooting:
- If you have multiple cameras, make sure to select the correct one under **Video > Camera source**.
- If the camera feed appears black:
  - Make sure there is no privacy/dust cover on the camera.
  - Ensure there's enough light.
  - Check the camera in another application to make sure it's working.
  - Resuming from sleep/hibernate can also cause this (see [issue #77](https://github.com/1j01/tracky-mouse/issues/77)). Try restarting the app.
- If the camera can't be accessed at all, make sure it's not being used by another application, then click "Allow Camera Access" in the app. Also try unplugging the camera and plugging it in again (if it's an external camera), or restarting your computer.
  - On Linux: Installing (and maybe running?) `guvcview` can magically fix a webcam not showing up. ([source](https://forums.linuxmint.com/viewtopic.php?t=131011))
  - On Windows 11, it's possible to allow multiple apps to access the camera at once.
    - Go to **Settings > Bluetooth & devices > Camera**, select your camera, and in **Advanced camera options**, enable **Allow multiple apps to use camera at the same time**. (You'll need to stop any apps currently using the camera first.)
- Auto-focus and auto-brightness can cause head tracking disruptions. Consider disabling auto-focus on your camera, and adjusting focus manually. If you disable auto-brightness, you will have to adjust the brightness regularly as the lighting changes, at least assuming you have any natural light in the room.
  - Advanced camera settings can be accessed with **Video > Open Camera Settings** in the desktop app on Windows.

### Integrating with external software
Tracky Mouse comes with a command-line interface (CLI) which can be used to control the desktop app with a voice command system or other external programs. See [CLI documentation](./CLI.md) for usage.


## Add to your project

Tracky Mouse is available on npm:
```sh
npm install tracky-mouse
```

Read the [API documentation](./core/README.md) for more information.

## License

MIT-licensed, see [LICENSE.txt](./LICENSE.txt)

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for project history and API changes.

## Why did I make this?

Someone emailed me asking about how they might adjust the UI of [JS Paint](https://jspaint.app/) to work with eye tracking (enlarging the color palette, hiding other UI elements, etc.)
and I decided to do them one better and build it as an official feature, with dwell clicking and everything.

To test these accessibility features properly, I needed a facial mouse, but eye trackers are expensive, so I tried looking for head tracking software, and found eViacam, but... either it didn't work, or at some point it stopped working on my computer.

- eViacam wasn't working on my computer.
- I didn't find there to be very many facial mouse software options out there, especially cross-platform, and I want people to have options.
- I wanted people to be able to try JS Paint's dwell clicking out easily, and an embeddable facial mouse GUI would be great for that.
- I've had some joint pain issues in the past (although also neck pain, which is a bit ironic)
- I think I can push forward the state of the art in facial mouse software.

## Software Architecture

This is a monorepo containing packages for the library (`core`), the desktop app (`desktop-app`), and the website (`website`).


I tried npm workspaces, but it doesn't work with Electron Forge packaging. See [electron/forge#2306](https://github.com/electron/forge/issues/2306).

### Core

The core library uses the following third-party libraries:

- [jsfeat](https://github.com/inspirit/jsfeat) for point tracking (using Lucas–Kanade optical flow)
	- [MIT License](https://github.com/inspirit/jsfeat/blob/master/LICENSE)
- [clmtrackr.js](https://github.com/auduno/clmtrackr) for fast and lightweight but inaccurate face tracking
	- [MIT License](https://github.com/auduno/clmtrackr/blob/dev/LICENSE.txt)
- [facemesh](https://www.npmjs.com/package/@tensorflow-models/face-landmarks-detection) and [TensorFlow.js](https://www.tensorflow.org/) for accurate face tracking (once this loads, it stops using clmtrackr.js)
	- [tfjs-models: Apache License 2.0](https://github.com/tensorflow/tfjs-models/blob/master/LICENSE)
	- [TensorFlow: Apache License 2.0](https://github.com/tensorflow/tensorflow/blob/master/LICENSE)

Some dependencies are versioned with npm and copied into `core/lib/` with `npm run in-core -- npm run copy-deps`

Others are just stored in `core/lib/` without npm versioning.

#### No eval

To avoid the need for `unsafe-eval` in the Content Security Policy, I had to eliminate the use of `eval` (and `Function` construction) in `clmtrackr.js`.

The file [no-eval.js](./core/lib/no-eval.js) overrides `eval` with a function that handles the specific cases of `eval` usage in `clmtrackr.js`.
I made a tool to generate this file by running `clmtrackr.js` while instrumenting `eval` to collect the code it tries to evaluate.
This tool is located in [eval-is-evil.html](./website/eval-is-evil.html).

Unfortunately, when upgrading the facemesh library, I had to add back the `unsafe-eval` requirement, as it uses WebAssembly.

WebAssembly is not the same as `eval`, but browsers grouped them together under the same CSP directive.
Even if browsers widely support the more fine-grained `wasm-unsafe-eval`, old browsers would still be blocked from using the library if `unsafe-eval` is not included in the CSP.

### Website

The website uses symlinks to reference the library (`core`) and shared resources (`images`) during development.

When deploying with `npm run in-website -- npm run deploy`, it will prompt when there are any new files not that are not defined as included or excluded in [website/globs-for-deploy.js](./website/globs-for-deploy.js).

It will then be deployed to GitHub Pages using the [`gh-pages`](https://www.npmjs.com/package/gh-pages) npm package.

Deploys can be rolled back by force-pushing to the `gh-pages` branch.


### Desktop App

The desktop application's architecture is kind of *amusing*...

I will explain. First, some groundwork. Electron apps are multi-process programs. They have a main process, which creates browser windows, and renderer processes, which render the content of the browser windows.

In this app, there are two renderer processes, one for the main application window, and one for a screen overlay window.

The overlay window is transparent, always-on-top, and intangible. It's used to preview dwell clicks with a shrinking circle.

Now we get to the good stuff...

In a "sane" architecture, the overlay window, which can't receive any input directly, would be purely a visual output. The state would be kept in either the main process or the main renderer process, and it would only send messages to the overlay to draw the circle.

But I already had code for the dwell clicker, you see. I want it to behave similarly between the library and the desktop app, so I want the same timing logic and circle drawing to work in both.

Keeping the state in a separate process from where the circle is rendered would mean tearing apart and rewriting my code for the dwell clicker.

So instead I simply embed the dwell clicker into the screen overlay window, business logic and all.
It was already going to be an entire webpage just to render the circle, since this is Electron.
It was never going to be efficient.

So I ended up with an architecture where the **application window controls mouse movement**, and the **screen overlay window controls mouse clicking**, which I think is *pretty epic*. 😎

It genuinely was a good way to reuse the code for the dwell clicker.

Oh also I made a big, screen-sized, **invisible button**, so that the dwell clicker thinks there's something to click on. Pretty silly, but also pretty simple. 🆒

![](./images/software-architecture.svg)

**Not pictured:** the renderer processes each have preload scripts which are more privileged code than the rest of the renderer's code. Access to system functionality passes through the preload scripts.

The architecture for normal usage of the library is much simpler.

Ooh, but the diagram for the desktop app interacting with web pages (including pages using the library) through the browser extension would be interesting. That's all theoretical for now though.

P.S. There is a script to list IPC events: `node scripts/list-ipc-events.js`

Also, I do plan to reign in this madness, see [issue #72](https://github.com/1j01/tracky-mouse/issues/72)

## Development Setup

- Before cloning on Windows, make sure you have `git config --global core.symlinks true` set, or you may have issues with symbolic links.
- [Clone the repo.](https://help.github.com/articles/cloning-a-repository/)
- Install [Node.js](https://nodejs.org/) if you don't have it
  - Recommended: install via [nvm](https://github.com/nvm-sh/nvm) or [nvm-windows](https://github.com/coreybutler/nvm-windows)
  - The supported Node.js version is specified in [`.nvmrc`](./.nvmrc)
- Open up a command prompt / terminal in the project directory.
- Run `npm install` to install project-wide dependencies.

> [!NOTE]
> There's also `npm run install-all` as a shortcut to install dependencies for all packages.

For the website:
- Run `npm run in-website -- npm install` to install the website's dependencies. (`--` allows passing arguments to the script, which is just a simple wrapper to run a command within the directory of the package.)
- Run `npm run website` to start a web server that will automatically reload when files change.

For the desktop app:
- For Linux, install XTest library needed for sending mouse input:
  - On Ubuntu: `sudo apt-get install libxtst-dev`
  - On Fedora: `sudo yum install libXtst-devel`
  - On RHEL6.2: `sudo yum install libXi-devel`
- For macOS:
  - macOS 10.14 (Mojave) is the supported version
  - You apparently need a full Xcode installation, not just the command line tools, for the native module to compile.
  - Tested with Xcode 10.3. Old versions of Xcode can be downloaded from [xcodereleases.com](https://xcodereleases.com/)
- Run `npm run in-desktop-app -- npm install` to install dependencies.
- Run `npm run desktop-app` to start the app.
- To test the CLI, run `npx tracky-mouse --help`.
  - Alternatively, run `npm link` to make `tracky-mouse` available globally, but note that it may conflict with the installed app.
  - Those options skip Electron Forge currently. To test the CLI through Electron Forge, run `npm run desktop-app -- -- -- --help` (Yes it's a lot of dashes. It's going through npm, then npm within a subfolder, and then Electron Forge. Each tool has its own `--help` flag, but supports `--` to pass on any following arguments as-is.)
- Run `npm run in-desktop-app -- npm run make` to build the app for distribution. Look in the `desktop-app/out/` directory for build artifacts.

For the core library:
- Dependencies are stored in `core/lib/`; you don't need to run `npm run in-core -- npm install` unless you plan to modify the library's dependencies and run `npm run in-core -- npm run copy-deps` to copy them into `core/lib/`.

### Debugging

VS Code launch configurations are provided to debug the web version in Chrome, and to debug the Electron main process.

For the screen overlay window, you can use **View > Toggle Developer Tools (Screen Overlay)** from the main window's menu bar.

## Quality Assurance

- Run `npm run lint` to check for spelling and code issues.
- There are no tests yet.

## Release Process

This section outlines the steps for releasing a new version of Tracky Mouse.


In [CHANGELOG.md](CHANGELOG.md), first make sure all important changes are noted in the Unreleased section, by looking over the commit history.  

The following command takes care of linting, and bumping version numbers for each package and in the changelog. It also creates a git commit and tag for the new version, and pushes the tag to GitHub, triggering the GitHub Actions workflow to create a release draft.
```sh
npm run release -- $VERSION
```

Download and install from the GitHub release draft, and test the installed desktop app.

> [!WARNING]
> "Point of no return" (spooky)

Final steps:
```sh
# Push to main
git push
# Deploy the website
# (this may be done at any time, but it's important to update the homepage download link)
# (technically this should be the last step since the new download link will only work once the release draft is published...)
npm run in-website -- npm run deploy
```

Publish the GitHub release. This should trigger a GitHub Actions workflow which publishes the core package to npm.

