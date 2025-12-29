/**
 * Auth Test Helpers
 *
 * Provides utilities for testing authentication:
 * - Mock JWT generation
 * - Mock OIDC service responses
 * - Mock authenticated requests
 */

import { vi } from 'vitest';
import type { Request, Response } from 'express';
import type { IncomingMessage } from 'http';
import type { AuthenticatedUser } from '../../src/services/authService.js';
import type { TokenClaims } from '../../src/services/oidcService.js';

/**
 * Creates mock token claims for testing
 */
export function createMockClaims(overrides: Partial<TokenClaims> = {}): TokenClaims {
  const now = Math.floor(Date.now() / 1000);
  return {
    sub: 'test-subject-id',
    oid: 'test-entra-id-12345',
    email: 'test@example.com',
    preferred_username: 'test@example.com',
    name: 'Test User',
    groups: [],
    aud: 'test-client-id',
    iss: 'https://login.microsoftonline.com/test-tenant-id/v2.0',
    exp: now + 3600, // 1 hour from now
    iat: now,
    ...overrides,
  };
}

/**
 * Creates a mock authenticated user for testing
 */
export function createMockUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    entraId: 'test-entra-id-12345',
    email: 'test@example.com',
    name: 'Test User',
    community: null,
    isAdmin: false,
    ...overrides,
  };
}

/**
 * Creates a mock Express request with optional auth headers/cookies
 */
export function createMockRequest(options: {
  bearerToken?: string;
  cookies?: Record<string, string>;
  params?: Record<string, string>;
  body?: unknown;
  headers?: Record<string, string>;
} = {}): Partial<Request> {
  const headers: Record<string, string | undefined> = { ...options.headers };

  if (options.bearerToken) {
    headers.authorization = `Bearer ${options.bearerToken}`;
  }

  if (options.cookies) {
    headers.cookie = Object.entries(options.cookies)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('; ');
  }

  return {
    headers: headers as Request['headers'],
    params: options.params || {},
    body: options.body || {},
  };
}

/**
 * Creates a mock Express response with spy functions
 */
export function createMockResponse(): {
  res: Partial<Response>;
  statusSpy: ReturnType<typeof vi.fn>;
  jsonSpy: ReturnType<typeof vi.fn>;
} {
  const jsonSpy = vi.fn();
  const statusSpy = vi.fn().mockReturnValue({ json: jsonSpy });

  const res: Partial<Response> = {
    status: statusSpy,
    json: jsonSpy,
  };

  return { res, statusSpy, jsonSpy };
}

/**
 * Creates a mock next function for Express middleware
 */
export function createMockNext(): ReturnType<typeof vi.fn> {
  return vi.fn();
}

/**
 * Creates a mock IncomingMessage for WebSocket upgrade requests
 */
export function createMockUpgradeRequest(options: {
  cookies?: Record<string, string>;
  headers?: Record<string, string>;
} = {}): Partial<IncomingMessage> {
  const headers: Record<string, string | undefined> = { ...options.headers };

  if (options.cookies) {
    headers.cookie = Object.entries(options.cookies)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('; ');
  }

  return {
    headers,
  };
}

/**
 * Creates a mock WebSocket for testing
 */
export function createMockWebSocket(): {
  ws: { close: ReturnType<typeof vi.fn>; user?: AuthenticatedUser };
  closeSpy: ReturnType<typeof vi.fn>;
} {
  const closeSpy = vi.fn();
  const ws = {
    close: closeSpy,
    user: undefined as AuthenticatedUser | undefined,
  };

  return { ws, closeSpy };
}

/**
 * Sets up environment variables for CBAC testing
 */
export function setupCBACEnv(options: {
  communityMappings?: string;
  adminEmails?: string;
} = {}): void {
  if (options.communityMappings !== undefined) {
    process.env.COMMUNITY_GROUP_MAPPINGS = options.communityMappings;
  }
  if (options.adminEmails !== undefined) {
    process.env.ADMIN_EMAILS = options.adminEmails;
  }
}

/**
 * Sets up environment variables for OIDC testing
 */
export function setupOIDCEnv(options: {
  tenantId?: string;
  clientId?: string;
} = {}): void {
  if (options.tenantId !== undefined) {
    process.env.TENANT_ID = options.tenantId;
  }
  if (options.clientId !== undefined) {
    process.env.CLIENT_ID = options.clientId;
  }
}

/**
 * Clears auth-related environment variables
 */
export function clearAuthEnv(): void {
  delete process.env.COMMUNITY_GROUP_MAPPINGS;
  delete process.env.ADMIN_EMAILS;
  delete process.env.TENANT_ID;
  delete process.env.CLIENT_ID;
}

/**
 * Sample test data for common scenarios
 */
export const testData = {
  validToken: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.test.signature',
  expiredToken: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.expired.signature',
  invalidToken: 'not-a-valid-jwt',

  adminEmail: 'admin@example.com',
  regularEmail: 'user@example.com',

  groupMappings: 'group-id-1:CommunityA,group-id-2:CommunityB',

  communities: {
    communityA: 'CommunityA',
    communityB: 'CommunityB',
  },

  groupIds: {
    communityA: 'group-id-1',
    communityB: 'group-id-2',
    unknown: 'unknown-group-id',
  },
};
