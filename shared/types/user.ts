/**
 * Unified User type - matches backend PascalCase format
 * Note: Field naming standardization (Phase 6) will be done separately
 */
export interface User {
  ID: number;
  CreatedAt: string;
  UpdatedAt: string;
  DeletedAt: string | null;
  Name: string;
  Email: string;
  EntraID: string;
  PhotoURL: string;
  Community: string;
  IsAdmin: boolean;
}

export interface UpdateUserData {
  name?: string;
  photoURL?: string;
}
