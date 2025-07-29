package model

import (
	"gorm.io/gorm"
)

type UserSkill struct {
	gorm.Model
	UserID  uint `gorm:"not null"`
	SkillID uint `gorm:"not null"`
	User    User `gorm:"foreignKey:UserID"`
	Skill   Skill `gorm:"foreignKey:SkillID"`
}

type UserLP struct {
	gorm.Model
	UserID uint   `gorm:"not null"`
	LPID   uint   `gorm:"not null"`
	RoleID uint   `gorm:"not null"`
	User   User   `gorm:"foreignKey:UserID"`
	LP     LearningPath `gorm:"foreignKey:LPID"`
	Role   Role   `gorm:"foreignKey:RoleID"`
}

type LPSkill struct {
	gorm.Model
	LPID    uint `gorm:"not null"`
	SkillID uint `gorm:"not null"`
	LP      LearningPath `gorm:"foreignKey:LPID"`
	Skill   Skill `gorm:"foreignKey:SkillID"`
}