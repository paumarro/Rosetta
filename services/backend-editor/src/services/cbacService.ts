/** Community-Based Access Control - Maps Entra ID groups to communities and manages admin access */

export interface GroupToCommunityMapping {
  [groupId: string]: string;
}

class CBACService {
  private groupMappings: GroupToCommunityMapping | null = null;
  private adminEmails: Set<string> | null = null;

  /** Parses and caches group-to-community mappings from COMMUNITY_GROUP_MAPPINGS env var */
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

  /** Parses and caches admin emails from ADMIN_EMAILS env var (normalized to lowercase) */
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

  /** Returns first matching community from user's group IDs, or null if none match */
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

  /** Checks if email belongs to an admin */
  isAdmin(email: string): boolean {
    if (!email) {
      return false;
    }

    const admins = this.getAdminEmails();
    return admins.has(email.toLowerCase().trim());
  }

  /** Checks if user can access target community (grants access to admins or matching community members) */
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

  /** Clears cached group mappings and admin emails */
  refreshCache(): void {
    this.groupMappings = null;
    this.adminEmails = null;
  }
}

export default new CBACService();
