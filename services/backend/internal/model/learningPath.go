package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type LearningPath struct {
	ID          uuid.UUID      `gorm:"type:uuid;primaryKey" json:"ID"`
	Title       string         `gorm:"size:200;not null" json:"Title"`
	Description string         `gorm:"type:text" json:"Description"`
	IsPublic    bool           `gorm:"not null" json:"IsPublic"`
	Thumbnail   string         `gorm:"type:text" json:"Thumbnail"`
	DiagramID   string         `gorm:"size:24;index:unique,unique_diagram_id;not null" json:"DiagramID"` // MongoDB ObjectID
	Users       []UserLP       `gorm:"foreignKey:LPID" json:"Users,omitempty"`
	Skills      []LPSkill      `gorm:"foreignKey:LPID" json:"-"`  // Don't serialize join table
	SkillsList  []Skill        `gorm:"-" json:"Skills,omitempty"` // Custom field for serialized skills
	CreatedAt   time.Time      `json:"CreatedAt"`
	UpdatedAt   time.Time      `json:"UpdatedAt"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"DeletedAt,omitempty"`
}
