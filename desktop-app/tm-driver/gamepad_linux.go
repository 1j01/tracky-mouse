//go:build linux

package main

import (
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"os"
	"syscall"
	"time"

	"golang.org/x/sys/unix"
)

// A minimal virtual gamepad using uinput.
// The github.com/bendahl/uinput gamepad doesn't declare axis ranges, so the kernel clamps all stick values to 0.

const (
	uiSetEvBit   = 0x40045564
	uiSetKeyBit  = 0x40045565
	uiSetAbsBit  = 0x40045567
	uiDevCreate  = 0x5501
	uiDevDestroy = 0x5502

	evSyn = 0x00
	evKey = 0x01
	evAbs = 0x03

	absX   = 0x00
	absY   = 0x01
	absCnt = 64

	btnSouth = 0x130 // A
	btnEast  = 0x131 // B
	btnNorth = 0x133 // X (Linux names it BTN_NORTH, with BTN_X as an alias)

	maxAxisValue = 32767
	busUSB       = 0x03
)

type uinputID struct {
	Bustype uint16
	Vendor  uint16
	Product uint16
	Version uint16
}

type uinputUserDev struct {
	Name       [80]byte
	ID         uinputID
	EffectsMax uint32
	Absmax     [absCnt]int32
	Absmin     [absCnt]int32
	Absfuzz    [absCnt]int32
	Absflat    [absCnt]int32
}

type inputEvent struct {
	Time  syscall.Timeval
	Type  uint16
	Code  uint16
	Value int32
}

var linuxGamepad *os.File

func createLinuxGamepad() (*os.File, error) {
	file, err := os.OpenFile("/dev/uinput", os.O_WRONLY|syscall.O_NONBLOCK, 0660)
	if err != nil {
		return nil, err
	}
	fd := int(file.Fd())
	setBits := []struct {
		request uint
		values  []int
	}{
		{uiSetEvBit, []int{evKey, evAbs}},
		{uiSetKeyBit, []int{btnSouth, btnEast, btnNorth}},
		{uiSetAbsBit, []int{absX, absY}},
	}
	for _, set := range setBits {
		for _, value := range set.values {
			if err := unix.IoctlSetInt(fd, set.request, value); err != nil {
				file.Close()
				return nil, err
			}
		}
	}

	dev := uinputUserDev{ID: uinputID{Bustype: busUSB, Vendor: 0x1, Product: 0x1, Version: 1}}
	copy(dev.Name[:], "Tracky Mouse Gamepad")
	for _, axis := range []int{absX, absY} {
		dev.Absmin[axis] = -maxAxisValue
		dev.Absmax[axis] = maxAxisValue
	}
	buf := new(bytes.Buffer)
	if err := binary.Write(buf, binary.LittleEndian, dev); err != nil {
		file.Close()
		return nil, err
	}
	if _, err := file.Write(buf.Bytes()); err != nil {
		file.Close()
		return nil, err
	}
	if err := unix.IoctlSetInt(fd, uiDevCreate, 0); err != nil {
		file.Close()
		return nil, err
	}
	// Give the system time to register the device before sending events.
	time.Sleep(200 * time.Millisecond)
	return file, nil
}

func getLinuxGamepad() (*os.File, error) {
	if linuxGamepad == nil {
		gamepad, err := createLinuxGamepad()
		if err != nil {
			return nil, fmt.Errorf("failed to create virtual gamepad using /dev/uinput; ensure uinput is enabled and accessible to your user: %w", err)
		}
		linuxGamepad = gamepad
	}
	return linuxGamepad, nil
}

func writeEvents(file *os.File, events ...inputEvent) error {
	buf := new(bytes.Buffer)
	for _, event := range append(events, inputEvent{Type: evSyn}) {
		if err := binary.Write(buf, binary.LittleEndian, event); err != nil {
			return err
		}
	}
	_, err := file.Write(buf.Bytes())
	return err
}

// Takes values where positive Y is up (as with XInput), but evdev's positive Y is down.
func writeAxes(file *os.File, x, y float64) error {
	return writeEvents(file,
		inputEvent{Type: evAbs, Code: absX, Value: int32(x * maxAxisValue)},
		inputEvent{Type: evAbs, Code: absY, Value: int32(-y * maxAxisValue)},
	)
}

func setGamepadState(x, y float64) error {
	gamepad, err := getLinuxGamepad()
	if err != nil {
		return err
	}
	if err := writeAxes(gamepad, x, y); err != nil {
		return fmt.Errorf("failed to update virtual gamepad: %w", err)
	}
	return nil
}

func setGamepadButton(button string, down bool) error {
	gamepad, err := getLinuxGamepad()
	if err != nil {
		return err
	}
	var code uint16
	switch button {
	case "left":
		code = btnSouth
	case "right":
		code = btnEast
	case "middle":
		code = btnNorth
	default:
		return fmt.Errorf("invalid gamepad button: %s", button)
	}
	var value int32
	if down {
		value = 1
	}
	if err := writeEvents(gamepad, inputEvent{Type: evKey, Code: code, Value: value}); err != nil {
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
	resetErr := writeAxes(gamepad, 0, 0)
	destroyErr := unix.IoctlSetInt(int(gamepad.Fd()), uiDevDestroy, 0)
	closeErr := gamepad.Close()
	var errs []error
	if resetErr != nil {
		errs = append(errs, fmt.Errorf("failed to reset virtual gamepad: %w", resetErr))
	}
	if destroyErr != nil {
		errs = append(errs, fmt.Errorf("failed to destroy virtual gamepad: %w", destroyErr))
	}
	if closeErr != nil {
		errs = append(errs, fmt.Errorf("failed to close virtual gamepad: %w", closeErr))
	}
	return errors.Join(errs...)
}
