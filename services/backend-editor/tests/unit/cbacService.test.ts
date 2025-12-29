import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import cbacService from '../../src/services/cbacService.js';
import { setupCBACEnv, clearAuthEnv, testData } from '../helpers/authHelpers.js';

const setupAndRefresh = (config: Parameters<typeof setupCBACEnv>[0] = {}) => {
  setupCBACEnv(config);
  cbacService.refreshCache();
};

describe('CBAC Service', () => {
  beforeEach(() => {
    clearAuthEnv();
    cbacService.refreshCache();
  });

  afterEach(() => {
    clearAuthEnv();
    cbacService.refreshCache();
  });

  describe('getCommunityFromGroups', () => {
    beforeEach(() => {
      setupAndRefresh({ communityMappings: testData.groupMappings });
    });

    it('should map group to community', () => {
      expect(cbacService.getCommunityFromGroups([testData.groupIds.communityA])).toBe(
        testData.communities.communityA,
      );
    });

    it('should return null when no groups match', () => {
      expect(cbacService.getCommunityFromGroups([testData.groupIds.unknown])).toBeNull();
      expect(cbacService.getCommunityFromGroups([])).toBeNull();
    });

    it('should find match in any position of groups array', () => {
      const result = cbacService.getCommunityFromGroups([
        'unknown-1',
        'unknown-2',
        testData.groupIds.communityB,
      ]);
      expect(result).toBe(testData.communities.communityB);
    });

    it('should return null when mappings are not configured', () => {
      setupAndRefresh({ communityMappings: '' });
      expect(cbacService.getCommunityFromGroups([testData.groupIds.communityA])).toBeNull();
    });
  });

  describe('isAdmin', () => {
    it('should return true for configured admin email', () => {
      setupAndRefresh({ adminEmails: testData.adminEmail });
      expect(cbacService.isAdmin(testData.adminEmail)).toBe(true);
    });

    it('should return false for non-admin email', () => {
      setupAndRefresh({ adminEmails: testData.adminEmail });
      expect(cbacService.isAdmin(testData.regularEmail)).toBe(false);
    });

    it('should be case-insensitive', () => {
      setupAndRefresh({ adminEmails: 'Admin@Example.COM' });
      expect(cbacService.isAdmin('admin@example.com')).toBe(true);
    });

    it('should handle multiple admin emails', () => {
      setupAndRefresh({ adminEmails: 'admin1@example.com,admin2@example.com' });
      expect(cbacService.isAdmin('admin1@example.com')).toBe(true);
      expect(cbacService.isAdmin('admin2@example.com')).toBe(true);
      expect(cbacService.isAdmin('notadmin@example.com')).toBe(false);
    });

    it('should return false when not configured', () => {
      setupAndRefresh({ adminEmails: '' });
      expect(cbacService.isAdmin(testData.adminEmail)).toBe(false);
    });
  });

  describe('canAccessCommunity', () => {
    it('should allow access when communities match', () => {
      expect(cbacService.canAccessCommunity('CommunityA', 'CommunityA', false)).toBe(true);
    });

    it('should deny access when communities do not match', () => {
      expect(cbacService.canAccessCommunity('CommunityA', 'CommunityB', false)).toBe(false);
      expect(cbacService.canAccessCommunity(null, 'CommunityA', false)).toBe(false);
    });

    it('should allow admin to access any community', () => {
      expect(cbacService.canAccessCommunity('CommunityA', 'CommunityB', true)).toBe(true);
      expect(cbacService.canAccessCommunity(null, 'CommunityB', true)).toBe(true);
    });
  });
});
