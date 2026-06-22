// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { InputSimulator, TM_POINTER_ID } from '../../core/src/input-simulator.js';

describe('InputSimulator constants', () => {
	it('exports a numeric TM_POINTER_ID', () => {
		expect(typeof TM_POINTER_ID).toBe('number');
	});

	it('uses TM_POINTER_ID as the pointerId', () => {
		const sim = new InputSimulator();
		expect(sim.pointerId).toBe(TM_POINTER_ID);
	});
});

describe('InputSimulator.click — range input (slider)', () => {
	let slider;
	let sim;

	beforeEach(() => {
		sim = new InputSimulator();
		slider = document.createElement('input');
		slider.type = 'range';
		slider.min = '0';
		slider.max = '100';
		slider.value = '50';
		// jsdom elements have zero layout; provide a fake bounding rect
		slider.getBoundingClientRect = () => ({
			left: 0, top: 0, right: 200, bottom: 20,
			width: 200, height: 20,
			x: 0, y: 0,
		});
		document.body.appendChild(slider);
	});

	it('sets the slider value based on the click x position', () => {
		sim.click(slider, 100, 10); // midpoint of 200px-wide slider → value 50
		expect(Number(slider.value)).toBeCloseTo(50);
	});

	it('sets the slider to min when clicked at the left edge', () => {
		sim.click(slider, 0, 10);
		expect(Number(slider.value)).toBeCloseTo(0);
	});

	it('sets the slider to max when clicked at the right edge', () => {
		sim.click(slider, 200, 10);
		expect(Number(slider.value)).toBeCloseTo(100);
	});

	it('dispatches input and change events after adjusting the slider', () => {
		let inputFired = false;
		let changeFired = false;
		slider.addEventListener('input', () => { inputFired = true; });
		slider.addEventListener('change', () => { changeFired = true; });
		sim.click(slider, 50, 10);
		expect(inputFired).toBe(true);
		expect(changeFired).toBe(true);
	});
});

describe('InputSimulator.click — select element (dropdown)', () => {
	let select;
	let sim;

	beforeEach(() => {
		sim = new InputSimulator();
		select = document.createElement('select');
		const options = ['apple', 'banana', 'cherry'];
		for (const opt of options) {
			const option = document.createElement('option');
			option.value = opt;
			option.textContent = opt;
			select.appendChild(option);
		}
		document.body.appendChild(select);
	});

	it('opens the dropdown flyout on first click', () => {
		sim.click(select, 0, 0);
		expect(sim.dropdownToCloseFunction.has(select)).toBe(true);
		sim.closeDropdown(select);
	});

	it('closes the dropdown on second click', () => {
		sim.click(select, 0, 0); // open
		sim.click(select, 0, 0); // close
		expect(sim.dropdownToCloseFunction.has(select)).toBe(false);
	});
});

describe('InputSimulator.click — option element', () => {
	it('changes the parent select value and fires events', () => {
		const sim = new InputSimulator();
		const select = document.createElement('select');
		select.innerHTML = '<option value="a">A</option><option value="b">B</option>';
		document.body.appendChild(select);

		let inputFired = false;
		let changeFired = false;
		select.addEventListener('input', () => { inputFired = true; });
		select.addEventListener('change', () => { changeFired = true; });

		const optionB = select.querySelector('option[value="b"]');
		sim.click(optionB, 0, 0);
		expect(select.value).toBe('b');
		expect(inputFired).toBe(true);
		expect(changeFired).toBe(true);
	});
});

describe('InputSimulator.click — normal element', () => {
	it('calls .click() on normal elements', () => {
		const sim = new InputSimulator();
		const button = document.createElement('button');
		let clicked = false;
		button.addEventListener('click', () => { clicked = true; });
		document.body.appendChild(button);
		sim.click(button, 0, 0);
		expect(clicked).toBe(true);
	});
});

describe('InputSimulator.targetFromPoint', () => {
	it('returns document.body when nothing is at the point', () => {
		const sim = new InputSimulator();
		const target = sim.targetFromPoint(-9999, -9999);
		expect(target).toBe(document.body);
	});

	it('skips elements with the tracky-mouse-click-through class', () => {
		const sim = new InputSimulator();

		// Create a parent and a click-through overlay in front of it
		const parent = document.createElement('div');
		parent.id = 'target-parent';
		const overlay = document.createElement('div');
		overlay.className = 'tracky-mouse-click-through';
		parent.appendChild(overlay);
		document.body.appendChild(parent);

		// Spy on elementsFromPoint to simulate the overlay being on top
		const origElementsFromPoint = document.elementsFromPoint.bind(document);
		document.elementsFromPoint = (_x, _y) => [overlay, parent, document.body];
		document.elementFromPoint = (_x, _y) => overlay;

		const target = sim.targetFromPoint(0, 0);
		expect(target).not.toBe(overlay);
		expect(target).toBe(parent);

		// Restore
		document.elementsFromPoint = origElementsFromPoint;
	});
});

describe('InputSimulator.pointerMove', () => {
	it('dispatches a pointermove event on the target element', () => {
		const sim = new InputSimulator();
		const div = document.createElement('div');
		document.body.appendChild(div);

		let eventReceived = null;
		div.addEventListener('pointermove', (e) => { eventReceived = e; });

		// Patch elementFromPoint so we can control the target
		document.elementFromPoint = () => div;

		sim.pointerMove(50, 60);
		expect(eventReceived).not.toBeNull();
		expect(eventReceived.clientX).toBe(50);
		expect(eventReceived.clientY).toBe(60);
		expect(eventReceived.pointerId).toBe(TM_POINTER_ID);
	});

	it('dispatches pointerleave and pointerenter when the element changes', () => {
		const sim = new InputSimulator();
		const div1 = document.createElement('div');
		const div2 = document.createElement('div');
		document.body.appendChild(div1);
		document.body.appendChild(div2);

		let leaveEl = null;
		let enterEl = null;
		div1.addEventListener('pointerleave', () => { leaveEl = div1; });
		div2.addEventListener('pointerenter', () => { enterEl = div2; });

		document.elementFromPoint = () => div1;
		sim.pointerMove(10, 10); // first move — enters div1

		document.elementFromPoint = () => div2;
		sim.pointerMove(20, 20); // second move — leaves div1, enters div2

		expect(leaveEl).toBe(div1);
		expect(enterEl).toBe(div2);
	});
});

describe('InputSimulator.setMouseButtonState', () => {
	it('returns true when the state changes', () => {
		const sim = new InputSimulator();
		document.elementFromPoint = () => document.body;
		const changed = sim.setMouseButtonState(0, true);
		expect(changed).toBe(true);
		sim.setMouseButtonState(0, false); // clean up
	});

	it('returns false when the state does not change', () => {
		const sim = new InputSimulator();
		const changed = sim.setMouseButtonState(0, false); // already false
		expect(changed).toBe(false);
	});
});
