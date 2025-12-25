import { createUserStore } from '@shared/stores';
import { BE_API_URL } from '@/services/api';

/**
 * Frontend user store - configured for the main frontend app
 */
export const useUserStore = createUserStore({
  apiBaseUrl: BE_API_URL,
});

// Re-export types for convenience
export type { User, UpdateUserData } from '@shared/types';
export type { UserStore } from '@shared/stores';
