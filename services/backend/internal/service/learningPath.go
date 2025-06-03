package service

import (
	"dev.azure.com/carbyte/Carbyte-Academy/_git/Carbyte-Academy-Backend/internal/model"
	"gorm.io/gorm"
)

type LearningPathService struct {
	DB *gorm.DB
}

func NewLearningPathService(db *gorm.DB) *LearningPathService {
	return &LearningPathService{
		DB: db,
	}
}
func (s *LearningPathService) GetLearningPaths() ([]model.LearningPath, error) {
	var paths []model.LearningPath
	if err := s.DB.Preload("Courses").Find(&paths).Error; err != nil {
		return nil, err
	}
	return paths, nil
}
