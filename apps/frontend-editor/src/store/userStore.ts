import { createUserStore } from '@shared/stores';

/**
 * Frontend-editor user store - RequireAuth wrapper handles authentication
 */
export const useUserStore = createUserStore({
  apiBaseUrl: '',
});

// Re-export types for convenience
export type { User, UpdateUserData } from '@shared/types';
export type { UserStore } from '@shared/stores';
