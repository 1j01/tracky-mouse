
import { createDeferred } from "./helpers.js";
import { traverseSettings } from "./settings.js";

// TODO: clean up signature which is currently "whatever dependencies were needed to extract this code to a new file"
export function initSettingsUI({
	settingsCategories,
	uiContainer,
	t,
	s,
	getSetOptionsFunction,
}) {
	const elsByGroup = new Map();
	const functionsToUpdateDisabledStates = [];

	function buildSettingsUI(parentEl, settingsCategories) {

		for (const category of settingsCategories) {
			const detailsEl = buildSettingGroupUI(category);
			const bodyEl = detailsEl.querySelector(".tracky-mouse-details-body");
			traverseSettings(category.settings, (setting, parentGroup) => {
				const parentGroupElement = (elsByGroup.get(parentGroup) ?? bodyEl);

				let el;
				if (setting.type === "group") {
					el = buildSettingGroupUI(setting);
				} else {
					el = buildSettingItemUI(setting);
				}
				parentGroupElement.appendChild(el);

				if (setting.disabled) {
					const updateDisabledState = () => {
						// TODO: supply a message for why it's disabled (can update `disabled()` to return a string or object)
						const disabled = setting.disabled?.() ?? setting.disabled === true;
						el.classList.toggle("tracky-mouse-disabled", disabled);
						const controls = el.querySelectorAll(`input, select, button`);
						for (const control of controls) {
							if (control.matches(".tracky-mouse-setting-reset-button")) {
								continue;
							}
							// This should handle nested disabled conditions properly
							control.disabled = control.closest(".tracky-mouse-disabled") !== null;
						}
					};
					functionsToUpdateDisabledStates.push(updateDisabledState);
					// Not useful to call updateDisabledState() here because dependent setting values aren't loaded yet
				}
			});

			parentEl.appendChild(detailsEl);

		}

	}

	function buildSettingGroupUI(group) {
		const detailsEl = document.createElement("details");
		// detailsEl.className = "tracky-mouse-settings-group";
		// TODO: recursive check for visibility - or just define visible() on groups
		if (group.settings.every(setting => setting.visible?.() === false)) {
			detailsEl.hidden = true;
		}
		const summaryEl = document.createElement("summary");
		summaryEl.textContent = group.label;
		detailsEl.appendChild(summaryEl);
		const bodyEl = document.createElement("div");
		bodyEl.className = "tracky-mouse-details-body";
		detailsEl.appendChild(bodyEl);
		elsByGroup.set(group, bodyEl);
		return detailsEl;
	}

	function buildSettingItemUI(setting) {

		// Validation
		for (const requiredProp of ["label", "className", "key", "type", "default"]) {
			if (setting[requiredProp] === undefined) {
				if (setting.type === "button" && requiredProp === "default") {
					continue; // buttons don't need a default value
				}
				console.warn(`Setting is missing ${requiredProp}:`, setting);
				return;
			}
		}
		for (const importantProp of ["description"]) {
			if (setting[importantProp] === undefined) {
				console.warn(`Setting is missing ${importantProp}:`, setting);
			}
		}
		const rowEl = document.createElement("div");
		rowEl.className = "tracky-mouse-control-row";
		if (setting.type === "slider") {
			rowEl.innerHTML = `
				<label for="${setting.className}"><span class="tracky-mouse-label-text">${setting.label}</span></label>
				<span class="tracky-mouse-labeled-slider">
					<input type="range" id="${setting.className}" min="${setting.min}" max="${setting.max}" class="${setting.className}">
					<span class="tracky-mouse-slider-labels">
						<span class="tracky-mouse-min-label">${setting.labels.min}</span>
						<span class="tracky-mouse-max-label">${setting.labels.max}</span>
					</span>
				</span>
			`;
		} else if (setting.type === "checkbox") {
			// special interest: jspaint wants label not to use parent-child relationship so that os-gui's 98.css checkbox styles can work
			rowEl.innerHTML = `
				<input type="checkbox" id="${setting.className}" class="${setting.className}">
				<label for="${setting.className}"><span class="tracky-mouse-label-text">${setting.label}</span></label>
			`;
		} else if (setting.type === "dropdown") {
			const optionsHtml = setting.options.map(option => `
				<option value="${option.value}">${option.label}</option>
			`.trim()).join("\n");
			rowEl.innerHTML = `
				<label for="${setting.className}"><span class="tracky-mouse-label-text">${setting.label}</span></label>
				<select id="${setting.className}" class="${setting.className}">
					${optionsHtml}
				</select>
			`;
			if (setting.options.some(option => option.description)) {
				setting.description += "\n\n" + t("settings.dropdownDescriptionOptionsListHeading", { defaultValue: "Options:" }) + "\n" + setting.options.map(option => `• ${option.label}${option.description ? `: ${option.description}` : ''}`).join("\n");
			}
		} else if (setting.type === "button") {
			rowEl.innerHTML = `
				<button class="${setting.className}">${setting.label}</button>
			`;
		}
		if (setting.visible?.() === false) {
			rowEl.hidden = true;
		}

		if (setting.description) {
			// Tooltip; TODO: try an ⓘ info icon button with a popover
			rowEl.setAttribute("title", setting.description);
		}

		const infoPopover = document.createElement("div");
		infoPopover.className = "tracky-mouse-setting-info-popover";
		// Avoiding using native popover functionality because
		// the cursor+HUD should go on top in the web demo/web version.
		// TODO: accessibility attributes, Esc to close, click outside to close
		// infoPopover.popover = "auto";
		infoPopover.hidden = true;
		infoPopover.id = `tracky-mouse-${setting.className}-info-popover`;
		infoPopover.textContent = setting.description;
		infoPopover.title = ""; // avoid redundant tooltip
		rowEl.appendChild(infoPopover);

		const infoButton = document.createElement("button");
		infoButton.className = "tracky-mouse-setting-info-button tracky-mouse-setting-extra-button";
		infoButton.textContent = "ⓘ";
		// TODO: not sure what the tooltip should say, "Setting info" is just AI-suggested
		// Should it have a tooltip at all? Should it show the whole popover text in the tooltip?
		// Should it show the whole popover itself temporarily?
		// FIXME: tooltips are showing redundantly while the popover is open
		// (Including while hovering over the popover itself!)
		infoButton.title = t("settings.settingInfo", { defaultValue: "Setting info" });
		infoButton.ariaLabel = t("settings.settingInfo", { defaultValue: "Setting info" });
		if (setting.description) {
			// infoButton.popoverTargetElement = infoPopover;
			infoButton.addEventListener("click", () => {
				infoPopover.hidden = !infoPopover.hidden;
			});
		} else {
			// Disabled "extra" buttons are hidden by CSS
			// The info button is still included in the DOM to reserve space
			// and align controls without info buttons with those that have them
			// (The only setting type without a default value is "button", for now at least.)
			infoButton.disabled = true;
		}
		rowEl.prepend(infoButton);

		const resetButton = document.createElement("button");
		resetButton.className = "tracky-mouse-setting-reset-button tracky-mouse-setting-extra-button";
		resetButton.textContent = "↩"; // "⟲";
		resetButton.title = t("settings.resetSetting", { defaultValue: "Reset to default" });
		resetButton.ariaLabel = t("settings.resetSetting", { defaultValue: "Reset to default" });
		if ("default" in setting) {
			resetButton.addEventListener("click", () => {
				setControlValue(setting.default);
				loadValueFromControl();
				save();
				setting.handleSettingChange?.();
				for (const func of functionsToUpdateDisabledStates) {
					func();
				}
			});
		} else {
			// Disabled "extra" buttons are hidden by CSS
			// The reset button is still included in the DOM to reserve space
			// and align controls without reset buttons with those that have them
			// (The only setting type without a default value is "button", for now at least.)
			resetButton.disabled = true;
		}
		rowEl.prepend(resetButton);

		const control = rowEl.querySelector(`.${setting.className}`);
		const getControlValue = () => {
			if (setting.type === "slider") {
				return Number(control.value);
			} else if (setting.type === "checkbox") {
				return control.checked;
			} else if (setting.type === "dropdown") {
				return control.value;
			}
		};
		const setControlValue = (value) => {
			if (setting.type === "slider") {
				control.value = value;
			} else if (setting.type === "checkbox") {
				control.checked = value;
			} else if (setting.type === "dropdown") {
				control.value = value;
			}
		};

		const load = (settings, initialLoad) => {
			// Note: Don't use `... in settings.globalSettings` to check if a setting is defined.
			// We must ignore `undefined` values so that the defaults carry over from the renderer to the main process in the Electron app.
			if (settings.globalSettings?.[setting.key] !== undefined) {
				s[setting.key] = settings.globalSettings[setting.key];
				setControlValue((setting.settingValueToInputValue ?? ((x) => x))(s[setting.key]));
			}
			if (initialLoad) {
				setting.afterInitialLoad?.();
			}
		};
		const loadValueFromControl = () => {
			s[setting.key] = (setting.inputValueToSettingValue ?? ((x) => x))(getControlValue());
		};
		const save = () => {
			const setOptions = getSetOptionsFunction();
			setOptions({ globalSettings: { [setting.key]: s[setting.key] } });
		};

		// Load defaults
		// currently defined in input value units
		setControlValue(setting.default);
		s[setting.key] = (setting.inputValueToSettingValue ?? ((x) => x))(getControlValue());
		// Not useful to call functionsToUpdateDisabledStates here because dependent setting values aren't necessarily loaded yet

		// Handle changes
		control.addEventListener("change", () => {
			loadValueFromControl();
			save();
			// TODO: also call this if the setting is changed through CLI
			// Would be good to have a pattern where it's subscribing to changes to a settings store
			setting.handleSettingChange?.();

			for (const func of functionsToUpdateDisabledStates) {
				func();
			}
		});
		// Handle loading from stored settings
		setting._load = load;

		if (setting.type === "button") {
			control.addEventListener("click", () => {
				setting.onClick?.();
			});
		}

		return rowEl;
	}

	buildSettingsUI(uiContainer.querySelector(".tracky-mouse-controls"), settingsCategories);

	const runAtLoginCheckbox = uiContainer.querySelector(".tracky-mouse-run-at-login");
	const swapMouseButtonsCheckbox = uiContainer.querySelector(".tracky-mouse-swap-mouse-buttons");
	const swapMouseButtonsLabel = uiContainer.querySelector("label[for='tracky-mouse-swap-mouse-buttons']");
	const cameraSelect = uiContainer.querySelector(".tracky-mouse-camera-select");

	if (window.electronAPI) {
		// Disable the "run at login" option if the app isn't packaged,
		// as it's not set up to work in development mode.
		window.electronAPI.getIsPackaged().then((isPackaged) => {
			runAtLoginCheckbox.disabled = !isPackaged;
		});
	}

	// Handle right click on "swap mouse buttons", so it doesn't leave users stranded right-clicking.
	// Note that if you click outside the application window, hiding it behind another window, or minimize it,
	// you can still be left in a tricky situation.
	// A more general safety net would be a "revert changes?" timer (https://github.com/1j01/tracky-mouse/issues/43)
	// But this is good to have in any case, since you don't want to have to wait for a timeout if you don't have to.
	for (const el of [swapMouseButtonsLabel, swapMouseButtonsCheckbox]) {
		el.addEventListener("contextmenu", (e) => {
			e.preventDefault();
			swapMouseButtonsCheckbox.checked = !swapMouseButtonsCheckbox.checked;
			swapMouseButtonsCheckbox.dispatchEvent(new Event("change"));
		});
	}

	let populateCameraList = () => { return Promise.resolve(); };
	if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
		populateCameraList = () => {
			let matchedCameraIdDeferred = createDeferred();
			navigator.mediaDevices.enumerateDevices().then((devices) => {
				const videoDevices = devices.filter(device => device.kind === 'videoinput');

				let knownCameras = {};
				try {
					knownCameras = JSON.parse(localStorage.getItem("tracky-mouse-known-cameras")) || {};
				} catch (error) {
					console.error("Failed to parse known cameras from localStorage", error);
				}
				let knownCamerasChanged = false;
				for (const device of videoDevices) {
					if (device.deviceId && device.label) {
						if (!knownCameras[device.deviceId] || knownCameras[device.deviceId].name !== device.label) {
							knownCameras[device.deviceId] = { name: device.label };
							knownCamerasChanged = true;
						}
					}
				}
				if (knownCamerasChanged) {
					try {
						localStorage.setItem("tracky-mouse-known-cameras", JSON.stringify(knownCameras));
					} catch (error) {
						console.error("Failed to store known cameras in localStorage", error);
					}
				}

				cameraSelect.innerHTML = "";

				const defaultOption = document.createElement("option");
				defaultOption.value = "";
				defaultOption.text = t("settings.cameraSource.defaultCamera", { defaultValue: "Default" });
				cameraSelect.appendChild(defaultOption);

				let matchingDeviceId = "";
				for (const device of videoDevices) {
					const option = document.createElement('option');
					option.value = device.deviceId;
					option.text = device.label || t("settings.cameraSource.numberedCamera", { defaultValue: "Camera %0" }).replace("%0", cameraSelect.length);
					cameraSelect.appendChild(option);
					if (device.deviceId === s.cameraDeviceId) {
						matchingDeviceId = device.deviceId;
					} else if (device.label === knownCameras[s.cameraDeviceId]?.name) {
						matchingDeviceId ||= device.deviceId;
					}
				}

				// Defaulting to "Default" would imply a preference isn't stored...
				// but would it be more friendly anyways?
				// cameraSelect.value = found ? s.cameraDeviceId : "";

				// Show a placeholder for the selected camera
				if (s.cameraDeviceId && !matchingDeviceId) {
					const option = document.createElement("option");
					option.value = s.cameraDeviceId;
					const knownInfo = knownCameras[s.cameraDeviceId];
					option.text = knownInfo ? `${knownInfo.name} (${t("settings.cameraSource.unavailableCameraAdjective", { defaultValue: "Unavailable" })})` : t("settings.cameraSource.unavailableCamera", { defaultValue: "Unavailable camera" });
					cameraSelect.appendChild(option);
					cameraSelect.value = s.cameraDeviceId;
				} else {
					cameraSelect.value = matchingDeviceId;
				}
				matchedCameraIdDeferred.resolve(matchingDeviceId);
			});
			return matchedCameraIdDeferred.promise;
		};
		populateCameraList();
		navigator.mediaDevices.addEventListener('devicechange', populateCameraList);
	}


	return {
		populateCameraList,
		updateDisabledStates: () => {
			for (const func of functionsToUpdateDisabledStates) {
				func();
			}
		},
	};
}
