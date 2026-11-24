package db

import (
	"context"
	"errors"
	"fmt"
	"time"

	"dj-app-backend/internal/models"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotFound = errors.New("resource not found")
)

type Store struct {
	pool *pgxpool.Pool
}

func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

// Connect initializes a connection pool to the PostgreSQL database.
func Connect(ctx context.Context, connString string) (*pgxpool.Pool, error) {
	config, err := pgxpool.ParseConfig(connString)
	if err != nil {
		return nil, fmt.Errorf("failed to parse database config: %w", err)
	}

	config.MaxConns = 15
	config.MinConns = 2
	config.MaxConnLifetime = 1 * time.Hour
	config.MaxConnIdleTime = 30 * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("failed to create connection pool: %w", err)
	}

	// Ping database with timeout
	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return pool, nil
}

// InitSchema creates necessary tables and indexes if they do not exist.
func InitSchema(ctx context.Context, pool *pgxpool.Pool) error {
	schema := `
	CREATE TABLE IF NOT EXISTS rooms (
		id SERIAL PRIMARY KEY,
		code VARCHAR(10) UNIQUE NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS song_requests (
		id SERIAL PRIMARY KEY,
		room_id INT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
		song_text TEXT NOT NULL,
		guest_name VARCHAR(50) DEFAULT '',
		status VARCHAR(20) NOT NULL DEFAULT 'pending',
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code);
	CREATE INDEX IF NOT EXISTS idx_song_requests_room_id ON song_requests(room_id);
	`

	_, err := pool.Exec(ctx, schema)
	if err != nil {
		return fmt.Errorf("failed to initialize schema: %w", err)
	}

	return nil
}

// CreateRoom inserts a new room with the specified code.
func (s *Store) CreateRoom(ctx context.Context, code string) (*models.Room, error) {
	query := `
		INSERT INTO rooms (code, created_at)
		VALUES ($1, CURRENT_TIMESTAMP)
		RETURNING id, code, created_at;
	`
	var room models.Room
	err := s.pool.QueryRow(ctx, query, code).Scan(&room.ID, &room.Code, &room.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to create room: %w", err)
	}

	return &room, nil
}

// GetRoomByCode retrieves a room by its code.
func (s *Store) GetRoomByCode(ctx context.Context, code string) (*models.Room, error) {
	query := `
		SELECT id, code, created_at
		FROM rooms
		WHERE code = $1;
	`
	var room models.Room
	err := s.pool.QueryRow(ctx, query, code).Scan(&room.ID, &room.Code, &room.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("failed to get room: %w", err)
	}

	return &room, nil
}

// CreateSongRequest inserts a new song request for a room.
func (s *Store) CreateSongRequest(ctx context.Context, roomID int, songText, guestName string) (*models.SongRequest, error) {
	query := `
		INSERT INTO song_requests (room_id, song_text, guest_name, status, created_at)
		VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
		RETURNING id, room_id, song_text, guest_name, status, created_at;
	`
	var req models.SongRequest
	err := s.pool.QueryRow(ctx, query, roomID, songText, guestName, models.StatusPending).
		Scan(&req.ID, &req.RoomID, &req.SongText, &req.GuestName, &req.Status, &req.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to create song request: %w", err)
	}

	return &req, nil
}

// GetRequestsByRoomID retrieves all song requests for a given room sorted newest first.
func (s *Store) GetRequestsByRoomID(ctx context.Context, roomID int) ([]models.SongRequest, error) {
	query := `
		SELECT id, room_id, song_text, guest_name, status, created_at
		FROM song_requests
		WHERE room_id = $1
		ORDER BY created_at DESC;
	`
	rows, err := s.pool.Query(ctx, query, roomID)
	if err != nil {
		return nil, fmt.Errorf("failed to query song requests: %w", err)
	}
	defer rows.Close()

	requests := make([]models.SongRequest, 0)
	for rows.Next() {
		var req models.SongRequest
		err := rows.Scan(&req.ID, &req.RoomID, &req.SongText, &req.GuestName, &req.Status, &req.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan song request: %w", err)
		}
		requests = append(requests, req)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows error: %w", err)
	}

	return requests, nil
}

// UpdateRequestStatus updates the status of a specific song request in a room.
func (s *Store) UpdateRequestStatus(ctx context.Context, roomID int, requestID int, status string) (*models.SongRequest, error) {
	query := `
		UPDATE song_requests
		SET status = $1
		WHERE id = $2 AND room_id = $3
		RETURNING id, room_id, song_text, guest_name, status, created_at;
	`
	var req models.SongRequest
	err := s.pool.QueryRow(ctx, query, status, requestID, roomID).
		Scan(&req.ID, &req.RoomID, &req.SongText, &req.GuestName, &req.Status, &req.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("failed to update song request status: %w", err)
	}

	return &req, nil
}
