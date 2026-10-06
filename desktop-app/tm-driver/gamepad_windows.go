//go:build windows

package main

import (
	"fmt"

	"github.com/CB2Moon/vgamepad-go/pkg/vgamepad"
)

var windowsGamepad *vgamepad.VX360Gamepad

func setGamepadState(x, y float64) error {
	if windowsGamepad == nil {
		gamepad, err := vgamepad.NewVX360Gamepad()
		if err != nil {
			return fmt.Errorf("failed to create virtual Xbox 360 gamepad; install ViGEmBus: %w", err)
		}
		windowsGamepad = gamepad
	}
	windowsGamepad.LeftJoystickFloat(x, y)
	return windowsGamepad.Update()
}

func closeGamepad() error {
	if windowsGamepad == nil {
		return nil
	}
	windowsGamepad.Reset()
	if err := windowsGamepad.Update(); err != nil {
		windowsGamepad.Close()
		windowsGamepad = nil
		return err
	}
	windowsGamepad.Close()
	windowsGamepad = nil
	return nil
}
