import { createUserStore } from '@shared/stores';

/**
 * Frontend-editor user store - configured with redirect on unauthorized
 */
export const useUserStore = createUserStore({
  apiBaseUrl: '',
  onUnauthorized: () => {
    window.location.href = '/login';
  },
  returnNullOn401: false,
});

// Re-export types for convenience
export type { User, UpdateUserData, UserStore } from '@shared/types';
