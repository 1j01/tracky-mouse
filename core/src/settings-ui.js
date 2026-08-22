
// TODO: clean up signature which is currently "whatever dependencies were needed to extract this code to a new file"
export function initSettingsUI({
	settingsCategories,
	uiContainer,
	t,
	s,
	traverseSettings,
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

		// TODO: consider making everything use <label for=""> inside and <div> outside
		const rowEl = document.createElement(setting.type === "slider" ? "label" : "div");
		rowEl.className = "tracky-mouse-control-row";
		if (setting.type === "slider") {
			rowEl.innerHTML = `
				<span class="tracky-mouse-label-text">${setting.label}</span>
				<span class="tracky-mouse-labeled-slider">
					<input type="range" min="${setting.min}" max="${setting.max}" class="${setting.className}">
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

	return {
		updateDisabledStates: () => {
			for (const func of functionsToUpdateDisabledStates) {
				func();
			}
		},
	};
}
