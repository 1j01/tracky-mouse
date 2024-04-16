# ![](./images/tracky-mouse-logo-32.png) Tracky Mouse

> Control your computer by moving your head.

Tracky Mouse is a desktop application *and embeddable web UI* for head tracking and mouse control.
It includes a dwell clicker, and will be expanded with other clicking options in the future.

Tracky Mouse is intended to be a complete UI for head tracking, similar to [eViacam](https://github.com/cmauri/eviacam), but embeddable in web applications (such as [JS Paint, with its Eye Gaze Mode](https://jspaint.app/#eye-gaze-mode), which I might rename Hands-Free Mode or Facial Mouse Mode), as well as downloadable as an application to use to control your entire computer.

I'm also thinking about making a browser extension, which would 1. bridge between the desktop application and web applications, making it so you don't need to disable dwell clicking in the desktop app to use a web app that provides dwell clicking, 2. provide the equivalent of the desktop application for Chrome OS, and 3. automatically enhance webpages to be friendlier toward facial mouse input, by preventing menus from closing based on hover, enlarging elements etc., probably using site-specific enhancements.

So this would be a three-in-one project: desktop app, JavaScript library, and browser extension.
Sharing code between these different facets of the project means a lot of improvements can be made to three different products at once, and the library means that applications can have a fully functional facial mouse UI, and get people interested in head tracking because they can try it out right away.

Options could be exported/imported or even synced between the products.

[✨👉 **Try out the Demo!** 👈✨](https://trackymouse.js.org/)

## Why did I make this?

Someone emailed me asking about how they might adjust the UI of [JS Paint](https://jspaint.app/) to work with eye tracking (enlarging the color palette, hiding other UI elements, etc.)
and I decided to do them one better and build it as an official feature, with dwell clicking and everything.

To test the Eye Gaze Mode properly, I needed a facial mouse, but eye trackers are expensive, so I tried looking for head tracking software, and found eViacam, but... either it didn't work, or at some point it stopped working on my computer.

- eViacam wasn't working on my computer.
- There's not that much facial mouse software out there, especially cross-platform, and I think it's good to have options.
- I want people to be able to try JS Paint's Eye Gaze Mode out easily, and an embeddable facial mouse GUI would be great for that.
- Sometimes my joints hurt a lot and I'd like to relieve strain by switching to an alternative input method, such as head movement. Although I also have serious neck problems, so I don't know what I was thinking. Working on this project I have to use it very sparingly, using a demo video instead of camera input whenever possible for testing.

## Libraries Used

- [jsfeat](https://github.com/inspirit/jsfeat) for point tracking
	- [MIT License](https://github.com/inspirit/jsfeat/blob/master/LICENSE)
- [clmtrackr.js](https://github.com/auduno/clmtrackr) for fast and lightweight but inaccurate face tracking
	- [MIT License](https://github.com/auduno/clmtrackr/blob/dev/LICENSE.txt)
- [facemesh](https://github.com/tensorflow/tfjs-models/tree/master/facemesh#mediapipe-facemesh) and [TensorFlow.js](https://www.tensorflow.org/) for accurate face tracking (once this loads, it stops using clmtrackr.js)
	- [tfjs-models: Apache License 2.0](https://github.com/tensorflow/tfjs-models/blob/master/LICENSE)
	- [TensorFlow: Apache License 2.0](https://github.com/tensorflow/tensorflow/blob/master/LICENSE)

## Software Architecture

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

## License

MIT-licensed, see [LICENSE.txt](./LICENSE.txt)

## Development Setup

- [Clone the repo.](https://help.github.com/articles/cloning-a-repository/)
- Install [Node.js](https://nodejs.org/) if you don't have it
- Open up a command prompt / terminal in the project directory.
- Run `npm install`
- Run `npm run dev` to start a web server that will automatically reload when files change.
- For the electron app:
	- Then `cd desktop-app && npm install`

### VS Code

Launch configurations are provided to debug the web version in Chrome, and to debug the Electron main process.

## Install Desktop App

The app is not yet distributed as precompiled binaries.
If you want to try out the desktop app in the meantime:

- See Development Setup
- In folder `desktop-app`, run `npm start`

## Add to your project

Tracky Mouse is available on npm:
`npm i tracky-mouse`

Read the [API documentation](./API.md) for more information.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for project history and API changes.

