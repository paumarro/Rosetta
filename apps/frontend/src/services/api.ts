// Centralized API configuration
export const BE_API_URL = import.meta.env.VITE_BE_API_URL as string;

// Default fetch options for authenticated requests
const defaultOptions: RequestInit = {
  credentials: 'include',
};

// Helper for making authenticated API requests
export async function apiFetch(
  endpoint: string,
  options: RequestInit = {},
): Promise<Response> {
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${BE_API_URL}${endpoint}`;
  return fetch(url, { ...defaultOptions, ...options });
}

// Extract error message from unknown error
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}
