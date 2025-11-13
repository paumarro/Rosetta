package model

import (
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type UserSkill struct {
	gorm.Model
	UserID  uint  `gorm:"not null"`
	SkillID uint  `gorm:"not null"`
	User    User  `gorm:"foreignKey:UserID"`
	Skill   Skill `gorm:"foreignKey:SkillID"`
}

type UserLP struct {
	gorm.Model
	UserID     uint         `gorm:"not null"`
	LPID       uuid.UUID    `gorm:"type:uuid;not null"`
	IsFavorite bool         `gorm:"default:false"`
	RoleID     *uint        `gorm:""`
	User       User         `gorm:"foreignKey:UserID"`
	LP         LearningPath `gorm:"foreignKey:LPID;references:ID"`
	Role       *Role        `gorm:"foreignKey:RoleID"`
}

type LPSkill struct {
	gorm.Model
	LPID    uuid.UUID    `gorm:"type:uuid;not null"`
	SkillID uint         `gorm:"not null"`
	LP      LearningPath `gorm:"foreignKey:LPID"`
	Skill   Skill        `gorm:"foreignKey:SkillID"`
}
