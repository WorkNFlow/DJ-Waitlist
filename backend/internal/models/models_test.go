package models_test

import (
	"testing"

	"dj-app-backend/internal/models"
)

func TestIsValidStatus(t *testing.T) {
	tests := []struct {
		status string
		valid  bool
	}{
		{models.StatusPending, true},
		{models.StatusPlayed, true},
		{models.StatusRejected, true},
		{"unknown", false},
		{"", false},
		{"PENDING", false},
	}

	for _, tt := range tests {
		t.Run(tt.status, func(t *testing.T) {
			if got := models.IsValidStatus(tt.status); got != tt.valid {
				t.Errorf("IsValidStatus(%q) = %v, want %v", tt.status, got, tt.valid)
			}
		})
	}
}
