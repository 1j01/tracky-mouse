
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

		this.osc = this.ctx.createOscillator();
		this.osc.type = "sine";

		this.gain = this.ctx.createGain();
		this.gain.gain.value = 0;

		// Not sure how much this filter is actually doing
		this.filter = this.ctx.createBiquadFilter();
		this.filter.type = "lowpass";
		this.filter.frequency.value = 800;

		this.osc.connect(this.filter);
		this.filter.connect(this.gain);
		this.gain.connect(this.ctx.destination);

		this.osc.start();

		this.active = false;
		this.timeOfLastGestureTrigger = 0; // audio context time
		this.maxEffectDurationAfterGestureTrigger = 2.0; // seconds
	}

	update(gestureProgress) {
		const now = this.ctx.currentTime;

		const effectStartFraction = 0.5;

		if (gestureProgress < effectStartFraction) {
			if (this.timeOfLastGestureTrigger + this.maxEffectDurationAfterGestureTrigger < now) {
				this.gain.gain.setTargetAtTime(0, now, 0.05);
			}
			return;
		}

		const effectProgress = (gestureProgress - effectStartFraction) / (1 - effectStartFraction);

		const volume = effectProgress * effectProgress * 0.4;

		const baseFreq = 120;
		const freq = baseFreq + effectProgress * 120;

		this.gain.gain.setTargetAtTime(volume, now, 0.05);
		this.osc.frequency.setTargetAtTime(freq, now, 0.05);

		this.filter.frequency.setTargetAtTime(800 + effectProgress * 1200, now, 0.05);
	}

	sleepModeWasToggled(nowInSleepMode) {
		const now = this.ctx.currentTime;
		const currentFreq = this.osc.frequency.value;
		const targetFreq = currentFreq * (nowInSleepMode ? 0.5 : 2.0);

		this.osc.frequency.cancelScheduledValues(now);
		this.osc.frequency.setValueAtTime(currentFreq, now);
		this.osc.frequency.exponentialRampToValueAtTime(targetFreq, now + (nowInSleepMode ? 1 : 0.15));

		this.gain.gain.setTargetAtTime(0, now + 0.05, nowInSleepMode ? 0.4 : 0.1); // should be <= this.maxEffectDurationAfterGestureTrigger

		this.timeOfLastGestureTrigger = now;
	}
}