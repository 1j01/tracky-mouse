//go:build linux

package main

import (
	"errors"
	"fmt"

	"github.com/bendahl/uinput"
)

var linuxGamepad uinput.Gamepad

func setGamepadState(x, y float64) error {
	if linuxGamepad == nil {
		gamepad, err := uinput.CreateGamepad("/dev/uinput", []byte("Tracky Mouse Gamepad"), 0x1, 0x1)
		if err != nil {
			return fmt.Errorf("failed to create virtual gamepad using /dev/uinput; ensure uinput is enabled and accessible to your user: %w", err)
		}
		linuxGamepad = gamepad
	}
	if err := linuxGamepad.LeftStickMove(float32(x), float32(y)); err != nil {
		return fmt.Errorf("failed to update virtual gamepad: %w", err)
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
