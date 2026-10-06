package main

import (
	"math"
	"testing"
)

func TestClampAxis(t *testing.T) {
	tests := []struct {
		input float64
		want  float64
	}{
		{input: -2, want: -1},
		{input: -0.5, want: -0.5},
		{input: 0, want: 0},
		{input: 0.5, want: 0.5},
		{input: 2, want: 1},
	}
	for _, test := range tests {
		if got := clampAxis(test.input); got != test.want {
			t.Errorf("clampAxis(%v) = %v, want %v", test.input, got, test.want)
		}
	}
}

func TestFloatParam(t *testing.T) {
	tests := []struct {
		name    string
		params  map[string]interface{}
		want    float64
		wantErr bool
	}{
		{name: "valid number", params: map[string]interface{}{"x": 0.25}, want: 0.25},
		{name: "missing params", wantErr: true},
		{name: "missing value", params: map[string]interface{}{}, wantErr: true},
		{name: "wrong type", params: map[string]interface{}{"x": "0.25"}, wantErr: true},
		{name: "not a number", params: map[string]interface{}{"x": math.NaN()}, wantErr: true},
		{name: "infinite", params: map[string]interface{}{"x": math.Inf(1)}, wantErr: true},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, err := floatParam(test.params, "x")
			if (err != nil) != test.wantErr {
				t.Fatalf("floatParam() error = %v, wantErr %v", err, test.wantErr)
			}
			if err == nil && got != test.want {
				t.Errorf("floatParam() = %v, want %v", got, test.want)
			}
		})
	}
}
