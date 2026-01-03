/** Local OIDC token validation using Microsoft Entra ID JWKS */

import * as jose from 'jose';

export interface TokenClaims {
  sub: string;
  oid: string; // Entra ID (Object ID)
  email?: string;
  preferred_username?: string;
  name?: string;
  groups?: string[]; // Group IDs if configured in Entra ID
  aud: string;
  iss: string;
  exp: number;
  iat: number;
}

export interface ValidationResult {
  valid: boolean;
  claims?: TokenClaims;
  error?: string;
}

class OIDCService {
  private jwks: jose.JWTVerifyGetKey | null = null;
  private tenantId: string;
  private clientId: string;
  private issuer: string;

  constructor() {
    this.tenantId = process.env.TENANT_ID || '';
    this.clientId = process.env.CLIENT_ID || '';
    this.issuer = `https://login.microsoftonline.com/${this.tenantId}/v2.0`;

    if (!this.tenantId || !this.clientId) {
      console.warn(
        'OIDC Service: TENANT_ID or CLIENT_ID not configured. Token validation will fail.',
      );
    }
  }

  /** Lazily initializes JWKS for token verification */
  private async getJWKS(): Promise<jose.JWTVerifyGetKey> {
    if (!this.jwks) {
      const jwksUrl = `https://login.microsoftonline.com/${this.tenantId}/discovery/v2.0/keys`;
      this.jwks = jose.createRemoteJWKSet(new URL(jwksUrl));
    }
    return this.jwks;
  }

  /** Validates OIDC token signature, issuer, audience, and expiration */
  async validateToken(token: string): Promise<ValidationResult> {
    if (!token) {
      return { valid: false, error: 'No token provided' };
    }

    if (!this.tenantId || !this.clientId) {
      return {
        valid: false,
        error: 'OIDC not configured: missing TENANT_ID or CLIENT_ID',
      };
    }

    try {
      const jwks = await this.getJWKS();

      const { payload } = await jose.jwtVerify(token, jwks, {
        issuer: this.issuer,
        audience: this.clientId,
      });

      const claims = payload as unknown as TokenClaims;

      // Validate required claims
      if (!claims.oid) {
        return { valid: false, error: 'Token missing required claim: oid' };
      }

      return {
        valid: true,
        claims,
      };
    } catch (error) {
      if (error instanceof jose.errors.JWTExpired) {
        return { valid: false, error: 'Token expired' };
      }
      if (error instanceof jose.errors.JWTClaimValidationFailed) {
        return {
          valid: false,
          error: `Token validation failed: ${error.message}`,
        };
      }
      if (error instanceof jose.errors.JWSSignatureVerificationFailed) {
        return { valid: false, error: 'Invalid token signature' };
      }

      console.error('OIDC validation error:', error);
      return {
        valid: false,
        error: `Token validation failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}

export default new OIDCService();
