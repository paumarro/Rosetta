import type { ErrorResponse } from '../types/error';

/** Safely extracts error message from unknown error types */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error';
}

/** Parses API error response, falling back to status text if JSON parsing fails */
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
