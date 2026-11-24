package cleaner

import (
	"context"
	"time"
)

// RoomCleanerStore defines the database storage interface needed by the cleaner.
type RoomCleanerStore interface {
	CleanExpiredRooms(ctx context.Context, maxAge time.Duration) (int64, error)
}

// Config holds configuration parameters for the room cleaner worker.
type Config struct {
	Interval time.Duration
	TTL      time.Duration
}
