/**
 * WebSocket Authentication Middleware
 *
 * Validates tokens locally and applies CBAC for WebSocket connections.
 * Used for Yjs collaborative editing.
 */

import { IncomingMessage } from 'http';
import type { WebSocket } from 'ws';
import authService, { type AuthenticatedUser } from '../services/authService.js';
import { parseCookies } from '../utils/cookieParser.js';

/**
 * Checks if test mode is enabled (development only).
 * @returns True if NODE_ENV is 'development'
 */
const isTestModeEnabled = (): boolean => {
  return process.env.NODE_ENV === 'development';
};

/**
 * Custom WebSocket type with user context
 */
export interface AuthenticatedWebSocket extends WebSocket {
  user?: AuthenticatedUser;
}

/**
 * Extracts community from document name.
 * Document name format: "community/diagramName" or just "diagramName".
 * @param docName - Document name string
 * @returns Community name or null if not in expected format
 */
export function extractCommunityFromDocName(docName: string): string | null {
  if (!docName) return null;

  // If document name contains a slash, first part is community
  const parts = docName.split('/');
  if (parts.length >= 2) {
    return parts[0];
  }

  return null;
}

/**
 * Parses test user info from URL query parameters
 * Format: ?testUser=userId&testName=userName&testCommunity=community
 *
 * @param url Request URL with query parameters
 * @returns AuthenticatedUser if test params present, null otherwise
 */
function parseTestUserFromUrl(url: string | undefined): AuthenticatedUser | null {
  if (!url) return null;

  try {
    // Parse query string from URL (format: /docName?testUser=xxx&testName=yyy)
    const queryStart = url.indexOf('?');
    if (queryStart === -1) return null;

    const queryString = url.slice(queryStart + 1);
    const params = new URLSearchParams(queryString);

    const testUserId = params.get('testUser');
    const testUserName = params.get('testName');
    const testCommunity = params.get('testCommunity');

    if (!testUserId || !testUserName) return null;

    return {
      entraId: `test-${testUserId}`,
      email: `${testUserId}@test.local`,
      name: testUserName,
      community: testCommunity || 'TestCommunity',
      isAdmin: false,
    };
  } catch {
    return null;
  }
}

/**
 * Authenticates a WebSocket upgrade request
 * Returns user if valid, null if invalid
 *
 * In development mode, also checks for test user query parameters.
 *
 * @param req Incoming HTTP request (upgrade request)
 * @returns AuthenticatedUser if valid, null if invalid
 */
export async function authenticateUpgradeRequest(
  req: IncomingMessage,
): Promise<AuthenticatedUser | null> {
  // Development-only: Check for test mode via URL query parameters
  if (isTestModeEnabled()) {
    const testUser = parseTestUserFromUrl(req.url);
    if (testUser) {
      console.log('[Test Mode] WebSocket authenticated as test user:', testUser.name);
      return testUser;
    }
  }

  const cookies = parseCookies(req.headers.cookie);
  const idToken = cookies['id_token'];

  if (!idToken) {
    console.log('WebSocket auth failed: No id_token provided');
    return null;
  }

  const authResult = await authService.authenticateToken(idToken);

  if (!authResult.valid || !authResult.user) {
    console.log('WebSocket auth failed:', authResult.error);
    return null;
  }

  return authResult.user;
}

/**
 * Checks if user can access a document based on CBAC
 *
 * @param user Authenticated user
 * @param docName Document name (format: "community/diagramName")
 * @returns true if user can access, false otherwise
 */
export function canAccessDocument(
  user: AuthenticatedUser,
  docName: string,
): boolean {
  const community = extractCommunityFromDocName(docName);

  // If no community in doc name, allow access (legacy support)
  if (!community) {
    return true;
  }

  return authService.canAccessCommunity(user, community);
}

/**
 * Authenticates a WebSocket connection (legacy interface)
 *
 * @param conn WebSocket connection
 * @param req Incoming HTTP request (upgrade request)
 * @returns AuthenticatedUser if valid, null if invalid (connection will be closed)
 */
export async function authenticateWebSocket(
  conn: WebSocket,
  req: IncomingMessage,
): Promise<AuthenticatedUser | null> {
  const user = await authenticateUpgradeRequest(req);

  if (!user) {
    conn.close(4401, 'Unauthorized: Invalid or expired token');
    return null;
  }

  // Attach user to WebSocket connection
  (conn as AuthenticatedWebSocket).user = user;

  return user;
}
