import { createUserStore } from '@shared/stores';
import { BE_API_URL } from '@/services/api';

/**
 * Frontend user store - configured for the main frontend app
 */
export const useUserStore = createUserStore({
  apiBaseUrl: BE_API_URL,
  returnNullOn401: true,
});

// Re-export types for convenience
export type { User, UpdateUserData, UserStore } from '@shared/types';
