# Head Tracker

# Libraries Used

- [jsfeat](https://github.com/inspirit/jsfeat) for point tracking
	- [MIT License](https://github.com/inspirit/jsfeat/blob/master/LICENSE)
- [clmtrackr.js](https://github.com/auduno/clmtrackr) for fast and lightweight but inaccurate face tracking
	- [MIT License](https://github.com/auduno/clmtrackr/blob/dev/LICENSE.txt)
- [facemesh](https://github.com/tensorflow/tfjs-models/tree/master/facemesh#mediapipe-facemesh) and [TensorFlow.js](https://www.tensorflow.org/) for accurate face tracking (once this loads, it stops using clmtrackr.js)
	- [Apache License 2.0](https://github.com/tensorflow/tfjs-models/blob/master/LICENSE)
	- [Apache License 2.0](https://github.com/tensorflow/tensorflow/blob/master/LICENSE)

## License

MIT-licensed, see [LICENSE.txt](./LICENSE.txt)

## TODO

- Project name? :)
- Get latency compensation for Worker results fully working
	- No lag
		- dedupe grayscale() computation...
	- Adding AND removing points
- Pose invariance (smiling etc.)
	- Simplest might be to just use the bridge of your nose
		- Points can disappear due to pruning, but we could use other points as a fallback, but just use a nose point as long as it exists?
- Acceleration (option)
- Minimum distance to start moving pointer (option)
- De-duplicate points that end up on top of each other, as they don't improve tracking (bad redudancy), and they weight the average weirdly, which might harm accuracy.
- Handle occluders explicitly by looking for differing optical flow? (most often a hand, e.g. brushing hair out of eyes)
- Robust error handling
- Test differing video aspect ratios
- Coach user on:
	- Granting camera access
	- Troubleshooting camera access
		- Another application may be using it
		- Try unplugging and plugging it back in
		- Make sure you can use your camera with another application (but close this application before trying to get it to work in here again)
		- Correct camera
			- [`enumerateDevices`](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/enumerateDevices)
	- Disabling camera autofocus maybe
	- Positioning the camera and yourself
		- Above or below the screen is fine but you should be centered so the pointer doesn't move left/right too much when you want it to go up or down
			- In particular, you should be in line with the camera, such that your face appears head-on when looking comfortably at the center of the screen
				- A guide could show your head rotation
				- Callibration for an off-center camera should be possible (or explicitly using your head rotation instead of a projected position)
		- If the camera is above, leaning forward generally moves the pointer down
		- If the camera is below, leaning forward generally moves the pointer up
	- Tilting your head or moving your head both move the pointer
	- Lighting
		- Detect bad lighting conditions and report to the user
	- "Callibration" via simply moving your head to the edges of the screen (it's not like a gesture, it's just implicit in the fact that there are boundaries)
	- Choosing settings (sensitivity etc.)
		- If you move yourself or your camera, you may want to adjust the sensitivity.
		- If you're further away from the camera, you'll want a higher sensitivity.
			- Would it make sense to scale this to your head size in the camera? Maybe not with the innacurate face tracker, but with the face tracker... but you probably wouldn't want it to switch setting scaling schemes suddenly
			- It could detect if your head size significantly changes (and is stable for a period of time) from what it has been (stably for a period of time), and alert you, suggesting changing the setting, maybe even suggesting a value
- Use [YAPE](https://inspirit.github.io/jsfeat/sample_yape.html)? MAYBE?
	- fallback to random points or points based on face detection geometry if less than N points
	- Is this actually better than basing it on facial geometry?? It seems like using facial geometry is pretty reasonable
- Integrate with dwell clicking functionality in jspaint
- Dwell click time / area, beep on click options, etc.
- Sparkly effect of some kind instead of just green dots?
