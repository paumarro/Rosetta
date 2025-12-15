/**
 * Auth Service - Local OIDC validation with CBAC
 *
 * Validates tokens locally using Microsoft Entra ID JWKS.
 * Determines community membership and admin status from token claims.
 *
 * No external auth-service dependency required.
 */

import oidcService, { type ValidationResult } from './oidcService.js';
import cbacService from './cbacService.js';

export interface AuthenticatedUser {
  entraId: string;
  email: string;
  name: string;
  community: string | null;
  isAdmin: boolean;
}

export interface AuthResult {
  valid: boolean;
  user?: AuthenticatedUser;
  error?: string;
}

class AuthService {
  /**
   * Validates a token and returns authenticated user with CBAC info
   */
  async authenticateToken(token: string): Promise<AuthResult> {
    // Validate token using local OIDC
    const validationResult: ValidationResult =
      await oidcService.validateToken(token);

    if (!validationResult.valid || !validationResult.claims) {
      return {
        valid: false,
        error: validationResult.error || 'Invalid token',
      };
    }

    const claims = validationResult.claims;

    // Extract user identity
    const entraId = claims.oid;
    const email = claims.email || claims.preferred_username || '';
    const name = claims.name || 'Unknown User';

    // Determine authorization from claims
    const groups = claims.groups || [];
    const community = cbacService.getCommunityFromGroups(groups);
    const isAdmin = cbacService.isAdmin(email);

    return {
      valid: true,
      user: {
        entraId,
        email,
        name,
        community,
        isAdmin,
      },
    };
  }

  /**
   * Check if user can access a specific community
   */
  canAccessCommunity(user: AuthenticatedUser, targetCommunity: string): boolean {
    return cbacService.canAccessCommunity(
      user.community,
      targetCommunity,
      user.isAdmin,
    );
  }
}

export default new AuthService();
