/**
 * Community-Based Access Control (CBAC) Service
 *
 * Handles authorization logic:
 * - Maps Microsoft Entra ID groups to communities
 * - Checks admin status based on email
 * - Determines if user can access community resources
 *
 * Configuration via environment variables:
 * - COMMUNITY_GROUP_MAPPINGS: GROUP_ID_1:Community1,GROUP_ID_2:Community2
 * - ADMIN_EMAILS: admin1@example.com,admin2@example.com
 */

export interface GroupToCommunityMapping {
  [groupId: string]: string;
}

class CBACService {
  private groupMappings: GroupToCommunityMapping | null = null;
  private adminEmails: Set<string> | null = null;

  /**
   * Parses group mappings from environment variable.
   * Format: GROUP_ID_1:CommunityName1,GROUP_ID_2:CommunityName2
   * @returns Cached or newly parsed group to community mappings
   */
  private getGroupMappings(): GroupToCommunityMapping {
    if (this.groupMappings) {
      return this.groupMappings;
    }

    this.groupMappings = {};
    const mappingsEnv = process.env.COMMUNITY_GROUP_MAPPINGS || '';

    if (!mappingsEnv) {
      console.warn('CBAC: COMMUNITY_GROUP_MAPPINGS not configured');
      return this.groupMappings;
    }

    const pairs = mappingsEnv.split(',');
    for (const pair of pairs) {
      const [groupId, communityName] = pair.split(':').map((s) => s.trim());
      if (groupId && communityName) {
        this.groupMappings[groupId] = communityName;
      }
    }

    return this.groupMappings;
  }

  /**
   * Parses admin emails from environment variable.
   * @returns Cached or newly parsed set of admin emails (lowercase)
   */
  private getAdminEmails(): Set<string> {
    if (this.adminEmails) {
      return this.adminEmails;
    }

    this.adminEmails = new Set();
    const adminEnv = process.env.ADMIN_EMAILS || '';

    if (!adminEnv) {
      return this.adminEmails;
    }

    const emails = adminEnv.split(',');
    for (const email of emails) {
      const normalized = email.trim().toLowerCase();
      if (normalized) {
        this.adminEmails.add(normalized);
      }
    }

    return this.adminEmails;
  }

  /**
   * Determines user's community from their group memberships.
   * Returns the first matching community or null if no match.
   * @param groupIds - Array of group IDs from token claims
   * @returns Community name or null if no matching group found
   */
  getCommunityFromGroups(groupIds: string[]): string | null {
    if (groupIds.length === 0) {
      return null;
    }

    const mappings = this.getGroupMappings();

    for (const groupId of groupIds) {
      if (mappings[groupId]) {
        return mappings[groupId];
      }
    }

    return null;
  }

  /**
   * Checks if an email belongs to an admin.
   * @param email - Email address to check
   * @returns True if email is in the admin list
   */
  isAdmin(email: string): boolean {
    if (!email) {
      return false;
    }

    const admins = this.getAdminEmails();
    return admins.has(email.toLowerCase().trim());
  }

  /**
   * Checks if user can access a specific community's resources.
   * User can access if they are an admin OR belong to that community.
   * @param userCommunity - User's community membership (nullable)
   * @param targetCommunity - Community to check access for
   * @param isAdmin - Whether user has admin privileges
   * @returns True if user can access the target community
   */
  canAccessCommunity(
    userCommunity: string | null,
    targetCommunity: string,
    isAdmin: boolean,
  ): boolean {
    if (isAdmin) {
      return true;
    }

    if (!userCommunity || !targetCommunity) {
      return false;
    }

    return userCommunity === targetCommunity;
  }

  /**
   * Refreshes cached mappings (useful for testing or config updates).
   * Clears group mappings and admin emails caches.
   */
  refreshCache(): void {
    this.groupMappings = null;
    this.adminEmails = null;
  }
}

export default new CBACService();
