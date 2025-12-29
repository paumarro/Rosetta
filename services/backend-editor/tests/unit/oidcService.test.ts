import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupOIDCEnv, clearAuthEnv, createMockClaims } from '../helpers/authHelpers.js';

vi.mock('jose', () => {
  class MockJWTExpired extends Error {
    constructor(message = 'Token expired') {
      super(message);
      this.name = 'JWTExpired';
    }
  }

  class MockJWTClaimValidationFailed extends Error {
    constructor(message = 'Claim validation failed') {
      super(message);
      this.name = 'JWTClaimValidationFailed';
    }
  }

  class MockJWSSignatureVerificationFailed extends Error {
    constructor(message = 'Invalid signature') {
      super(message);
      this.name = 'JWSSignatureVerificationFailed';
    }
  }

  return {
    createRemoteJWKSet: vi.fn(() => 'mock-jwks'),
    jwtVerify: vi.fn(),
    errors: {
      JWTExpired: MockJWTExpired,
      JWTClaimValidationFailed: MockJWTClaimValidationFailed,
      JWSSignatureVerificationFailed: MockJWSSignatureVerificationFailed,
    },
  };
});

import * as jose from 'jose';

const importOIDCService = async () => {
  const { default: oidcService } = await import('../../src/services/oidcService.js');
  return oidcService;
};

const mockValidToken = (claims = createMockClaims()) => {
  vi.mocked(jose.jwtVerify).mockResolvedValue({
    payload: claims,
    protectedHeader: { alg: 'RS256' },
  } as never);
};

describe('OIDC Service', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    clearAuthEnv();
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  describe('validateToken', () => {
    it('should return valid result with claims for valid token', async () => {
      setupOIDCEnv({ tenantId: 'test-tenant', clientId: 'test-client' });
      const mockClaims = createMockClaims();
      mockValidToken(mockClaims);

      const oidcService = await importOIDCService();
      const result = await oidcService.validateToken('valid-token');

      expect(result.valid).toBe(true);
      expect(result.claims?.oid).toBe(mockClaims.oid);
      expect(result.claims?.email).toBe(mockClaims.email);
    });

    it('should return error when token is empty', async () => {
      setupOIDCEnv({ tenantId: 'test-tenant', clientId: 'test-client' });

      const oidcService = await importOIDCService();
      const result = await oidcService.validateToken('');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('No token provided');
    });

    it('should return error when OIDC is not configured', async () => {
      setupOIDCEnv({ tenantId: '', clientId: '' });

      const oidcService = await importOIDCService();
      const result = await oidcService.validateToken('some-token');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('OIDC not configured');
    });

    it('should return error for expired token', async () => {
      setupOIDCEnv({ tenantId: 'test-tenant', clientId: 'test-client' });
      vi.mocked(jose.jwtVerify).mockRejectedValue(new jose.errors.JWTExpired('Token expired'));

      const oidcService = await importOIDCService();
      const result = await oidcService.validateToken('expired-token');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token expired');
    });

    it('should return error for invalid signature', async () => {
      setupOIDCEnv({ tenantId: 'test-tenant', clientId: 'test-client' });
      vi.mocked(jose.jwtVerify).mockRejectedValue(
        new jose.errors.JWSSignatureVerificationFailed('Invalid signature'),
      );

      const oidcService = await importOIDCService();
      const result = await oidcService.validateToken('tampered-token');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid token signature');
    });

    it('should return error when token missing required oid claim', async () => {
      setupOIDCEnv({ tenantId: 'test-tenant', clientId: 'test-client' });
      const claimsWithoutOid = createMockClaims();
      // @ts-expect-error - intentionally removing required field
      delete claimsWithoutOid.oid;
      mockValidToken(claimsWithoutOid);

      const oidcService = await importOIDCService();
      const result = await oidcService.validateToken('token-without-oid');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token missing required claim: oid');
    });

    it('should handle unexpected errors gracefully', async () => {
      setupOIDCEnv({ tenantId: 'test-tenant', clientId: 'test-client' });
      vi.mocked(jose.jwtVerify).mockRejectedValue(new Error('Network error'));

      const oidcService = await importOIDCService();
      const result = await oidcService.validateToken('any-token');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Token validation failed');
    });
  });
});
