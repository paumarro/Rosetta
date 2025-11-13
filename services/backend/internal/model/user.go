package model

import (
	"gorm.io/gorm"
)

type User struct {
	gorm.Model
	Name          string      `gorm:"size:100;not null"`
	Email         string      `gorm:"size:100;unique;not null"`
	EntraID       string      `gorm:"size:100;unique"`
	PhotoURL      string      `gorm:"type:text"`
	Skills        []UserSkill `gorm:"foreignKey:UserID"`
	LearningPaths []UserLP    `gorm:"foreignKey:UserID"`
}
