
// This file provides a partial shim for the old script tag way of loading TrackyMouse.
// It only works if you await `TrackyMouse.loadDependencies()` before using any other APIs,
// which was not normally required for all APIs (nor is it required for all APIs when importing TrackyMouse as a module).

// eslint-disable-next-line no-unused-vars
const TrackyMouse = (() => {
	const deprecationMessage = "Loading TrackyMouse as a global variable via script tag is no longer supported. Please import TrackyMouse from the \"tracky-mouse\" module instead.";
	console.warn(deprecationMessage);

	let tmAPI = null;
	let propertiesBeforeLoad = {};

	return new Proxy({}, {
		get(_target, prop) {
			if (tmAPI) {
				return tmAPI[prop];
			} else if (Object.hasOwn(propertiesBeforeLoad, prop)) {
				return propertiesBeforeLoad[prop];
			} else if (prop === "loadDependencies") {
				return async (...args) => {
					tmAPI = (await import("./src/tracky-mouse.js")).TrackyMouse;
					Object.assign(tmAPI, propertiesBeforeLoad);
					return tmAPI.loadDependencies(...args);
				};
			}
			throw new Error(deprecationMessage);
		},
		set(_target, prop, value) {
			if (tmAPI) {
				tmAPI[prop] = value;
				return true;
			}
			propertiesBeforeLoad[prop] = value;
			return true;
		},
	});
})();
