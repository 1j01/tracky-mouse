
/** @type {AudioContext | null} */
let actx = null;
/** @type {SleepSweep | null} */
export let sleepSweep = null;

const audioPath = new URL("./audio", import.meta.url).href;
const audioFiles = {
	clickPress: `${audioPath}/click-press.wav`,
	clickRelease: `${audioPath}/click-release.wav`,
	middleClickPress: `${audioPath}/middle-click-press.wav`,
	middleClickRelease: `${audioPath}/middle-click-release.wav`,
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

		// Set up other effect(s)
		sleepSweep = new SleepSweep(actx);
	}
}

export function playSound(soundId, { delay = 0, playbackRate = 1, volume = 1 } = {}) {
	if (audioEnabled && actx && actx.state === "running" && audioBuffers[soundId]) {
		const gain = actx.createGain();
		const source = actx.createBufferSource();
		source.buffer = audioBuffers[soundId];
		source.connect(gain).connect(actx.destination);
		gain.gain.value = volume;
		source.playbackRate.value = playbackRate;
		source.start(actx.currentTime + delay);
	}
}
class SleepSweep {
	constructor(actx) {
		this.ctx = actx;

		// Main oscillator (engine hum)
		this.osc = this.ctx.createOscillator();
		this.osc.type = "sawtooth";

		// Gain for volume control
		this.gain = this.ctx.createGain();
		this.gain.gain.value = 0;

		// Slight filtering to soften harshness
		this.filter = this.ctx.createBiquadFilter();
		this.filter.type = "lowpass";
		this.filter.frequency.value = 800;

		this.osc.connect(this.filter);
		this.filter.connect(this.gain);
		this.gain.connect(this.ctx.destination);

		this.osc.start();

		this.active = false;
	}

	// progress: 0 → 1 over the 2 seconds
	update(progress) {
		const now = this.ctx.currentTime;

		// Don’t start immediately — wait until halfway
		const startPoint = 0.5;

		if (progress < startPoint) {
			this.gain.gain.setTargetAtTime(0, now, 0.05);
			return;
		}

		const t = (progress - startPoint) / (1 - startPoint);

		// Volume curve (gentle ramp)
		const volume = t * t * 0.4;

		// Pitch sweep (friendly hum rising)
		const baseFreq = 120;
		const freq = baseFreq + t * 120;

		this.gain.gain.setTargetAtTime(volume, now, 0.05);
		this.osc.frequency.setTargetAtTime(freq, now, 0.05);

		// Slightly open filter as it ramps
		this.filter.frequency.setTargetAtTime(800 + t * 1200, now, 0.05);
	}

	// timerWasReset() {
	// 	const now = this.ctx.currentTime;

	// 	// Smoothly fade out and reset tone
	// 	this.gain.gain.setTargetAtTime(0, now, 0.05);
	// 	this.osc.frequency.setTargetAtTime(120, now, 0.05);
	// 	this.filter.frequency.setTargetAtTime(800, now, 0.05);
	// }

	sleepModeWasToggled(nowInSleepMode) {
		const now = this.ctx.currentTime;

		// Quick chirp: up when enabling, down when disabling
		const currentFreq = this.osc.frequency.value;

		const targetFreq = nowInSleepMode
			? currentFreq * 2.2   // rising chirp
			: currentFreq * 0.5;  // falling chirp

		this.osc.frequency.cancelScheduledValues(now);
		this.osc.frequency.setValueAtTime(currentFreq, now);
		this.osc.frequency.exponentialRampToValueAtTime(targetFreq, now + 0.15);

		// Fade out quickly after chirp
		this.gain.gain.setTargetAtTime(0, now + 0.05, 0.1);
	}
}