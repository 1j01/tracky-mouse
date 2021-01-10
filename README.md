# Head Tracker

# Libraries Used

- [jsfeat](https://github.com/inspirit/jsfeat) for point tracking
	- [MIT License](https://github.com/inspirit/jsfeat/blob/master/LICENSE)
- [clmtrackr.js](https://github.com/auduno/clmtrackr) for fast and lightweight but inaccurate face tracking
	- [MIT License](https://github.com/auduno/clmtrackr/blob/dev/LICENSE.txt)
- [facemesh](https://github.com/tensorflow/tfjs-models/tree/master/facemesh#mediapipe-facemesh) and [TensorFlow.js](https://www.tensorflow.org/) for accurate face tracking (once this loads, it stops using clmtrackr.js)
	- [Apache License 2.0](https://github.com/tensorflow/tfjs-models/blob/master/LICENSE)
	- [Apache License 2.0](https://github.com/tensorflow/tensorflow/blob/master/LICENSE)

## TODO

- Project name? :)
- Pose invariance
	- Handle blinking at least
- Smoothing
	- Option
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
	- Disabling camera autofocus maybe
	- Lighting
		- Detect bad lighting conditions and report to the user
	- "Callibration" via simply moving your head to the edges of the screen (it's not like a gesture, it's just implicit in the fact that there are boundaries)
	- Settings (sensitivity)
- Use [YAPE](https://inspirit.github.io/jsfeat/sample_yape.html)? MAYBE?
	- fallback to random points or points based on face detection geometry if less than N points
	- Is this actually better than basing it on facial geometry?? It seems like using facial geometry is pretty reasonable
