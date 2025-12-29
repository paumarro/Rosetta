import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import {
  createMockRequest,
  createMockResponse,
  createMockNext,
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
  authenticateRequest,
  requireCommunityAccess,
  requireDiagramAccess,
  type AuthenticatedRequest,
} from '../../src/middleware/apiAuth.js';

describe('API Auth Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAuthEnv();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('authenticateRequest', () => {
    it('should attach user when Bearer token is valid', async () => {
      const mockUser = createMockUser();
      vi.mocked(authService.authenticateToken).mockResolvedValue({ valid: true, user: mockUser });

      const req = createMockRequest({ bearerToken: 'valid-token' }) as Request;
      const { res } = createMockResponse();
      const next = createMockNext();

      await authenticateRequest(req, res as Response, next as NextFunction);

      expect((req as AuthenticatedRequest).user).toEqual(mockUser);
      expect(next).toHaveBeenCalled();
    });

    it('should attach user when cookie token is valid', async () => {
      const mockUser = createMockUser();
      vi.mocked(authService.authenticateToken).mockResolvedValue({ valid: true, user: mockUser });

      const req = createMockRequest({ cookies: { id_token: 'cookie-token' } }) as Request;
      const { res } = createMockResponse();
      const next = createMockNext();

      await authenticateRequest(req, res as Response, next as NextFunction);

      expect((req as AuthenticatedRequest).user).toEqual(mockUser);
      expect(next).toHaveBeenCalled();
    });

    it('should return 401 when no token provided', async () => {
      const req = createMockRequest() as Request;
      const { res, statusSpy } = createMockResponse();
      const next = createMockNext();

      await authenticateRequest(req, res as Response, next as NextFunction);

      expect(statusSpy).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when token is invalid', async () => {
      vi.mocked(authService.authenticateToken).mockResolvedValue({ valid: false, error: 'Token expired' });

      const req = createMockRequest({ bearerToken: 'expired-token' }) as Request;
      const { res, statusSpy } = createMockResponse();
      const next = createMockNext();

      await authenticateRequest(req, res as Response, next as NextFunction);

      expect(statusSpy).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireCommunityAccess', () => {
    it('should call next when user has access', () => {
      const mockUser = createMockUser({ community: 'CommunityA' });
      vi.mocked(authService.canAccessCommunity).mockReturnValue(true);

      const req = createMockRequest({ params: { community: 'CommunityA' } }) as Request;
      (req as AuthenticatedRequest).user = mockUser;
      const { res, statusSpy } = createMockResponse();
      const next = createMockNext();

      requireCommunityAccess()(req, res as Response, next as NextFunction);

      expect(next).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should return 401 when no user attached', () => {
      const req = createMockRequest({ params: { community: 'CommunityA' } }) as Request;
      const { res, statusSpy } = createMockResponse();
      const next = createMockNext();

      requireCommunityAccess()(req, res as Response, next as NextFunction);

      expect(statusSpy).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 400 when community parameter missing', () => {
      const mockUser = createMockUser();
      const req = createMockRequest({ params: {} }) as Request;
      (req as AuthenticatedRequest).user = mockUser;
      const { res, statusSpy } = createMockResponse();
      const next = createMockNext();

      requireCommunityAccess()(req, res as Response, next as NextFunction);

      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 when user cannot access community', () => {
      const mockUser = createMockUser({ community: 'CommunityB' });
      vi.mocked(authService.canAccessCommunity).mockReturnValue(false);

      const req = createMockRequest({ params: { community: 'CommunityA' } }) as Request;
      (req as AuthenticatedRequest).user = mockUser;
      const { res, statusSpy } = createMockResponse();
      const next = createMockNext();

      requireCommunityAccess()(req, res as Response, next as NextFunction);

      expect(statusSpy).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireDiagramAccess', () => {
    it('should call next when user has access to diagram community', () => {
      const mockUser = createMockUser({ community: 'CommunityA' });
      vi.mocked(authService.canAccessCommunity).mockReturnValue(true);

      const req = createMockRequest({ params: { name: 'CommunityA/my-diagram' } }) as Request;
      (req as AuthenticatedRequest).user = mockUser;
      const { res, statusSpy } = createMockResponse();
      const next = createMockNext();

      requireDiagramAccess()(req, res as Response, next as NextFunction);

      expect(next).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should allow access for legacy diagram without community prefix', () => {
      const mockUser = createMockUser();

      const req = createMockRequest({ params: { name: 'legacy-diagram-name' } }) as Request;
      (req as AuthenticatedRequest).user = mockUser;
      const { res, statusSpy } = createMockResponse();
      const next = createMockNext();

      requireDiagramAccess()(req, res as Response, next as NextFunction);

      expect(next).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should return 401 when no user attached', () => {
      const req = createMockRequest({ params: { name: 'CommunityA/diagram' } }) as Request;
      const { res, statusSpy } = createMockResponse();
      const next = createMockNext();

      requireDiagramAccess()(req, res as Response, next as NextFunction);

      expect(statusSpy).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 when user cannot access diagram community', () => {
      const mockUser = createMockUser({ community: 'CommunityB' });
      vi.mocked(authService.canAccessCommunity).mockReturnValue(false);

      const req = createMockRequest({ params: { name: 'CommunityA/diagram' } }) as Request;
      (req as AuthenticatedRequest).user = mockUser;
      const { res, statusSpy } = createMockResponse();
      const next = createMockNext();

      requireDiagramAccess()(req, res as Response, next as NextFunction);

      expect(statusSpy).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
