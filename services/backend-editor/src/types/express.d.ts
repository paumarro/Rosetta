/**
 * Type augmentation for Express Request
 * Adds authenticated user information to Request object
 */

import { AuthenticatedUser } from '../services/authService.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
