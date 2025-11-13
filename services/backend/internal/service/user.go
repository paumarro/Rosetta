// BE/internal/service/user.go
package service

import (
	"errors"

	"dev.azure.com/carbyte/Carbyte-Academy/_git/Carbyte-Academy-Backend/internal/model"
	"gorm.io/gorm"
)

type UserService struct {
	DB *gorm.DB
}

func NewUserService(db *gorm.DB) *UserService {
	return &UserService{DB: db}
}

// GetUserByEntraID finds a user by their Microsoft Entra ID
func (s *UserService) GetUserByEntraID(entraID string) (*model.User, error) {
	if entraID == "" {
		return nil, errors.New("entraID is required")
	}

	var user model.User
	err := s.DB.Where("entra_id = ?", entraID).First(&user).Error
	if err != nil {
		return nil, err
	}

	return &user, nil
}

// GetOrCreateUser finds or creates a user based on JWT claims
func (s *UserService) GetOrCreateUser(claims map[string]interface{}) (*model.User, error) {
	email, _ := claims["email"].(string)
	name, _ := claims["name"].(string)
	entraID, _ := claims["oid"].(string) // Object ID from Microsoft Entra

	if email == "" || entraID == "" {
		return nil, errors.New("missing required claims: email or oid")
	}

	var user model.User

	// Try to find by EntraID first (more reliable)
	err := s.DB.Where("entra_id = ?", entraID).First(&user).Error

	if err == gorm.ErrRecordNotFound {
		// User doesn't exist, create new one
		user = model.User{
			Name:    name,
			Email:   email,
			EntraID: entraID,
		}
		if err := s.DB.Create(&user).Error; err != nil {
			return nil, err
		}
	} else if err != nil {
		return nil, err
	} else {
		// User exists, update info if changed
		if user.Name != name || user.Email != email {
			user.Name = name
			user.Email = email
			s.DB.Save(&user)
		}
	}

	return &user, nil
}

// UpdateUser updates allowed user fields
func (s *UserService) UpdateUser(userID uint, updates map[string]interface{}) (*model.User, error) {
	var user model.User

	// Find the user first
	if err := s.DB.First(&user, userID).Error; err != nil {
		return nil, err
	}

	// Only allow updating specific fields
	allowedFields := map[string]bool{
		"name":      true,
		"photo_url": true,
	}

	// Filter updates to only allowed fields
	filteredUpdates := make(map[string]interface{})
	for key, value := range updates {
		if allowedFields[key] {
			filteredUpdates[key] = value
		}
	}

	// Update the user
	if err := s.DB.Model(&user).Updates(filteredUpdates).Error; err != nil {
		return nil, err
	}

	return &user, nil
}
