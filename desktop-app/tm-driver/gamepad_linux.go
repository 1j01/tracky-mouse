//go:build linux

package main

import (
	"errors"
	"fmt"

	"github.com/bendahl/uinput"
)

var linuxGamepad uinput.Gamepad

func getLinuxGamepad() (uinput.Gamepad, error) {
	if linuxGamepad == nil {
		gamepad, err := uinput.CreateGamepad("/dev/uinput", []byte("Tracky Mouse Gamepad"), 0x1, 0x1)
		if err != nil {
			return nil, fmt.Errorf("failed to create virtual gamepad using /dev/uinput; ensure uinput is enabled and accessible to your user: %w", err)
		}
		linuxGamepad = gamepad
	}
	return linuxGamepad, nil
}

func setGamepadState(x, y float64) error {
	gamepad, err := getLinuxGamepad()
	if err != nil {
		return err
	}
	if err := gamepad.LeftStickMove(float32(x), float32(y)); err != nil {
		return fmt.Errorf("failed to update virtual gamepad: %w", err)
	}
	return nil
}

func setGamepadButton(button string, down bool) error {
	gamepad, err := getLinuxGamepad()
	if err != nil {
		return err
	}
	var key int
	switch button {
	case "left":
		key = uinput.ButtonSouth
	case "right":
		key = uinput.ButtonEast
	case "middle":
		key = uinput.ButtonWest
	default:
		return fmt.Errorf("invalid gamepad button: %s", button)
	}
	if down {
		err = gamepad.ButtonDown(key)
	} else {
		err = gamepad.ButtonUp(key)
	}
	if err != nil {
		return fmt.Errorf("failed to update virtual gamepad button: %w", err)
	}
	return nil
}

func closeGamepad() error {
	if linuxGamepad == nil {
		return nil
	}
	gamepad := linuxGamepad
	linuxGamepad = nil
	resetErr := gamepad.LeftStickMove(0, 0)
	closeErr := gamepad.Close()
	var errs []error
	if resetErr != nil {
		errs = append(errs, fmt.Errorf("failed to reset virtual gamepad: %w", resetErr))
	}
	if closeErr != nil {
		errs = append(errs, fmt.Errorf("failed to close virtual gamepad: %w", closeErr))
	}
	return errors.Join(errs...)
}
