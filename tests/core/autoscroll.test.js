// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// autoscroll.js uses document/window at module evaluation time;
// those are provided by the jsdom environment.
import { autoscroll } from '../../core/src/autoscroll.js';

describe('autoscroll.pointerMove scroll delta', () => {
	beforeEach(() => {
		autoscroll.startAutoscroll(document.body, 100, 100, 1);
	});

	afterEach(() => {
		autoscroll.stopAutoscroll();
	});

	it('produces zero scrollDelta when position is within the dead zone', () => {
		// Dead zone is 10 px (taxicab distance)
		autoscroll.pointerMove(document.body, 105, 100, 1); // 5px right — within dead zone
		expect(autoscroll._currentScrollDelta).not.toBeNull();
		expect(autoscroll._currentScrollDelta.x).toBe(0);
		expect(autoscroll._currentScrollDelta.y).toBe(0);
	});

	it('produces positive x scrollDelta when moved right beyond the dead zone', () => {
		autoscroll.pointerMove(document.body, 125, 100, 1); // 25px right — beyond 10px dead zone
		expect(autoscroll._currentScrollDelta.x).toBeGreaterThan(0);
		expect(autoscroll._currentScrollDelta.y).toBe(0);
	});

	it('produces negative x scrollDelta when moved left beyond the dead zone', () => {
		autoscroll.pointerMove(document.body, 75, 100, 1); // 25px left — beyond 10px dead zone
		expect(autoscroll._currentScrollDelta.x).toBeLessThan(0);
		expect(autoscroll._currentScrollDelta.y).toBe(0);
	});

	it('produces positive y scrollDelta when moved down beyond the dead zone', () => {
		autoscroll.pointerMove(document.body, 100, 125, 1); // 25px down — beyond 10px dead zone
		expect(autoscroll._currentScrollDelta.x).toBe(0);
		expect(autoscroll._currentScrollDelta.y).toBeGreaterThan(0);
	});

	it('produces negative y scrollDelta when moved up beyond the dead zone', () => {
		autoscroll.pointerMove(document.body, 100, 75, 1); // 25px up — beyond 10px dead zone
		expect(autoscroll._currentScrollDelta.x).toBe(0);
		expect(autoscroll._currentScrollDelta.y).toBeLessThan(0);
	});

	it('produces larger scrollDelta for larger displacements (nonlinear scaling)', () => {
		autoscroll.pointerMove(document.body, 120, 100, 1); // 20px right
		const smallDelta = autoscroll._currentScrollDelta.x;

		autoscroll.pointerMove(document.body, 150, 100, 1); // 50px right
		const largeDelta = autoscroll._currentScrollDelta.x;

		expect(largeDelta).toBeGreaterThan(smallDelta);
	});

	it('ignores pointer moves from a different pointerId', () => {
		autoscroll.pointerMove(document.body, 150, 100, 999); // wrong pointer id
		// _currentScrollDelta stays null (set by startAutoscroll, not updated by wrong pointer)
		expect(autoscroll._currentScrollDelta).toBeNull();
	});
});

describe('autoscroll lifecycle', () => {
	it('startAutoscroll adds indicator to the document body', () => {
		expect(document.body.children.length).toBe(0);
		autoscroll.startAutoscroll(document.body, 50, 50, 1);
		expect(document.body.contains(document.body.querySelector('div'))).toBe(true);
		autoscroll.stopAutoscroll();
	});

	it('stopAutoscroll removes indicator and click blocker', () => {
		autoscroll.startAutoscroll(document.body, 50, 50, 1);
		autoscroll.stopAutoscroll();
		expect(document.body.children.length).toBe(0);
	});

	it('stopAutoscroll clears internal state', () => {
		autoscroll.startAutoscroll(document.body, 50, 50, 1);
		autoscroll.stopAutoscroll();
		expect(autoscroll._start).toBeNull();
		expect(autoscroll._currentScrollDelta).toBeNull();
		expect(autoscroll._lastTimestamp).toBeNull();
	});
});

describe('autoscroll.pointerDown / pointerUp', () => {
	afterEach(() => {
		autoscroll.stopAutoscroll();
	});

	it('starts autoscroll when middle button (button 1) is pressed', () => {
		autoscroll.pointerDown(document.body, 100, 100, 1, 1);
		expect(autoscroll._start).not.toBeNull();
	});

	it('does not start autoscroll when left button (button 0) is pressed', () => {
		autoscroll.pointerDown(document.body, 100, 100, 0, 1);
		expect(autoscroll._start).toBeNull();
	});

	it('stops autoscroll when left button is pressed while scrolling', () => {
		autoscroll.startAutoscroll(document.body, 100, 100, 1);
		expect(autoscroll._start).not.toBeNull();
		autoscroll.pointerDown(document.body, 100, 100, 0, 1); // left click stops it
		expect(autoscroll._start).toBeNull();
	});

	it('stops autoscroll when middle button is released far from start', () => {
		autoscroll.startAutoscroll(document.body, 100, 100, 1);
		autoscroll.pointerUp(document.body, 200, 200, 1, 1); // far away — should stop
		expect(autoscroll._start).toBeNull();
	});

	it('keeps autoscroll locked when middle button is released close to start', () => {
		autoscroll.startAutoscroll(document.body, 100, 100, 1);
		autoscroll.pointerUp(document.body, 102, 102, 1, 1); // within 10px radius — locked
		expect(autoscroll._start).not.toBeNull();
	});
});
