//go:build windows

package main

import (
	"fmt"

	"github.com/CB2Moon/vgamepad-go/pkg/commons"
	"github.com/CB2Moon/vgamepad-go/pkg/vgamepad"
)

var windowsGamepad *vgamepad.VX360Gamepad

func setGamepadState(x, y float64) error {
	if err := ensureWindowsGamepad(); err != nil {
		return err
	}
	windowsGamepad.LeftJoystickFloat(x, y)
	return windowsGamepad.Update()
}

func ensureWindowsGamepad() error {
	if windowsGamepad == nil {
		gamepad, err := vgamepad.NewVX360Gamepad()
		if err != nil {
			return fmt.Errorf("failed to create virtual Xbox 360 gamepad; install ViGEmBus: %w", err)
		}
		windowsGamepad = gamepad
	}
	return nil
}

func setGamepadButton(button string, down bool) error {
	if err := ensureWindowsGamepad(); err != nil {
		return err
	}
	var gamepadButton commons.XUSBButton
	switch button {
	case "left":
		gamepadButton = commons.XUSB_GAMEPAD_A
	case "right":
		gamepadButton = commons.XUSB_GAMEPAD_B
	case "middle":
		gamepadButton = commons.XUSB_GAMEPAD_X
	default:
		return fmt.Errorf("invalid gamepad button: %s", button)
	}
	if down {
		windowsGamepad.PressButton(gamepadButton)
	} else {
		windowsGamepad.ReleaseButton(gamepadButton)
	}
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
