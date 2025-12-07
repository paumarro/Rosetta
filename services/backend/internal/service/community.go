package service

import "context"

type CommunityService struct{}

func NewCommunityService() *CommunityService {
	return &CommunityService{}
}

// Future Enhancement:
// - Could be moved to configuration file, environment variable or DB if needed
// - Could be extended to include metadata (description, icon, color)
func (s *CommunityService) GetCommunities(ctx context.Context) []string {
	return []string{
		"Autonomous Systems",
		"Cloud and Backend",
		"Connectivity",
		"Cyber Security and Software Update",
		"Data Analytics and Data Science",
		"E2E Solution Architecture",
		"Embedded Software Connect",
		"Engineering Operations and Network Integration",
		"Frontends and Digital Experiences",
	}
}

// IsValidCommunity checks if a community name exists in the valid communities list
func (s *CommunityService) IsValidCommunity(ctx context.Context, name string) bool {
	validCommunities := s.GetCommunities(ctx)
	for _, community := range validCommunities {
		if community == name {
			return true
		}
	}
	return false
}
