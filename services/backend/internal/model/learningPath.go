package model

import (
	"gorm.io/gorm"
)

type LearningPath struct {
	gorm.Model
	Title       string    `gorm:"size:200;not null"`
	Description string    `gorm:"type:text"`
	IsPublic    bool      `gorm:"not null"`
	Thumbnail   string    `gorm:"type:text"`
	DiagramID   string    `gorm:"size:24;not null"` // MongoDB ObjectID
	Users       []UserLP  `gorm:"foreignKey:LPID"`
	Skills      []LPSkill `gorm:"foreignKey:LPID"`
}
