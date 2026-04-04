
/** @type {AudioContext | null} */
let actx = null;

const audioPath = new URL("./audio", import.meta.url).href;
const audioFiles = {
	clickPress: `${audioPath}/click-press.wav`,
	clickRelease: `${audioPath}/click-release.wav`,
};
const audioBuffers = {};

// Sound effects are disabled by default because the dwell clicker can be initialized without the UI,
// in which case there's no UI to disable the sound effects from.
// The actual default in the app is separate.
export let audioEnabled = false;

export function setAudioEnabled(enabled) {
	audioEnabled = enabled;
};

export function initAudio() {
	if (actx === null) {
		actx = new AudioContext();

		// "User gesture" requirements cripple this accessibility feature,
		// but we have to at least try to work around it.
		const unsuspend = (event) => {
			if (actx.state === "suspended") {
				console.log("Starting suspended audio context via", event.type);
				actx.resume();
			}
		};
		addEventListener("keydown", unsuspend);
		addEventListener("pointerdown", unsuspend);

		// Load audio files
		for (const [key, url] of Object.entries(audioFiles)) {
			fetch(url)
				.then((response) => response.arrayBuffer())
				.then((arrayBuffer) => actx.decodeAudioData(arrayBuffer))
				.then((audioBuffer) => {
					audioBuffers[key] = audioBuffer;
				})
				.catch((error) => {
					console.error("Error loading audio file:", url, error);
				});
		}
	}
}

export function playSound(soundId, { delay = 0 } = {}) {
	if (audioEnabled && actx && actx.state === "running" && audioBuffers[soundId]) {
		const source = actx.createBufferSource();
		source.buffer = audioBuffers[soundId];
		source.connect(actx.destination);
		source.start(actx.currentTime + delay);
	}
}
