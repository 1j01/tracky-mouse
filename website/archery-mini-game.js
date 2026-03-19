const archery_game = document.getElementById("archery-demo");
const archery_scoreboard = document.getElementById("archery-scoreboard");
const archery_targets = document.querySelectorAll(".archery-target");
let round;
const best_times = {
	with_head_tracker: Infinity,
	with_dwell_clicker: Infinity,
	with_dwell_clicker_touch: Infinity, // unlikely, since touch doesn't have hovering (except on a few phones, as a gimmick; dunno if they trigger events with pointerType "touch" for hovering)
	with_dwell_clicker_pen: Infinity,
	with_mouse: Infinity,
	with_touch: Infinity,
	with_pen: Infinity,
	with_keyboard: Infinity,
	with_unknown_input: Infinity,
};
function initRound() {
	round = {
		used_manual_movement: false, // non-head-tracker mouse movement
		used_manual_movement_touch: false, // non-head-tracker mouse movement
		used_manual_movement_pen: false, // non-head-tracker mouse movement
		used_manual_click: false, // non-dwell clicking
		used_manual_click_touch: false, // non-dwell clicking
		used_manual_click_pen: false, // non-dwell clicking
		used_keyboard: false, // not much of a game, but may be an interesting comparison
		used_unknown_input: false, // click event despite preventing via keydown/pointerdown
		start_time: undefined, // set when the first target is hit
	};
	for (const archery_target of archery_targets) {
		archery_target.classList.remove("hit");
	}
}
initRound();
let last_pointerdown_time = -Infinity;
archery_game.addEventListener("pointerdown", (event) => {
	if (event.pointerId !== 1234567890) {
		// TODO: maybe only set if target was hit; could use a callback (or return value but that would be a little confusing since handleTargetHit looks like an event handler)
		round.used_manual_click = true;
		if (event.pointerType === "pen") {
			round.used_manual_click_pen = true;
		} else if (event.pointerType === "touch") {
			round.used_manual_click_touch = true;
		}
	}
	// Don't call `event.preventDefault()` because click will be triggered regardless, but it will prevent text deselection, which is very irritating.
	handleTargetHit(event);
	last_pointerdown_time = performance.now();
});
archery_game.addEventListener("keydown", (event) => {
	if (event.key === " " || event.key === "Enter") {
		event.preventDefault();
		round.used_keyboard = true;
		handleTargetHit(event);
	}
});
archery_game.addEventListener("click", (event) => {
	if (performance.now() - last_pointerdown_time < 100) {
		return;
	}
	round.used_unknown_input = true;
	handleTargetHit(event);
});
archery_game.addEventListener("pointerenter", (event) => {
	if (event.pointerId === 1234567890) {
		return;
	}
	round.used_manual_movement = true;
	if (event.pointerType === "pen") {
		round.used_manual_movement_pen = true;
	} else if (event.pointerType === "touch") {
		round.used_manual_movement_touch = true;
	}
});

/**
 * @returns {keyof typeof best_times} scoreboard_slot - the slot in the scoreboard for the current input method (the most powerful, if it's ambiguous)
 * 
 * If you for example use the head tracker for one target and then mash Tab+Enter for the rest, that should count as using the keyboard.
 * 
 * Note that pointerType may be "mouse" when using a pen, under some circumstances.
 * It seems I need to enable "Windows Ink" in the Wacom settings (and re-open the tab, not just reload) to get "pen" as the pointerType.
 */
function get_scoreboard_slot() {
	if (round.used_keyboard) {
		// keyboard is the most like cheating, so it goes first
		return "with_keyboard";
	} else if (round.used_manual_click_touch) {
		// next easiest is clicking with touch (it's an absolute input method, and you can see exactly where you're clicking; you could even line up multiple fingers with targets... actually that might even make it more powerful than the keyboard...)
		return "with_touch";
	} else if (round.used_manual_click_pen) {
		// next easiest is clicking with a pen (it's an absolute input method, but you have to look at the cursor to see where you're clicking)
		return "with_pen";
	} else if (round.used_manual_click) {
		// next easiest is clicking with a mouse (it's relative, but precise and familiar)
		return "with_mouse";
	} else if (round.used_manual_movement_touch) {
		// next easiest is moving the mouse but using the dwell clicker (it's precise but slower)
		// not sure about touch vs pen/mouse in this case, as I don't have a touch screen supporting hover
		return "with_dwell_clicker_touch";
	} else if (round.used_manual_movement_pen) {
		// (see previous comment)
		return "with_dwell_clicker_pen";
	} else if (round.used_manual_movement) {
		// (see previous comment)
		return "with_dwell_clicker";
	} else if (round.used_unknown_input) {
		// this last one is a wild card; it's hard to say whether this condition should be last or first
		// I imagine some other accessibility feature might trigger this
		// Can simulate with:
		// for (const archeryTarget of document.querySelectorAll(".archery-target")) {
		// 	archeryTarget.dispatchEvent(new PointerEvent("click", { bubbles: true }));
		// }
		// Of course, that example is completely cheating, which makes it feel like it should be first,
		// but I suspect if this occurs outside of a test, it won't be due to cheating.
		// Of course, the ranking by "easiness" is only in case you mix input methods in a single round.
		// It might not be the best way to detect a different (unknown) input method.
		// That is to say, there's a different argument for giving this priority.
		return "with_unknown_input";
	} else {
		return "with_head_tracker";
	}
}

