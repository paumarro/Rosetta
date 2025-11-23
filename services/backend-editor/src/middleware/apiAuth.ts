/**
 * Express Authentication Middleware for REST API
 *
 * Validates access tokens before allowing access to protected routes
 * Uses auth-service for token validation (consistent with WebSocket auth)
 */

import { Request, Response, NextFunction } from 'express';
import authService, {
  type AuthenticatedUser,
} from '../services/authService.js';

/**
 * Extends Express Request with authenticated user information
 */
export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Parses cookies from the request
 */
function getCookies(req: Request): Record<string, string> {
  const cookies: Record<string, string> = {};
  const cookieHeader = req.headers.cookie;

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
 * Extracts id_token from request (cookies or Authorization header)
 * Note: We use id_token (not access_token) for user identity validation
 * The access_token cookie is for Microsoft Graph API calls
 */
function extractToken(req: Request): string | null {
  // Try Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Fall back to id_token cookie (contains user identity)
  const cookies = getCookies(req);
  return cookies['id_token'] || null;
}

/**
 * Authentication middleware for Express routes
 * Validates token with auth-service and attaches user to request
 * Always returns 401 JSON on failure - frontend handles navigation/redirects
 */
export async function authenticateRequest(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'No access token provided',
    });
    return;
  }

  // Validate token with auth-service
  const validationResult = await authService.validateToken(token);

  if (!validationResult.valid) {
    res.status(401).json({
      error: 'Unauthorized',
      message: validationResult.error || 'Invalid or expired token',
    });
    return;
  }

  // Extract user info
  const user = authService.getUserFromValidation(validationResult);
  if (!user) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid user information in token',
    });
    return;
  }

  // Attach user to request for use in route handlers
  (req as AuthenticatedRequest).user = user;

  next();
}
