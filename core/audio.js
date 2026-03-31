
/** @type {AudioContext | null} */
let actx = null;

const audioPath = new URL("./audio", import.meta.url).href;
const audioFiles = {
	clickPress: `${audioPath}/click-press.wav`,
	clickRelease: `${audioPath}/click-release.wav`,
};
const audioBuffers = {};

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
	if (actx && actx.state === "running" && audioBuffers[soundId]) {
		const source = actx.createBufferSource();
		source.buffer = audioBuffers[soundId];
		source.connect(actx.destination);
		source.start(actx.currentTime + delay);
	}
}
