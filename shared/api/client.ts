import { getErrorMessage } from '../utils/error';

/**
 * API client factory with configurable base URL
 */
export function createApiClient(baseUrl: string = '') {
  const defaultOptions: RequestInit = {
    credentials: 'include',
  };

  /**
   * Make authenticated API request
   */
  async function apiFetch(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<Response> {
    const url = endpoint.startsWith('http')
      ? endpoint
      : `${baseUrl}${endpoint}`;
    return fetch(url, { ...defaultOptions, ...options });
  }

  return {
    apiFetch,
    getErrorMessage,
  };
}

/**
 * Default export for convenience
 */
export const { apiFetch, getErrorMessage: getError } = createApiClient();
