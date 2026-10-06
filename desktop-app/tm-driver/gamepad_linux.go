//go:build linux

package main

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/bendahl/uinput"
)

const linuxGamepadName = "Tracky Mouse Gamepad Input"

var linuxGamepad uinput.Gamepad
var moltenGamepad *exec.Cmd
var moltenGamepadDone chan error
var moltenGamepadConfigDir string

func setGamepadState(x, y float64) error {
	if linuxGamepad == nil {
		if err := startLinuxGamepad(); err != nil {
			return err
		}
	}
	select {
	case err := <-moltenGamepadDone:
		if linuxGamepad != nil {
			_ = linuxGamepad.Close()
			linuxGamepad = nil
		}
		moltenGamepad = nil
		moltenGamepadDone = nil
		removeMoltenGamepadConfig()
		if err == nil {
			err = fmt.Errorf("process stopped unexpectedly")
		}
		return fmt.Errorf("MoltenGamepad exited: %w", err)
	default:
	}
	return linuxGamepad.LeftStickMove(float32(x), float32(-y))
}

func startLinuxGamepad() error {
	moltenGamepadPath, err := exec.LookPath("moltengamepad")
	if err != nil {
		return fmt.Errorf("MoltenGamepad is required for gamepad output on Linux; install moltengamepad and ensure it is on PATH: %w", err)
	}

	moltenGamepadConfigDir, err = os.MkdirTemp("", "tracky-mouse-moltengamepad-")
	if err != nil {
		return fmt.Errorf("failed to create MoltenGamepad configuration directory: %w", err)
	}
	configPath := filepath.Join(moltenGamepadConfigDir, "config")
	gendevPath := filepath.Join(moltenGamepadConfigDir, "gendevices")
	profilesPath := filepath.Join(moltenGamepadConfigDir, "profiles")
	for _, dir := range []string{configPath, gendevPath, profilesPath} {
		if err := os.MkdirAll(dir, 0o700); err != nil {
			_ = os.RemoveAll(moltenGamepadConfigDir)
			return fmt.Errorf("failed to create MoltenGamepad directory: %w", err)
		}
	}

	files := map[string]string{
		filepath.Join(configPath, "moltengamepad.cfg"): "mimic_xpad = true\nnum_gamepads = 1\nload profiles from tracky-mouse\n",
		filepath.Join(gendevPath, "tracky-mouse.cfg"): strings.Join([]string{
			fmt.Sprintf("[%q vendor=0001 product=0001]", linuxGamepadName),
			"name = \"tracky_mouse\"",
			"devname = \"tracky_mouse_\"",
			"abs_x = \"left_x\", \"Left stick X-axis\"",
			"abs_y = \"left_y\", \"Left stick Y-axis\"",
			"",
		}, "\n"),
		filepath.Join(profilesPath, "tracky-mouse"): "[gamepad]\nleft_x = left_x\nleft_y = left_y\n",
	}
	for filePath, content := range files {
		if err := os.WriteFile(filePath, []byte(content), 0o600); err != nil {
			_ = os.RemoveAll(moltenGamepadConfigDir)
			return fmt.Errorf("failed to write MoltenGamepad configuration: %w", err)
		}
	}

	moltenGamepad = exec.Command(moltenGamepadPath,
		"--config-path", configPath,
		"--gendev-path", gendevPath,
		"--profiles-path", profilesPath,
		"--mimic-xpad",
		"--num-gamepads", "1",
	)
	moltenGamepad.Stdout = io.Discard
	moltenGamepad.Stderr = os.Stderr
	if err := moltenGamepad.Start(); err != nil {
		_ = os.RemoveAll(moltenGamepadConfigDir)
		return fmt.Errorf("failed to start MoltenGamepad: %w", err)
	}
	moltenGamepadDone = make(chan error, 1)
	go func() {
		moltenGamepadDone <- moltenGamepad.Wait()
	}()

	linuxGamepad, err = uinput.CreateGamepad("/dev/uinput", []byte(linuxGamepadName), 1, 1)
	if err != nil {
		_ = stopMoltenGamepad()
		return fmt.Errorf("failed to create uinput gamepad source; ensure /dev/uinput is enabled and writable: %w", err)
	}
	return nil
}

func closeGamepad() error {
	var closeErr error
	if linuxGamepad != nil {
		_ = linuxGamepad.LeftStickMove(0, 0)
		closeErr = linuxGamepad.Close()
		linuxGamepad = nil
	}
	if err := stopMoltenGamepad(); closeErr == nil {
		return err
	}
	return closeErr
}

func stopMoltenGamepad() error {
	if moltenGamepad == nil {
		removeMoltenGamepadConfig()
		return nil
	}
	_ = moltenGamepad.Process.Kill()
	err := <-moltenGamepadDone
	moltenGamepad = nil
	moltenGamepadDone = nil
	removeMoltenGamepadConfig()
	if err != nil {
		if _, ok := err.(*exec.ExitError); ok {
			return nil
		}
		return err
	}
	return nil
}

func removeMoltenGamepadConfig() {
	if moltenGamepadConfigDir != "" {
		_ = os.RemoveAll(moltenGamepadConfigDir)
		moltenGamepadConfigDir = ""
	}
}
