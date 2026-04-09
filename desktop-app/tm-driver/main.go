package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"os"

	"github.com/go-vgo/robotgo"
)

const defaultListenAddr = "127.0.0.1:47047"

type request struct {
	ID     int                    `json:"id"`
	Method string                 `json:"method"`
	Params map[string]interface{} `json:"params"`
}

type response struct {
	ID     int         `json:"id"`
	Result interface{} `json:"result,omitempty"`
	Error  string      `json:"error,omitempty"`
}

type mousePosition struct {
	X int `json:"x"`
	Y int `json:"y"`
}

func main() {
	if len(os.Args) > 1 && os.Args[1] == "--stdio" {
		if err := serveStream(os.Stdin, os.Stdout); err != nil {
			fmt.Fprintf(os.Stderr, "stdio server error: %v\n", err)
		}
		return
	}

	listenAddr := os.Getenv("TM_DRIVER_ADDR")
	if listenAddr == "" {
		listenAddr = defaultListenAddr
	}

	listener, err := net.Listen("tcp", listenAddr)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to listen on %s: %v\n", listenAddr, err)
		os.Exit(1)
	}
	defer listener.Close()

	fmt.Fprintf(os.Stderr, "tm-driver daemon listening on %s\n", listenAddr)

	for {
		conn, err := listener.Accept()
		if err != nil {
			fmt.Fprintf(os.Stderr, "accept error: %v\n", err)
			continue
		}

		go func(c net.Conn) {
			defer c.Close()
			if err := serveStream(c, c); err != nil {
				fmt.Fprintf(os.Stderr, "connection error: %v\n", err)
			}
		}(conn)
	}
}

func serveStream(input io.Reader, output io.Writer) error {
	scanner := bufio.NewScanner(input)
	writer := bufio.NewWriter(output)
	defer writer.Flush()

	for scanner.Scan() {
		line := scanner.Bytes()
		var req request
		if err := json.Unmarshal(line, &req); err != nil {
			_ = writeResponse(writer, response{Error: fmt.Sprintf("invalid JSON request: %v", err)})
			continue
		}
		resp := handleRequest(req)
		if err := writeResponse(writer, resp); err != nil {
			return fmt.Errorf("failed to write response: %w", err)
		}
	}

	if err := scanner.Err(); err != nil {
		return fmt.Errorf("scanner error: %w", err)
	}

	return nil
}

func writeResponse(writer *bufio.Writer, resp response) error {
	bytes, err := json.Marshal(resp)
	if err != nil {
		return err
	}
	if _, err := writer.Write(bytes); err != nil {
		return err
	}
	if err := writer.WriteByte('\n'); err != nil {
		return err
	}
	return writer.Flush()
}

func handleRequest(req request) response {
	resp := response{ID: req.ID}
	switch req.Method {
	case "setMouseLocation":
		x, err := intParam(req.Params, "x")
		if err != nil {
			resp.Error = err.Error()
			return resp
		}
		y, err := intParam(req.Params, "y")
		if err != nil {
			resp.Error = err.Error()
			return resp
		}
		robotgo.Move(x, y)
		resp.Result = map[string]bool{"ok": true}
		return resp
	case "ping":
		resp.Result = map[string]bool{"ok": true}
		return resp
	case "getMouseLocation":
		x, y := robotgo.GetMousePos()
		resp.Result = mousePosition{X: x, Y: y}
		return resp
	case "click":
		button, err := buttonParam(req.Params)
		if err != nil {
			resp.Error = err.Error()
			return resp
		}
		robotgo.Click(button, false)
		resp.Result = map[string]bool{"ok": true}
		return resp
	case "mouseDown":
		button, err := buttonParam(req.Params)
		if err != nil {
			resp.Error = err.Error()
			return resp
		}
		robotgo.Toggle(button, "down")
		resp.Result = map[string]bool{"ok": true}
		return resp
	case "mouseUp":
		button, err := buttonParam(req.Params)
		if err != nil {
			resp.Error = err.Error()
			return resp
		}
		robotgo.Toggle(button, "up")
		resp.Result = map[string]bool{"ok": true}
		return resp
	default:
		resp.Error = fmt.Sprintf("unsupported method: %s", req.Method)
		return resp
	}
}

func intParam(params map[string]interface{}, key string) (int, error) {
	if params == nil {
		return 0, fmt.Errorf("missing params")
	}
	value, ok := params[key]
	if !ok {
		return 0, fmt.Errorf("missing param: %s", key)
	}
	number, ok := value.(float64)
	if !ok {
		return 0, fmt.Errorf("param %s must be a number", key)
	}
	return int(number), nil
}

func buttonParam(params map[string]interface{}) (string, error) {
	if params == nil {
		return "", fmt.Errorf("missing params")
	}
	value, ok := params["button"]
	if !ok {
		return "", fmt.Errorf("missing param: button")
	}
	button, ok := value.(string)
	if !ok {
		return "", fmt.Errorf("param button must be a string")
	}
	switch button {
	case "left", "right", "middle":
		return button, nil
	default:
		return "", fmt.Errorf("invalid button: %s", button)
	}
}
