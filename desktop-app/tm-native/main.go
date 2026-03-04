package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"sync"

	"github.com/go-vgo/robotgo"
)

type request struct {
	ID     int     `json:"id"`
	Cmd    string  `json:"cmd"`
	X      int     `json:"x,omitempty"`
	Y      int     `json:"y,omitempty"`
	Button string  `json:"button,omitempty"`
}

type response struct {
	ID    int    `json:"id"`
	OK    bool   `json:"ok"`
	Error string `json:"error,omitempty"`
	X     int    `json:"x,omitempty"`
	Y     int    `json:"y,omitempty"`
}

func main() {
	reader := bufio.NewScanner(os.Stdin)
	writer := bufio.NewWriter(os.Stdout)
	var writeMu sync.Mutex

	for reader.Scan() {
		line := reader.Bytes()
		if len(line) == 0 {
			continue
		}
		var req request
		if err := json.Unmarshal(line, &req); err != nil {
			writeError(&writeMu, writer, 0, fmt.Errorf("invalid JSON: %w", err))
			continue
		}

		switch req.Cmd {
		case "setMouseLocation":
			robotgo.Move(req.X, req.Y)
			writeOK(&writeMu, writer, req.ID, 0, 0)
		case "getMouseLocation":
			x, y := robotgo.Location()
			writeOK(&writeMu, writer, req.ID, x, y)
		case "click":
			button := req.Button
			if button == "" {
				button = "left"
			}
			if button == "middle" {
				button = "center"
			}
			robotgo.Click(button)
			writeOK(&writeMu, writer, req.ID, 0, 0)
		case "mouseDown":
			button := req.Button
			if button == "" {
				button = "left"
			}
			if button == "middle" {
				button = "center"
			}
			robotgo.Toggle(button)
			writeOK(&writeMu, writer, req.ID, 0, 0)
		case "mouseUp":
			button := req.Button
			if button == "" {
				button = "left"
			}
			if button == "middle" {
				button = "center"
			}
			robotgo.Toggle(button, "up")
			writeOK(&writeMu, writer, req.ID, 0, 0)
		case "ensureCursorVisible":
			ensureCursorVisible()
			writeOK(&writeMu, writer, req.ID, 0, 0)
		default:
			writeError(&writeMu, writer, req.ID, fmt.Errorf("unknown command: %s", req.Cmd))
		}
	}

	if err := reader.Err(); err != nil && err != io.EOF {
		fmt.Fprintln(os.Stderr, "tm-native: stdin error:", err)
	}
}

func writeOK(mu *sync.Mutex, w *bufio.Writer, id, x, y int) {
	resp := response{ID: id, OK: true, X: x, Y: y}
	writeResp(mu, w, resp)
}

func writeError(mu *sync.Mutex, w *bufio.Writer, id int, err error) {
	resp := response{ID: id, OK: false, Error: err.Error()}
	writeResp(mu, w, resp)
}

func writeResp(mu *sync.Mutex, w *bufio.Writer, resp response) {
	mu.Lock()
	defer mu.Unlock()
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		fmt.Fprintln(os.Stderr, "tm-native: failed to write response:", err)
		return
	}
	if err := w.Flush(); err != nil {
		fmt.Fprintln(os.Stderr, "tm-native: failed to flush response:", err)
	}
}
