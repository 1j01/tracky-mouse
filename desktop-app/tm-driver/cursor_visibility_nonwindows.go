//go:build !windows

package main

import "fmt"

func ensureCursorVisibility() error {
	return fmt.Errorf("ensureCursorVisibility is only supported on Windows")
}
