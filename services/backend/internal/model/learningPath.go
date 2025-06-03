package model

import (
	"time"

	"gorm.io/gorm"
)

// nolint:unused
type LearningPath struct {
	gorm.Model
	Title       string
	Skill       string
	Date        *time.Time
	Description string
	isPublic    bool
	Image       string
	CreatorID    uint
	DiagramID   uint
}
