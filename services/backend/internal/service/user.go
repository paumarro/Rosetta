// BE/internal/service/user.go
package service

import (
	"context"
	"errors"
	"log"
	"os"
	"strconv"
	"strings"
	"time"

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
func (s *UserService) GetOrCreateUser(claims map[string]interface{}, graphService *GraphService, accessToken string) (*model.User, error) {
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

		// Fetch user groups and determine community for new users
		if graphService != nil && accessToken != "" {
			log.Printf("🆕 New user '%s' - fetching community from Graph API", email)
			community, err := s.determineCommunityFromGroups(graphService, accessToken)
			if err == nil && community != "" {
				user.Community = community
				log.Printf("✅ Set community '%s' for new user '%s'", community, email)
			} else {
				log.Printf("⚠️  No community determined for new user '%s'", email)
			}
			// Set LastGraphSync timestamp
			now := time.Now()
			user.LastGraphSync = &now
		}

		if err := s.DB.Create(&user).Error; err != nil {
			return nil, err
		}
	} else if err != nil {
		return nil, err
	} else {
		// User exists, update info if changed
		shouldUpdate := false
		if user.Name != name || user.Email != email {
			user.Name = name
			user.Email = email
			shouldUpdate = true
		}

		// Update community only if data is stale
		if graphService != nil && accessToken != "" && s.shouldUpdateFromGraph(&user) {
			log.Printf("🔄 User %s graph data is stale, fetching from Graph API", user.Email)
			community, err := s.determineCommunityFromGroups(graphService, accessToken)
			if err == nil {
				if community != "" && user.Community != community {
					log.Printf("🔄 Updating community for '%s': '%s' → '%s'", user.Email, user.Community, community)
					user.Community = community
					shouldUpdate = true
				} else if community != "" {
					log.Printf("✅ Community unchanged for '%s': '%s'", user.Email, user.Community)
				} else {
					log.Printf("⚠️  No community determined for '%s' (currently: '%s')", user.Email, user.Community)
				}
				// Update LastGraphSync timestamp
				now := time.Now()
				user.LastGraphSync = &now
				shouldUpdate = true
			} else {
				log.Printf("❌ Error determining community for '%s': %v", user.Email, err)
			}
		} else if graphService != nil && accessToken != "" {
			log.Printf("✅ User %s graph data is fresh (community: '%s'), skipping Graph API call", user.Email, user.Community)
		}

		if shouldUpdate {
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
		"community": true,
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

// shouldUpdateFromGraph checks if user data should be refreshed from Graph API
func (s *UserService) shouldUpdateFromGraph(user *model.User) bool {
	if user.LastGraphSync == nil {
		return true // Never synced before
	}

	// Get staleness threshold from environment (default 24 hours)
	staleHoursStr := os.Getenv("GRAPH_SYNC_INTERVAL_HOURS")
	staleHours := 24 // default
	if staleHoursStr != "" {
		if hours, err := strconv.Atoi(staleHoursStr); err == nil && hours > 0 {
			staleHours = hours
		}
	}

	staleThreshold := time.Duration(staleHours) * time.Hour
	return time.Since(*user.LastGraphSync) > staleThreshold
}

// determineCommunityFromGroups fetches user groups and maps them to a community name
func (s *UserService) determineCommunityFromGroups(graphService *GraphService, accessToken string) (string, error) {
	ctx := context.Background()
	log.Println("========== FETCHING USER GROUPS FROM GRAPH API ==========")

	groups, err := graphService.GetUserGroups(ctx, accessToken)
	if err != nil {
		log.Printf("❌ Failed to fetch user groups: %v", err)
		return "", err
	}

	log.Printf("✅ Fetched %d groups from Graph API", len(groups))
	for i, group := range groups {
		log.Printf("   Group #%d: %s (ID: %s)", i+1, group.DisplayName, group.ID)
	}

	// Get community group mappings from environment
	// Format: GROUP_ID_1:CommunityName1,GROUP_ID_2:CommunityName2
	communityMappings := os.Getenv("COMMUNITY_GROUP_MAPPINGS")
	log.Printf("📋 COMMUNITY_GROUP_MAPPINGS env var: '%s'", communityMappings)

	if communityMappings == "" {
		log.Println("⚠️  No COMMUNITY_GROUP_MAPPINGS configured - cannot map groups to communities")
		return "", nil
	}

	// Parse the mappings
	mappingPairs := strings.Split(communityMappings, ",")
	groupToCommunity := make(map[string]string)
	log.Printf("📋 Parsing %d mapping pairs", len(mappingPairs))
	for i, pair := range mappingPairs {
		parts := strings.Split(strings.TrimSpace(pair), ":")
		if len(parts) == 2 {
			groupID := strings.TrimSpace(parts[0])
			communityName := strings.TrimSpace(parts[1])
			groupToCommunity[groupID] = communityName
			log.Printf("   Mapping #%d: Group %s → Community '%s'", i+1, groupID, communityName)
		} else {
			log.Printf("   ⚠️  Invalid mapping format: '%s'", pair)
		}
	}

	// Find the first matching group
	log.Println("🔍 Searching for matching groups...")
	for _, group := range groups {
		if communityName, exists := groupToCommunity[group.ID]; exists {
			log.Printf("✅ MATCH FOUND! User assigned to community '%s' via group '%s' (%s)", communityName, group.DisplayName, group.ID)
			log.Println("==========================================================")
			return communityName, nil
		}
	}

	log.Println("⚠️  User is not in any configured community groups")
	log.Println("==========================================================")
	return "", nil
}
