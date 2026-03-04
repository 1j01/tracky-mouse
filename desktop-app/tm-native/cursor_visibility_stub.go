//go:build !windows

package main

// ensureCursorVisible is a no-op on non-Windows platforms.
func ensureCursorVisible() {}
