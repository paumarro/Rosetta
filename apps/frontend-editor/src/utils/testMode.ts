/**
 * Test mode utility functions
 * Helper functions for checking and managing test mode
 */

const TEST_USER_ID_KEY = 'rosetta_test_user_id';

/**
 * Helper to check if we're in test mode
 */
export function isTestMode(): boolean {
  return sessionStorage.getItem('rosetta_test_mode') === 'true';
}

/**
 * Get test user ID if in test mode
 */
export function getTestUserId(): string | null {
  if (!isTestMode()) return null;
  return sessionStorage.getItem(TEST_USER_ID_KEY);
}
