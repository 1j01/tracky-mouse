
// eslint-disable-next-line no-unused-vars
const TrackyMouse = (() => {
	const deprecationMessage = "Loading TrackyMouse as a global variable via script tag is no longer supported. Please import TrackyMouse from the \"tracky-mouse\" module instead.";

	return new Proxy({}, {
		get(_target, _prop) {
			throw new Error(deprecationMessage);
		},
		set(_target, _prop, _value) {
			throw new Error(deprecationMessage);
		},
	});
})();
