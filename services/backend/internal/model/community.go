package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Community struct {
	ID          uuid.UUID      `gorm:"type:uuid;primaryKey" json:"ID"`
	Name        string         `gorm:"size:200;not null" json:"Title"`
	Description string         `gorm:"type:text" json:"Description"`
	CreatedAt   time.Time      `json:"CreatedAt"`
	UpdatedAt   time.Time      `json:"UpdatedAt"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"DeletedAt,omitempty"`
}
