package model

import (

	"gorm.io/gorm"
)


type Role struct {
	gorm.Model
	Name string `gorm:"size:50;unique;not null"` // e.g., 'AUTHOR', 'READER'
}
