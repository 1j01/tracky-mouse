const initFacemesh = async () => {
	if (detector) {
		detector.dispose();
	}
	facemeshEstimating = false;
	facemeshFirstEstimation = true;
	facemeshLoaded = false;
	const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
	const detectorConfig = {
		runtime: 'mediapipe',
		solutionPath: `${TrackyMouse.dependenciesRoot}/lib/face_mesh`,
		refineLandmarks: true,
	};

	try {
		detector = await faceLandmarksDetection.createDetector(model, detectorConfig);
		if (lastShownErrorDetails?.errorClass === "faceLandmarksDetection.createDetector") {
			errorMessage.hidden = true;
		}
	} catch (error) {
		detector = null;
		console.error("Failed to create facemesh detector:", error);
		showError(t("faceDetectorInitError", { defaultValue: "Failed to create face detector" }), error, { errorClass: "faceLandmarksDetection.createDetector" });
	}

	facemeshLoaded = true;
	let loggedDetectorError = false;
	facemeshEstimateFaces = async () => {
		const imageData = currentCameraImageData;//getCameraImageData();
		if (!imageData) {
			return [];
		}
		try {
			const faces = await detector.estimateFaces(imageData, { flipHorizontal: false });
			if (!faces) {
				console.warn("faces ===", faces);
				return [];
			}
			return faces;
		} catch (error) {
			if (!loggedDetectorError) {
				console.error("Facemesh estimation failed:", error);
				loggedDetectorError = true;
			}
			try {
				detector?.dispose();
			} catch (disposeError) {
				console.error("Failed to dispose facemesh detector after estimation error:", disposeError);
			}
			detector = null;
			showError(t("faceDetectorError", { defaultValue: "Face detector error" }), error);
		}
		return [];
	};

};

if (useFacemesh) {
	initFacemesh();
}

