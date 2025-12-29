import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { IncomingMessage } from 'http';
import type { WebSocket } from 'ws';
import {
  createMockUpgradeRequest,
  createMockWebSocket,
  createMockUser,
  clearAuthEnv,
} from '../helpers/authHelpers.js';

vi.mock('../../src/services/authService.js', () => ({
  default: {
    authenticateToken: vi.fn(),
    canAccessCommunity: vi.fn(),
  },
}));

import authService from '../../src/services/authService.js';
import {
  authenticateUpgradeRequest,
  canAccessDocument,
  authenticateWebSocket,
  type AuthenticatedWebSocket,
} from '../../src/middleware/wsAuth.js';

describe('WebSocket Auth Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAuthEnv();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('authenticateUpgradeRequest', () => {
    it('should return user when id_token cookie is valid', async () => {
      const mockUser = createMockUser();
      vi.mocked(authService.authenticateToken).mockResolvedValue({ valid: true, user: mockUser });

      const req = createMockUpgradeRequest({ cookies: { id_token: 'valid-token' } }) as IncomingMessage;
      const result = await authenticateUpgradeRequest(req);

      expect(result).toEqual(mockUser);
    });

    it('should return null when no id_token cookie provided', async () => {
      const req = createMockUpgradeRequest({ cookies: { other_cookie: 'value' } }) as IncomingMessage;
      const result = await authenticateUpgradeRequest(req);

      expect(result).toBeNull();
      expect(authService.authenticateToken).not.toHaveBeenCalled();
    });

    it('should return null when token is invalid', async () => {
      vi.mocked(authService.authenticateToken).mockResolvedValue({ valid: false, error: 'Token expired' });

      const req = createMockUpgradeRequest({ cookies: { id_token: 'expired-token' } }) as IncomingMessage;
      const result = await authenticateUpgradeRequest(req);

      expect(result).toBeNull();
    });
  });

  describe('canAccessDocument', () => {
    it('should return true when user can access document community', () => {
      const mockUser = createMockUser({ community: 'CommunityA' });
      vi.mocked(authService.canAccessCommunity).mockReturnValue(true);

      const result = canAccessDocument(mockUser, 'CommunityA/my-diagram');

      expect(result).toBe(true);
    });

    it('should return false when user cannot access document community', () => {
      const mockUser = createMockUser({ community: 'CommunityB' });
      vi.mocked(authService.canAccessCommunity).mockReturnValue(false);

      const result = canAccessDocument(mockUser, 'CommunityA/my-diagram');

      expect(result).toBe(false);
    });

    it('should return true for legacy document without community prefix', () => {
      const mockUser = createMockUser();

      const result = canAccessDocument(mockUser, 'legacy-diagram');

      expect(result).toBe(true);
    });
  });

  describe('authenticateWebSocket', () => {
    it('should return user and attach to WebSocket when valid', async () => {
      const mockUser = createMockUser();
      vi.mocked(authService.authenticateToken).mockResolvedValue({ valid: true, user: mockUser });

      const { ws, closeSpy } = createMockWebSocket();
      const req = createMockUpgradeRequest({ cookies: { id_token: 'valid-token' } }) as IncomingMessage;

      const result = await authenticateWebSocket(ws as unknown as WebSocket, req);

      expect(result).toEqual(mockUser);
      expect((ws as AuthenticatedWebSocket).user).toEqual(mockUser);
      expect(closeSpy).not.toHaveBeenCalled();
    });

    it('should close WebSocket and return null when authentication fails', async () => {
      const { ws, closeSpy } = createMockWebSocket();
      const req = createMockUpgradeRequest() as IncomingMessage;

      const result = await authenticateWebSocket(ws as unknown as WebSocket, req);

      expect(result).toBeNull();
      expect(closeSpy).toHaveBeenCalled();
    });
  });
});
