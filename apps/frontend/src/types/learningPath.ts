// Re-export shared types
export type { Skill, LearningPath } from '@shared/types';

export interface LearningPathStore {
  learningPaths: LearningPath[];
  favorites: LearningPath[];
  isLoading: boolean;
  error: string | null;
  recentlyViewed: LearningPath[];

  fetchRecentlyViewed: () => void;
  fetchLearningPaths: () => Promise<void>;
  fetchLearningPathsByCommunity: (communityName: string) => Promise<LearningPath[]>;
  fetchUserFavorites: () => Promise<void>;
  addToFavorites: (id: string) => Promise<void>;
  removeFromFavorites: (id: string) => Promise<void>;
  isFavorited: (id: string) => boolean;
  deleteLearningPath: (id: string) => Promise<void>;
  setError: (error: string | null) => void;
}
