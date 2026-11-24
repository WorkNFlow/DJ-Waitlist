package handlers

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"strconv"
	"strings"
	"time"

	"dj-app-backend/internal/db"
	"dj-app-backend/internal/models"
	"dj-app-backend/internal/ws"

	"github.com/gorilla/websocket"
)

// Store defines the database storage interface needed by handlers.
type Store interface {
	CreateRoom(ctx context.Context, code string) (*models.Room, error)
	GetRoomByCode(ctx context.Context, code string) (*models.Room, error)
	CreateSongRequest(ctx context.Context, roomID int, songText, guestName string) (*models.SongRequest, error)
	GetRequestsByRoomID(ctx context.Context, roomID int) ([]models.SongRequest, error)
	UpdateRequestStatus(ctx context.Context, roomID int, requestID int, status string) (*models.SongRequest, error)
}

type Handler struct {
	store Store
	hub   *ws.Hub
}

func NewHandler(store Store, hub *ws.Hub) *Handler {
	return &Handler{
		store: store,
		hub:   hub,
	}
}

// writeJSON writes a standard JSON response.
func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(data); err != nil {
		log.Printf("[HTTP] Failed to write JSON response: %v", err)
	}
}

// writeError writes a standard JSON error response.
func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

// generateRoomCode generates a 4-digit numeric string (1000 - 9999).
func generateRoomCode() (string, error) {
	// Range: 0 to 8999, plus 1000 => 1000..9999
	nBig, err := rand.Int(rand.Reader, big.NewInt(9000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%04d", nBig.Int64()+1000), nil
}

// CreateRoom handles POST /api/rooms
func (h *Handler) CreateRoom(w http.ResponseWriter, r *http.Request) {
	var room *models.Room
	var err error

	// Try generating a unique 4-digit code (up to 5 attempts)
	for i := 0; i < 5; i++ {
		code, genErr := generateRoomCode()
		if genErr != nil {
			log.Printf("[HTTP] Error generating room code: %v", genErr)
			writeError(w, http.StatusInternalServerError, "Failed to generate room code")
			return
		}

		room, err = h.store.CreateRoom(r.Context(), code)
		if err == nil {
			break
		}
	}

	if err != nil {
		log.Printf("[HTTP] Failed to create room: %v", err)
		writeError(w, http.StatusInternalServerError, "Failed to create room")
		return
	}

	writeJSON(w, http.StatusCreated, room)
}

// GetRoom handles GET /api/rooms/{code}
func (h *Handler) GetRoom(w http.ResponseWriter, r *http.Request) {
	code := strings.TrimSpace(r.PathValue("code"))
	if code == "" {
		writeError(w, http.StatusBadRequest, "Room code is required")
		return
	}

	room, err := h.store.GetRoomByCode(r.Context(), code)
	if err != nil {
		if errors.Is(err, db.ErrNotFound) {
			writeError(w, http.StatusNotFound, "Room not found")
			return
		}
		log.Printf("[HTTP] Error fetching room %s: %v", code, err)
		writeError(w, http.StatusInternalServerError, "Failed to fetch room")
		return
	}

	requests, err := h.store.GetRequestsByRoomID(r.Context(), room.ID)
	if err != nil {
		log.Printf("[HTTP] Error fetching requests for room %s: %v", code, err)
		writeError(w, http.StatusInternalServerError, "Failed to fetch room requests")
		return
	}

	writeJSON(w, http.StatusOK, models.RoomDetailsResponse{
		Room:     *room,
		Requests: requests,
	})
}

// CreateRequest handles POST /api/rooms/{code}/requests
func (h *Handler) CreateRequest(w http.ResponseWriter, r *http.Request) {
	code := strings.TrimSpace(r.PathValue("code"))
	if code == "" {
		writeError(w, http.StatusBadRequest, "Room code is required")
		return
	}

	room, err := h.store.GetRoomByCode(r.Context(), code)
	if err != nil {
		if errors.Is(err, db.ErrNotFound) {
			writeError(w, http.StatusNotFound, "Room not found")
			return
		}
		log.Printf("[HTTP] Error fetching room %s: %v", code, err)
		writeError(w, http.StatusInternalServerError, "Failed to fetch room")
		return
	}

	var input models.CreateSongRequestInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	songText := strings.TrimSpace(input.SongText)
	if songText == "" {
		writeError(w, http.StatusBadRequest, "song_text is required")
		return
	}
	if len(songText) > 500 {
		writeError(w, http.StatusBadRequest, "song_text is too long (max 500 characters)")
		return
	}

	guestName := strings.TrimSpace(input.GuestName)
	if len(guestName) > 50 {
		guestName = guestName[:50]
	}

	songReq, err := h.store.CreateSongRequest(r.Context(), room.ID, songText, guestName)
	if err != nil {
		log.Printf("[HTTP] Error creating song request: %v", err)
		writeError(w, http.StatusInternalServerError, "Failed to save song request")
		return
	}

	// Real-time broadcast to all connected WebSocket clients in this room
	h.hub.Broadcast(code, models.WSMessage{
		Type:    "new_request",
		Payload: songReq,
	})

	writeJSON(w, http.StatusCreated, songReq)
}

// UpdateRequestStatus handles PATCH /api/rooms/{code}/requests/{id}
func (h *Handler) UpdateRequestStatus(w http.ResponseWriter, r *http.Request) {
	code := strings.TrimSpace(r.PathValue("code"))
	if code == "" {
		writeError(w, http.StatusBadRequest, "Room code is required")
		return
	}

	idStr := r.PathValue("id")
	reqID, err := strconv.Atoi(idStr)
	if err != nil || reqID <= 0 {
		writeError(w, http.StatusBadRequest, "Invalid request id")
		return
	}

	room, err := h.store.GetRoomByCode(r.Context(), code)
	if err != nil {
		if errors.Is(err, db.ErrNotFound) {
			writeError(w, http.StatusNotFound, "Room not found")
			return
		}
		log.Printf("[HTTP] Error fetching room %s: %v", code, err)
		writeError(w, http.StatusInternalServerError, "Failed to fetch room")
		return
	}

	var input models.UpdateRequestStatusInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	status := strings.TrimSpace(input.Status)
	if !models.IsValidStatus(status) {
		writeError(w, http.StatusBadRequest, "Invalid status: must be 'pending', 'played', or 'rejected'")
		return
	}

	updatedReq, err := h.store.UpdateRequestStatus(r.Context(), room.ID, reqID, status)
	if err != nil {
		if errors.Is(err, db.ErrNotFound) {
			writeError(w, http.StatusNotFound, "Song request not found in this room")
			return
		}
		log.Printf("[HTTP] Error updating song request %d: %v", reqID, err)
		writeError(w, http.StatusInternalServerError, "Failed to update song request")
		return
	}

	// Real-time broadcast status change so other connected views stay in sync
	h.hub.Broadcast(code, models.WSMessage{
		Type:    "status_updated",
		Payload: updatedReq,
	})

	writeJSON(w, http.StatusOK, updatedReq)
}

// ServeWS handles GET /ws/{code}
func (h *Handler) ServeWS(w http.ResponseWriter, r *http.Request) {
	code := strings.TrimSpace(r.PathValue("code"))
	if code == "" {
		writeError(w, http.StatusBadRequest, "Room code is required")
		return
	}

	// Verify room exists before upgrading
	_, err := h.store.GetRoomByCode(r.Context(), code)
	if err != nil {
		if errors.Is(err, db.ErrNotFound) {
			writeError(w, http.StatusNotFound, "Room not found")
			return
		}
		log.Printf("[WS] Error verifying room %s: %v", code, err)
		writeError(w, http.StatusInternalServerError, "Failed to verify room")
		return
	}

	conn, err := ws.Upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[WS] Failed to upgrade connection for room %s: %v", code, err)
		return
	}

	h.hub.Register(code, conn)
	defer h.hub.Unregister(code, conn)

	// Set initial read deadline and handle pong responses
	conn.SetReadLimit(4096)
	_ = conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	conn.SetPongHandler(func(string) error {
		_ = conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	// Periodic ping ticker to keep WebSocket connections open through proxies
	ticker := time.NewTicker(25 * time.Second)
	defer ticker.Stop()

	done := make(chan struct{})
	go func() {
		defer close(done)
		for {
			_, _, readErr := conn.ReadMessage()
			if readErr != nil {
				break
			}
		}
	}()

	for {
		select {
		case <-done:
			return
		case <-ticker.C:
			_ = conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
