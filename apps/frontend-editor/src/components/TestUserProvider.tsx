/**
 * TestUserProvider - Development-only component for testing collaborative features
 *
 * Bypasses EntraID authentication and generates unique test users per browser tab.
 * Only available when import.meta.env.DEV is true.
 */
/* eslint-disable react/prop-types */

import { useEffect, useState, ReactNode } from 'react';
import { useUserStore } from '@/store/userStore';
import type { User } from '@shared/types';

// Session storage key for test user ID
const TEST_USER_ID_KEY = 'rosetta_test_user_id';
const TEST_USER_NAME_KEY = 'rosetta_test_user_name';

// Available test user colors for visual distinction
const TEST_USER_COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#96CEB4',
  '#FFEAA7',
  '#DDA0DD',
  '#98D8C8',
  '#F7DC6F',
];

function getOrCreateTestUserId(): string {
  let userId = sessionStorage.getItem(TEST_USER_ID_KEY);
  if (!userId) {
    userId = crypto.randomUUID();
    sessionStorage.setItem(TEST_USER_ID_KEY, userId);
  }
  return userId;
}

function getOrCreateTestUserName(userId: string): string {
  let userName = sessionStorage.getItem(TEST_USER_NAME_KEY);
  if (!userName) {
    // Use last 4 chars of UUID for memorable identifier
    const shortId = userId.slice(-4).toUpperCase();
    userName = `Test User #${shortId}`;
    sessionStorage.setItem(TEST_USER_NAME_KEY, userName);
  }
  return userName;
}

function getTestUserColor(userId: string): string {
  // Deterministic color based on user ID
  const hash = userId
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return TEST_USER_COLORS[hash % TEST_USER_COLORS.length];
}

interface TestUserProviderProps {
  children: ReactNode;
}

export const TestUserProvider: React.FC<TestUserProviderProps> = ({
  children,
}) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Generate or retrieve test user identity
    const testUserId = getOrCreateTestUserId();
    const testUserName = getOrCreateTestUserName(testUserId);
    const testUserColor = getTestUserColor(testUserId);

    // Create mock user matching the User interface
    const mockUser: User = {
      ID: 0,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
      DeletedAt: null,
      Name: testUserName,
      Email: `${testUserId}@test.local`,
      EntraID: `test-${testUserId}`,
      PhotoURL: '', // No photo for test users
      Community: 'TestCommunity',
      IsAdmin: false,
    };

    // Directly set the user in the store (bypass API fetch)
    useUserStore.setState({
      user: mockUser,
      isLoading: false,
      error: null,
    });

    // Store test mode flag in sessionStorage for collaboration store to detect
    sessionStorage.setItem('rosetta_test_mode', 'true');
    sessionStorage.setItem('rosetta_test_user_color', testUserColor);

    setIsReady(true);

    console.log('[TestUserProvider] Test user initialized:', {
      userId: testUserId,
      userName: testUserName,
      color: testUserColor,
    });
  }, []);

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Initializing test mode...</p>
      </div>
    );
  }

  return (
    <>
      {/* Test Mode Indicator */}
      <div className="fixed top-10 left-1/2 -translate-x-1/2 z-50 bg-white text-black-700 px-4 py-2 rounded-full text-xs font-semibold shadow-lg flex items-center gap-2">
        <span className="w-2 h-2 bg-amber-600 rounded-full animate-pulse" />
        TEST MODE
      </div>
      {children}
    </>
  );
};

export default TestUserProvider;

// Re-export test mode utilities for backward compatibility
// eslint-disable-next-line react-refresh/only-export-components
export { isTestMode, getTestUserId } from '@/utils/testMode';
