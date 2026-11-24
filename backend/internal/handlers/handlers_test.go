package handlers_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"dj-app-backend/internal/db"
	"dj-app-backend/internal/handlers"
	"dj-app-backend/internal/models"
	"dj-app-backend/internal/ws"
)

type mockStore struct {
	rooms    map[string]*models.Room
	requests map[int][]models.SongRequest
	nextID   int
}

func newMockStore() *mockStore {
	return &mockStore{
		rooms:    make(map[string]*models.Room),
		requests: make(map[int][]models.SongRequest),
		nextID:   1,
	}
}

func (m *mockStore) CreateRoom(ctx context.Context, code string) (*models.Room, error) {
	room := &models.Room{
		ID:        m.nextID,
		Code:      code,
		CreatedAt: time.Now(),
	}
	m.nextID++
	m.rooms[code] = room
	return room, nil
}

func (m *mockStore) GetRoomByCode(ctx context.Context, code string) (*models.Room, error) {
	room, exists := m.rooms[code]
	if !exists {
		return nil, db.ErrNotFound
	}
	return room, nil
}

func (m *mockStore) CreateSongRequest(ctx context.Context, roomID int, songText, guestName string) (*models.SongRequest, error) {
	req := models.SongRequest{
		ID:        m.nextID,
		RoomID:    roomID,
		SongText:  songText,
		GuestName: guestName,
		Status:    models.StatusPending,
		CreatedAt: time.Now(),
	}
	m.nextID++
	m.requests[roomID] = append([]models.SongRequest{req}, m.requests[roomID]...)
	return &req, nil
}

func (m *mockStore) GetRequestsByRoomID(ctx context.Context, roomID int) ([]models.SongRequest, error) {
	return m.requests[roomID], nil
}

func (m *mockStore) UpdateRequestStatus(ctx context.Context, roomID int, requestID int, status string) (*models.SongRequest, error) {
	reqList, exists := m.requests[roomID]
	if !exists {
		return nil, db.ErrNotFound
	}
	for i := range reqList {
		if reqList[i].ID == requestID {
			reqList[i].Status = status
			m.requests[roomID] = reqList
			return &reqList[i], nil
		}
	}
	return nil, db.ErrNotFound
}

func setupTestRouter() (*http.ServeMux, *mockStore) {
	store := newMockStore()
	hub := ws.NewHub()
	h := handlers.NewHandler(store, hub)

	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/rooms", h.CreateRoom)
	mux.HandleFunc("GET /api/rooms/{code}", h.GetRoom)
	mux.HandleFunc("POST /api/rooms/{code}/requests", h.CreateRequest)
	mux.HandleFunc("PATCH /api/rooms/{code}/requests/{id}", h.UpdateRequestStatus)

	return mux, store
}

func TestCreateRoom(t *testing.T) {
	mux, _ := setupTestRouter()

	req := httptest.NewRequest("POST", "/api/rooms", nil)
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected status 201, got %d", rec.Code)
	}

	var room models.Room
	if err := json.Unmarshal(rec.Body.Bytes(), &room); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if len(room.Code) != 4 {
		t.Errorf("expected 4-digit code, got %s", room.Code)
	}
}

func TestGetRoom(t *testing.T) {
	mux, store := setupTestRouter()
	room, _ := store.CreateRoom(context.Background(), "4829")

	// Test existing room
	req := httptest.NewRequest("GET", "/api/rooms/4829", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var details models.RoomDetailsResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &details); err != nil {
		t.Fatalf("failed to parse body: %v", err)
	}
	if details.Room.Code != room.Code {
		t.Errorf("expected code %s, got %s", room.Code, details.Room.Code)
	}

	// Test non-existing room
	req404 := httptest.NewRequest("GET", "/api/rooms/0000", nil)
	rec404 := httptest.NewRecorder()
	mux.ServeHTTP(rec404, req404)

	if rec404.Code != http.StatusNotFound {
		t.Errorf("expected 404 for unknown room, got %d", rec404.Code)
	}
}

func TestCreateSongRequest(t *testing.T) {
	mux, store := setupTestRouter()
	_, _ = store.CreateRoom(context.Background(), "4829")

	// Valid request
	body, _ := json.Marshal(map[string]string{
		"song_text":  "Daft Punk - One More Time",
		"guest_name": "Alex",
	})
	req := httptest.NewRequest("POST", "/api/rooms/4829/requests", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", rec.Code)
	}

	var created models.SongRequest
	_ = json.Unmarshal(rec.Body.Bytes(), &created)
	if created.SongText != "Daft Punk - One More Time" || created.GuestName != "Alex" {
		t.Errorf("unexpected created request: %+v", created)
	}

	// Empty song_text validation
	emptyBody, _ := json.Marshal(map[string]string{"song_text": "   "})
	reqBad := httptest.NewRequest("POST", "/api/rooms/4829/requests", bytes.NewBuffer(emptyBody))
	recBad := httptest.NewRecorder()
	mux.ServeHTTP(recBad, reqBad)

	if recBad.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for empty song_text, got %d", recBad.Code)
	}
}

func TestUpdateRequestStatus(t *testing.T) {
	mux, store := setupTestRouter()
	room, _ := store.CreateRoom(context.Background(), "4829")
	created, _ := store.CreateSongRequest(context.Background(), room.ID, "Song 1", "Guest")

	// Update to played
	body, _ := json.Marshal(map[string]string{"status": "played"})
	req := httptest.NewRequest("PATCH", "/api/rooms/4829/requests/2", bytes.NewBuffer(body))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", rec.Code, rec.Body.String())
	}

	var updated models.SongRequest
	_ = json.Unmarshal(rec.Body.Bytes(), &updated)
	if updated.Status != "played" {
		t.Errorf("expected status 'played', got %s", updated.Status)
	}

	// Invalid status
	badBody, _ := json.Marshal(map[string]string{"status": "invalid_status"})
	reqBad := httptest.NewRequest("PATCH", "/api/rooms/4829/requests/2", bytes.NewBuffer(badBody))
	recBad := httptest.NewRecorder()
	mux.ServeHTTP(recBad, reqBad)

	if recBad.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for invalid status, got %d", recBad.Code)
	}
	_ = created
}
