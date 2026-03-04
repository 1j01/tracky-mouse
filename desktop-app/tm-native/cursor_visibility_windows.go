//go:build windows

package main

import (
	"syscall"

	"github.com/go-vgo/robotgo"
)

var (
	user32         = syscall.NewLazyDLL("user32.dll")
	procShowCursor = user32.NewProc("ShowCursor")
)

// ensureCursorVisible tries to force the system cursor to be visibly drawn.
//
// In some situations on Windows the cursor is only drawn after there has been
// real mouse movement. To mimic this, we "nudge" the cursor by setting its
// position to its current location, which generates a synthetic mouse move
// event without actually moving it on screen.
//
// We also call ShowCursor(TRUE) a few times as a best-effort fallback in case
// the cursor was explicitly hidden via the Win32 ShowCursor counter.
func ensureCursorVisible() {
	// Wake the cursor by re-setting its current position.
	x, y := robotgo.Location()
	robotgo.Move(x, y)

	// Additionally, try to bump the ShowCursor counter into a visible state.
	for i := 0; i < 16; i++ {
		ret, _, _ := procShowCursor.Call(1)
		if int32(ret) >= 0 {
			break
		}
	}
}
