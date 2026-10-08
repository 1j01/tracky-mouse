//go:build !linux || !libei
// +build !linux !libei

package main

import "github.com/go-vgo/robotgo"

func moveMouseRelative(x, y int) {
	robotgo.MoveRelative(x, y)
}
