//go:build !linux && !windows

package main

import "fmt"

func setGamepadState(_ float64, _ float64) error {
	return fmt.Errorf("gamepad output is only supported on Windows")
}

func closeGamepad() error {
	return nil
}
