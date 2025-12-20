/**
 * Unified LearningPath types - matches backend PascalCase format
 * Note: Field naming standardization (Phase 6) will be done separately
 */
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
  Community?: string;
  CreatedAt: string;
  UpdatedAt: string;
  DeletedAt?: string;
  Skills?: Skill[];
}
