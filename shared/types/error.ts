/**
 * Standardized error response format
 */
export interface ErrorResponse {
  error: string;
  message?: string;
  code?: string;
}

export interface ApiError extends Error {
  status?: number;
  code?: string;
}
