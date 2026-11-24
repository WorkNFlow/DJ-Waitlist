package models

import "time"

const (
	StatusPending  = "pending"
	StatusPlayed   = "played"
	StatusRejected = "rejected"
)

// Room represents a DJ session room.
type Room struct {
	ID        int       `json:"id"`
	Code      string    `json:"code"`
	CreatedAt time.Time `json:"created_at"`
}

// SongRequest represents a guest request for a track in a room.
type SongRequest struct {
	ID        int       `json:"id"`
	RoomID    int       `json:"room_id"`
	SongText  string    `json:"song_text"`
	GuestName string    `json:"guest_name"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
}

// WSMessage represents a real-time message broadcasted to clients in a room.
type WSMessage struct {
	Type    string `json:"type"`
	Payload any    `json:"payload"`
}

// RoomDetailsResponse represents the response for GET /api/rooms/{code}.
type RoomDetailsResponse struct {
	Room     Room          `json:"room"`
	Requests []SongRequest `json:"requests"`
}

// CreateSongRequestInput represents the request payload for POST /api/rooms/{code}/requests.
type CreateSongRequestInput struct {
	SongText  string `json:"song_text"`
	GuestName string `json:"guest_name"`
}

// UpdateRequestStatusInput represents the request payload for PATCH /api/rooms/{code}/requests/{id}.
type UpdateRequestStatusInput struct {
	Status string `json:"status"`
}

// IsValidStatus validates if the provided status string is supported.
func IsValidStatus(status string) bool {
	switch status {
	case StatusPending, StatusPlayed, StatusRejected:
		return true
	default:
		return false
	}
}
