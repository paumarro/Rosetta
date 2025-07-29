package model

import (
	"gorm.io/gorm"
)

type User struct {
	gorm.Model
	Name         string       `gorm:"size:100;not null"`
	Email        string       `gorm:"size:100;unique;not null"`
	Skills       []UserSkill  `gorm:"foreignKey:UserID"`
	LearningPaths []UserLP    `gorm:"foreignKey:UserID"`
}
