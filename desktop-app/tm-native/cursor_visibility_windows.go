//go:build windows

package main

import (
	"syscall"
	"unsafe"
)

var (
	user32          = syscall.NewLazyDLL("user32.dll")
	procShowCursor  = user32.NewProc("ShowCursor")
	procSendInput   = user32.NewProc("SendInput")
)

const (
	inputMouse      = 0
	mouseeventfMove = 0x0001
)

type mouseInput struct {
	dx, dy         int32
	mouseData      uint32
	dwFlags        uint32
	time           uint32
	dwExtraInfo    uintptr
}

type input struct {
	type_ uint32
	mi    mouseInput
}

// ensureCursorVisible tries to force the system cursor to be visibly drawn.
//
// On Windows, the cursor may not appear until there has been real mouse
// movement. To approximate this, we inject a small relative mouse move via
// SendInput, which tends to wake up the cursor drawing without relying on
// robotgo's higher-level helpers.
//
// We also call ShowCursor(TRUE) a few times as a best-effort fallback in case
// the cursor was explicitly hidden via the Win32 ShowCursor counter.
func ensureCursorVisible() {
	// Inject a tiny relative mouse move.
	var inp input
	inp.type_ = inputMouse
	inp.mi = mouseInput{
		dx:      1,
		dy:      0,
		dwFlags: mouseeventfMove,
	}
	procSendInput.Call(
		1,
		uintptr(unsafe.Pointer(&inp)),
		unsafe.Sizeof(inp),
	)

	// Additionally, try to bump the ShowCursor counter into a visible state.
	for i := 0; i < 16; i++ {
		ret, _, _ := procShowCursor.Call(1)
		if int32(ret) >= 0 {
			break
		}
	}
}
