
function deserializeSettings(settings, initialLoad = false) {
	// TODO: DRY with deserializeSettings in electron-main.js
	for (const category of settingsCategories) {
		traverseSettings(category.settings, (setting) => {
			setting._load?.(settings, initialLoad);
		});
	}
	setAudioEnabled(s.soundEffects);

	// Now that all settings are loaded, update disabled states
	updateDisabledStates();

	// Unstable hook
	handleSettingsUpdate?.(settings);
}
const formatVersion = 1;
const formatName = "tracky-mouse-settings";
function serializeSettings() {
	// TODO: DRY with serializeSettings in electron-main.js
	// The important part is done (don't need to list every setting here - or there),
	// but we could still switch to using IPC for saving/loading serialized settings
	// eliminating the duplicate format handling, which may become more complex over time.
	// The main process will still want to know about _some_ settings, and this shouldn't go through the serialization,
	// but that can remain using the existing IPC calls while we add new ones dealing with serialized settings.
	// (So I guess this is really a todo for the electron app; maybe this sort of detailed comment would make more sense there.)
	return {
		formatVersion,
		formatName,
		globalSettings: s,
		// profiles: [],
	};
};
const setOptions = (options) => {
	if (window.electronAPI) {
		window.electronAPI.setOptions(options);
	} else {
		try {
			localStorage.setItem("tracky-mouse-settings", JSON.stringify(serializeSettings(), null, "\t"));
		} catch (e) {
			console.error(e);
		}
	}
	// Unstable hook
	handleSettingsUpdate?.(options);
};
const loadOptions = async (initialLoad = false) => {
	// Desktop app: start from any saved settings in the main process,
	// then, on first load, push the renderer's canonical defaults back
	// so the main process has the same effective settings (and can
	// correctly drive features like dwell clicking on first run).
	// Web demo: similarly needs canonical defaults pushed to
	// correctly enable dwell clicking on first run,
	// now that it supports multiple clicking modes.
	// General API usage: does not yet support multiple clicking modes
	// (there's a lot of glue code in the demo)
	// but we only call handleSettingsUpdate if it exists.
	let stored;
	if (window.electronAPI) {
		stored = await window.electronAPI.getOptions();
	} else {
		try {
			if (localStorage.getItem("tracky-mouse-settings")) {
				stored = JSON.parse(localStorage.getItem("tracky-mouse-settings"));
			}
		} catch (e) {
			console.error(e);
			return;
		}
	}
	if (stored) {
		deserializeSettings(stored, initialLoad);
	} else {
		// HACK: ensure handleInitialLoad is called even for first run
		// Combined with the below, this feels very redundant, and I'd like to
		// move to a subscription-based pattern, more of a formal "settings store", something like that.
		// This is currently necessary for sound effects to work on the first run of the web demo.
		deserializeSettings(serializeSettings(), initialLoad);
	}
	if (initialLoad && (!stored || !stored.globalSettings || Object.keys(stored.globalSettings).length === 0)) {
		// We could just call setOptions in both cases,
		// but do we want to save to localStorage initially? Maybe not.
		if (window.electronAPI) {
			setOptions(serializeSettings()); // (includes handleSettingsUpdate)
		} else {
			handleSettingsUpdate?.(serializeSettings());
		}
	}
};
