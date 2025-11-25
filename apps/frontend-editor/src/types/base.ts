export interface BaseEntity {
  createdAt: string;
  updatedAt: string;
}

export interface BaseStore {
  isLoading: boolean;
  error: string | null;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}
