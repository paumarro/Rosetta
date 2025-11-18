/**
 * Auth Service Client
 *
 * Communicates with the centralized auth-service to validate tokens
 */

export interface TokenValidationResult {
  valid: boolean;
  claims?: Record<string, unknown>;
  entra_id?: string;
  email?: string;
  name?: string;
  error?: string;
}

export interface AuthenticatedUser {
  entraId: string;
  email: string;
  name: string;
}

class AuthService {
  private authServiceUrl: string;

  constructor() {
    this.authServiceUrl =
      process.env.AUTH_SERVICE_URL || 'http://localhost:3002';
  }

  /**
   * Validates an access token by calling the auth-service
   */
  async validateToken(token: string): Promise<TokenValidationResult> {
    try {
      const response = await fetch(`${this.authServiceUrl}/api/auth/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      const result = (await response.json()) as TokenValidationResult;
      return result;
    } catch (error) {
      console.error('Error validating token with auth-service:', error);
      return {
        valid: false,
        error: `Failed to communicate with auth service: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Extracts user information from validation result
   */
  getUserFromValidation(
    result: TokenValidationResult,
  ): AuthenticatedUser | null {
    if (!result.valid || !result.entra_id) {
      return null;
    }

    return {
      entraId: result.entra_id,
      email: result.email || 'unknown@example.com',
      name: result.name || 'Unknown User',
    };
  }
}

export default new AuthService();
