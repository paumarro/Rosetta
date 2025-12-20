import type { ErrorResponse } from '../types/error';

/**
 * Extract error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error';
}

/**
 * Parse error response from API
 */
export async function parseErrorResponse(
  response: Response,
): Promise<string> {
  try {
    const data = (await response.json()) as ErrorResponse;
    return data.message || data.error || `Error: ${response.status}`;
  } catch {
    return `Error: ${response.status} ${response.statusText}`;
  }
}
