//go:build windows

package main

import "syscall"

var (
	user32         = syscall.NewLazyDLL("user32.dll")
	procShowCursor = user32.NewProc("ShowCursor")
)

// ensureCursorVisible tries to force the system cursor to be visible.
//
// Windows tracks cursor visibility using an internal display counter.
// ShowCursor(true) increments this counter and shows the cursor when
// the counter is non-negative. If some code has hidden the cursor
// repeatedly, we may need to call ShowCursor(true) multiple times
// to bring the counter back to a visible state.
func ensureCursorVisible() {
	for i := 0; i < 16; i++ {
		ret, _, _ := procShowCursor.Call(1)
		// When the display counter is >= 0, the cursor is guaranteed visible.
		if int32(ret) >= 0 {
			break
		}
	}
}
