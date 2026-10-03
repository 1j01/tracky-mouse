//go:build linux && libei
// +build linux,libei

package main

import libei "github.com/go-vgo/robotgo/libei"

func moveMouseRelative(x, y int) {
	libei.MoveRelative(x, y)
}
