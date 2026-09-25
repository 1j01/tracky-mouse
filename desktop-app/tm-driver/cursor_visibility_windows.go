//go:build windows

package main

import (
	"fmt"
	"syscall"
	"unsafe"
)

const mouseEventMove = 0x0001

type mouseInput struct {
	dx          int32
	dy          int32
	mouseData   uint32
	dwFlags     uint32
	time        uint32
	dwExtraInfo uintptr
}

type input struct {
	type_ uint32
	mi    mouseInput
}

var (
	user32    = syscall.NewLazyDLL("user32.dll")
	sendInput = user32.NewProc("SendInput")
)

func ensureCursorVisibility() error {
	inputEvent := input{
		type_: 0,
		mi: mouseInput{
			dx:      1,
			dwFlags: mouseEventMove,
		},
	}
	ret, _, callErr := sendInput.Call(1, uintptr(unsafe.Pointer(&inputEvent)), unsafe.Sizeof(inputEvent))
	if ret != 1 {
		return fmt.Errorf("SendInput failed: %w", callErr)
	}
	return nil
}
