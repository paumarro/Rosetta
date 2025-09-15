package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type LearningPath struct {
	ID          uuid.UUID `gorm:"type:uuid;primaryKey"`
	Title       string    `gorm:"size:200;not null"`
	Description string    `gorm:"type:text"`
	IsPublic    bool      `gorm:"not null"`
	Thumbnail   string    `gorm:"type:text"`
	DiagramID   string    `gorm:"size:24;index:unique,unique_diagram_id;not null"` // MongoDB ObjectID
	Users       []UserLP  `gorm:"foreignKey:LPID"`
	Skills      []LPSkill `gorm:"foreignKey:LPID"`
	CreatedAt   time.Time
	UpdatedAt   time.Time
	DeletedAt   gorm.DeletedAt `gorm:"index"`
}
