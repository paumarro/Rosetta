import { Response } from 'express';

/**
 * Standard error response format:
 * { error: string, message?: string }
 *
 * - error: Short error type (e.g., "Unauthorized", "Not Found")
 * - message: Optional detailed message
 */
export interface ErrorResponse {
  error: string;
  message?: string;
  code?: string;
}

/**
 * Sends a standardized error response
 */
export function sendError(
  res: Response,
  status: number,
  error: string,
  message?: string,
  code?: string
): Response {
  const body: ErrorResponse = { error };
  if (message) {
    body.message = message;
  }
  if (code) {
    body.code = code;
  }
  return res.status(status).json(body);
}

/**
 * Common error helpers
 */
export const errors = {
  unauthorized: (res: Response, message?: string) =>
    sendError(res, 401, 'Unauthorized', message || 'Authentication required'),

  forbidden: (res: Response, message?: string) =>
    sendError(res, 403, 'Forbidden', message || 'Access denied'),

  notFound: (res: Response, resource: string) =>
    sendError(res, 404, 'Not Found', `${resource} not found`),

  badRequest: (res: Response, message?: string) =>
    sendError(res, 400, 'Bad Request', message || 'Invalid request'),

  serverError: (res: Response, message?: string) =>
    sendError(res, 500, 'Internal Server Error', message),
};
