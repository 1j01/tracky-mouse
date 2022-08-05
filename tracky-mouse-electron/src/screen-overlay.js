
const actionSpan = document.getElementById("enable-disable");

electronAPI.onToggle((event, isEnabled) => {
	actionSpan.innerText = isEnabled ? "disable" : "enable";
});
