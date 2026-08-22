
// Wrapper that manages an inner instance and recreates it when the language is changed.
TrackyMouse.init = function (div, opts = {}) {
	let inner = null;

	// UI state saving could be cleaner as part of the inner instance idk
	// Or, you know, ideally we update the UI text reactively without
	// stopping/starting the camera stream etc. when switching languages.
	const saveUIState = () => {
		const paused = inner._getPaused();
		const collapsibles = inner._element.querySelectorAll("details");
		const openStates = Array.from(collapsibles).map(c => c.open);
		const scrollables = inner._element.querySelectorAll("*");
		const scrollPositions = Array.from(scrollables).map(s => [s.scrollLeft, s.scrollTop]);
		const focusedElementSelector = Array.from(document.activeElement?.classList || []).map(c => `.${c}`).join("");
		return { paused, openStates, scrollPositions, focusedElementSelector };
	};
	const restoreUIState = ({ paused, openStates, scrollPositions, focusedElementSelector }) => {
		inner._waitForSettingsLoaded().then(() => {
			inner._setPaused(paused);
		});
		// assuming DOM structure doesn't change
		const collapsibles = inner._element.querySelectorAll("details");
		for (let i = 0; i < collapsibles.length; i++) {
			collapsibles[i].open = openStates[i];
		}
		const scrollables = inner._element.querySelectorAll("*");
		for (let i = 0; i < scrollables.length; i++) {
			const [scrollLeft, scrollTop] = scrollPositions[i];
			scrollables[i].scrollLeft = scrollLeft;
			scrollables[i].scrollTop = scrollTop;
		}
		if (focusedElementSelector) {
			const elementToFocus = inner._element.querySelector(focusedElementSelector);
			elementToFocus?.focus();
		}
	};
	const reinit = () => {
		const uiState = saveUIState();
		inner.dispose();
		createInner();
		restoreUIState(uiState);
	};

	const createInner = () => {
		inner = TrackyMouse._initInner(div, opts, reinit);
	};

	createInner();

	return new Proxy({}, {
		get(_target, prop) {
			if (prop in inner) {
				return inner[prop];
			}
		}
	});

};