/**
 * WebSocket Authentication Middleware
 *
 * Validates access tokens from cookies before allowing WebSocket connections
 */

import { IncomingMessage } from 'http';
import type { WebSocket } from 'ws';
import authService, {
  type AuthenticatedUser,
} from '../services/authService.js';

/**
 * Custom WebSocket type with user context
 */
export interface AuthenticatedWebSocket extends WebSocket {
  user?: AuthenticatedUser;
}

/**
 * Parses cookies from HTTP headers
 */
function parseCookies(
  cookieHeader: string | undefined,
): Record<string, string> {
  const cookies: Record<string, string> = {};

  if (!cookieHeader) {
    return cookies;
  }

  cookieHeader.split(';').forEach((cookie) => {
    const [name, ...rest] = cookie.split('=');
    const value = rest.join('=').trim();
    if (name) {
      cookies[name.trim()] = decodeURIComponent(value);
    }
  });

  return cookies;
}

/**
 * Authenticates a WebSocket connection
 *
 * @param conn WebSocket connection
 * @param req Incoming HTTP request (upgrade request)
 * @returns AuthenticatedUser if valid, null if invalid (connection will be closed)
 */
export async function authenticateWebSocket(
  conn: WebSocket,
  req: IncomingMessage,
): Promise<AuthenticatedUser | null> {
  // Extract access token from cookies
  const cookies = parseCookies(req.headers.cookie);
  const accessToken = cookies['access_token'];

  if (!accessToken) {
    conn.close(4401, 'Unauthorized: No access token provided');
    return null;
  }

  // Validate token with auth service
  const validationResult = await authService.validateToken(accessToken);

  if (!validationResult.valid) {
    conn.close(4401, 'Unauthorized: Invalid or expired token');
    return null;
  }

  // Extract user info
  const user = authService.getUserFromValidation(validationResult);
  if (!user) {
    conn.close(4401, 'Unauthorized: Invalid user information');
    return null;
  }

  // Attach user to WebSocket connection for later use
  (conn as AuthenticatedWebSocket).user = user;

  return user;
}
