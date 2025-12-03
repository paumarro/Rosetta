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
		"Cloud & Backend",
		"Connectivity",
		"Cyber Security & Software Update",
		"Data Analytics and Data Science",
		"E2E Solutions Architecture",
		"Embedded Software Connect",
		"Engineering Operations and Network Integration",
		"Frontends & Digital Experiences",
	}
}
