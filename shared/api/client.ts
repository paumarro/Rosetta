import { getErrorMessage } from '../utils/error';

/** Creates an API client with credentials included by default */
export function createApiClient(baseUrl: string = '') {
  const defaultOptions: RequestInit = {
    credentials: 'include',
  };

  /** Fetch with credentials, supports relative endpoints or full URLs */
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

export const { apiFetch, getErrorMessage: getError } = createApiClient();
