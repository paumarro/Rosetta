import { createApiClient } from '@shared/api';
import { getErrorMessage as getError } from '@shared/utils';

// Centralized API configuration
export const BE_API_URL = import.meta.env.VITE_BE_API_URL as string;

// Create configured API client
const { apiFetch } = createApiClient(BE_API_URL);

// Export configured functions
export { apiFetch, getError as getErrorMessage };