const slot_labels = {
	with_head_tracker: "With Head Tracking",
	with_dwell_clicker: "With Dwell Clicking", // may be pen, undetectable in some cases
	with_dwell_clicker_touch: "With Dwell Clicking (Touch)",
	with_dwell_clicker_pen: "With Dwell Clicking (Pen)",
	with_mouse: "With Manual Clicking", // may be pen, undetectable in some cases, hence "manual" instead of "mouse"
	with_touch: "With Touch",
	with_pen: "With Pen",
	with_keyboard: "With Keyboard",
	with_unknown_input: "With Unknown Input",
};

/**
 * @param {PointerEvent | KeyboardEvent} event 
 */
function handleTargetHit(event) {
	if (!event.target.matches(".archery-target")) {
		return;
	}
	if (archery_game.classList.contains("round-over")) {
		return;
	}
	const archery_target = event.target;
	if (!round.start_time) {
		initRound(); // reset input detection to ignore spurious hovering before the round starts
		round.start_time = performance.now();
		archery_scoreboard.hidden = true;
	}
	// after initRound since initRound removes the .hit class
	archery_target.classList.add("hit");
	animateTargetHit(archery_target).then(() => {
		// archery_target.classList.remove("hit");
	});
	if (document.querySelectorAll(".archery-target:not(.hit)").length === 0) {
		const time = (performance.now() - round.start_time) / 1000;
		archery_scoreboard.hidden = false;
		archery_scoreboard.textContent = `Time: ${time.toFixed(2)}s`;
		const slot = get_scoreboard_slot();
		const new_best = time < best_times[slot];
		if (new_best) {
			best_times[slot] = time;
		}
		const slot_indicator = document.createElement("p");
		slot_indicator.textContent = slot_labels[slot];
		slot_indicator.classList.add("slot-indicator");
		archery_scoreboard.append(slot_indicator);
		const best_times_label = document.createElement("p");
		best_times_label.textContent = `Best times:`;
		best_times_label.classList.add("best-times-label");
		archery_scoreboard.append(best_times_label);
		const ul = document.createElement("ul");
		archery_scoreboard.append(ul);
		for (const [id, time] of Object.entries(best_times)) {
			if (time === Infinity) {
				continue;
			}
			const label = slot_labels[id];
			const li = document.createElement("li");
			li.textContent = `${label}: ${time.toFixed(2)}s`;
			if (slot === id && new_best) {
				li.classList.add("new-best-time");
				const new_best = document.createElement("span");
				new_best.textContent = " New Best!";
				li.append(new_best);
			}
			ul.append(li);
		}
		archery_game.classList.add("round-over");
		setTimeout(() => {
			for (const archery_target of archery_targets) {
				for (const animation of archery_target.getAnimations()) {
					animation.cancel();
				}
			}
			setTimeout(() => {
				archery_game.classList.remove("round-over");
				initRound();
			}, 100);
		}, 2000);
	}
}

/**
 * @param {HTMLButtonElement} archery_target 
 */
async function animateTargetHit(archery_target) {
	// archery_target.style.animation = "archery-target-hit 0.5s ease-in-out";
	// archery_target.addEventListener("animationend", () => {
	// 	archery_target.style.animation = "";
	// }, { once: true });
	const frames = [];
	let angle = 0;
	let angularVelocity = 2 + Math.random() * 0.2;
	for (let t = 0; t < 100; t++) {
		angularVelocity *= 0.92;
		angle += angularVelocity;
		angularVelocity += (Math.sin(angle)) * 0.1;
		frames.push({
			transform: `translate(-50%, -50%) rotateX(${angle}rad)`,
			opacity: Math.min(1, Math.max(0.2, 1 - t / 100 * 4.123456) - Math.cos(angle) * 0.1),
		});
	}
	try {
		await archery_target.animate(frames, {
			duration: 10000,
			easing: "linear",
			fill: "both",
		}).finished;
	} catch (_error) {
		// ignore cancelation
	}
}
