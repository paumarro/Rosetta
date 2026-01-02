/**
 * Express Authentication Middleware for REST API
 *
 * Validates tokens locally using OIDC and enriches with CBAC data.
 * No external auth-service dependency.
 */

import { Request, Response, NextFunction } from 'express';
import authService, {
  type AuthenticatedUser,
} from '../services/authService.js';
import { parseCookies } from '../utils/cookieParser.js';

/**
 * Checks if test mode is enabled (development only).
 * @returns True if NODE_ENV is 'development'
 */
const isTestModeEnabled = (): boolean => {
  return process.env.NODE_ENV === 'development';
};

/**
 * Parses test user info from request headers or query params.
 * Headers: X-Test-User, X-Test-Name, X-Test-Community
 * Query: testUser, testName, testCommunity
 * @param req - Express request object
 * @returns AuthenticatedUser if test params present, null otherwise
 */
function parseTestUser(req: Request): AuthenticatedUser | null {
  // Check headers first
  const testUserId =
    (req.headers['x-test-user'] as string) || (req.query.testUser as string);
  const testUserName =
    (req.headers['x-test-name'] as string) || (req.query.testName as string);
  const testCommunity =
    (req.headers['x-test-community'] as string) ||
    (req.query.testCommunity as string);

  if (!testUserId || !testUserName) {
    return null;
  }

  return {
    entraId: `test-${testUserId}`,
    email: `${testUserId}@test.local`,
    name: testUserName,
    community: testCommunity || 'TestCommunity',
    isAdmin: false,
  };
}

/**
 * Extends Express Request with authenticated user information
 */
export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Extracts id_token from request (cookies or Authorization header).
 * Checks Authorization header first, then falls back to cookie.
 * @param req - Express request object
 * @returns Token string or null if not found
 */
function extractToken(req: Request): string | null {
  // Try Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Fall back to id_token cookie
  const cookies = parseCookies(req.headers.cookie);
  return cookies['id_token'] || null;
}

/**
 * Authentication middleware for Express routes.
 * Validates token locally and attaches user with CBAC info to request.
 * In development mode, also checks for test user headers/params.
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export async function authenticateRequest(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // Development-only: Check for test mode via headers or query params
  if (isTestModeEnabled()) {
    const testUser = parseTestUser(req);
    if (testUser) {
      console.log('[Test Mode] API authenticated as test user:', testUser.name);
      (req as AuthenticatedRequest).user = testUser;
      next();
      return;
    }
  }

  const token = extractToken(req);

  if (!token) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'No access token provided',
    });
    return;
  }

  // Validate token locally
  const authResult = await authService.authenticateToken(token);

  if (!authResult.valid || !authResult.user) {
    res.status(401).json({
      error: 'Unauthorized',
      message: authResult.error || 'Invalid or expired token',
    });
    return;
  }

  // Attach user to request
  (req as AuthenticatedRequest).user = authResult.user;

  next();
}

/**
 * CBAC Middleware - Requires user to have access to a specific community.
 * Must be used AFTER authenticateRequest middleware.
 * Extracts community from URL parameter (e.g., /editor/:community/:diagramName).
 * @param communityParam - URL parameter name containing community (default: 'community')
 * @returns Express middleware function
 */
export function requireCommunityAccess(communityParam: string = 'community') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const targetCommunity = req.params[communityParam];

    if (!targetCommunity) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Community parameter required',
      });
      return;
    }

    const hasAccess = authService.canAccessCommunity(user, targetCommunity);

    if (!hasAccess) {
      res.status(403).json({
        error: 'Forbidden',
        message: `You must be a member of "${targetCommunity}" or an admin to access this resource`,
      });
      return;
    }

    next();
  };
}

/**
 * Extracts community from diagram name (format: "community/diagramName").
 * @param name - Diagram name string
 * @returns Community name or null if not in expected format
 */
function extractCommunityFromName(name: string): string | null {
  if (!name || !name.includes('/')) {
    return null;
  }
  const parts = name.split('/');
  return parts[0] || null;
}

/**
 * CBAC Middleware for diagram routes.
 * Extracts community from diagram name parameter and validates access.
 * Must be used AFTER authenticateRequest middleware.
 * @param nameParam - URL parameter name containing diagram name (default: 'name')
 * @returns Express middleware function
 */
export function requireDiagramAccess(nameParam: string = 'name') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const diagramName = req.params[nameParam];
    const community = extractCommunityFromName(diagramName);

    // If no community in name (legacy format), allow access for now
    // This maintains backward compatibility while logging the access
    if (!community) {
      console.warn(
        `[CBAC] Legacy diagram access without community: ${diagramName} by ${user.email}`,
      );
      next();
      return;
    }

    const hasAccess = authService.canAccessCommunity(user, community);

    if (!hasAccess) {
      res.status(403).json({
        error: 'Forbidden',
        message: `You must be a member of "${community}" or an admin to access this diagram`,
      });
      return;
    }

    next();
  };
}
