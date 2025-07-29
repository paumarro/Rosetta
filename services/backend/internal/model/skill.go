package model

import (
	"gorm.io/gorm"
)

type Skill struct {
	gorm.Model
	Name string `gorm:"size:100;not null"`
}