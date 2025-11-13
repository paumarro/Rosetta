export interface Skill {
  ID: string;
  Name: string;
}

export interface LearningPath {
  ID: string;
  Title: string;
  Description: string;
  IsPublic: boolean;
  Thumbnail: string;
  DiagramID: string;
  CreatedAt: string;
  UpdatedAt: string;
  DeletedAt?: string;
  Skills?: Skill[];
}

export interface LearningPathStore {
  learningPaths: LearningPath[];
  favorites: LearningPath[];
  isLoading: boolean;
  error: string | null;
  fetchLearningPaths: () => Promise<void>;
  fetchUserFavorites: () => Promise<void>;
  addToFavorites: (id: string) => Promise<void>;
  removeFromFavorites: (id: string) => Promise<void>;
  isFavorited: (id: string) => boolean;
  deleteLearningPath: (id: string) => Promise<void>;
  setError: (error: string | null) => void;
}
