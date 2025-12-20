/**
 * Standardized error response format
 * Matches shared types for consistency
 */
export interface ErrorResponse {
  error: string;
  message?: string;
  code?: string;
}
