import { RequestHandler } from 'express';

/**
 * Wraps an async Express request handler to properly handle Promise rejections.
 
 * Problem this solves:
 * Express doesn't handle Promise rejections in async route handlers by default.
 * Without this wrapper, unhandled rejections would crash the server instead of
 * being passed to Express's error handling middleware.
 * 
 * @example
 * // Without catchAsync, you'd need manual try-catch in every route:
 * app.get('/data', async (req, res, next) => {
 *   try {
 *     const data = await getData();
 *     res.json(data);
 *   } catch (error) {
 *     // Have to remember to pass errors to next() every time
 *     next(error);
 *   }
 * });
 * 
 * // With catchAsync, errors are automatically handled:
 * app.get('/data', catchAsync(async (req, res) => {
 *   const data = await getData();
 *   res.json(data);
 *   // Any errors are automatically caught and passed to next()
 * }));
 */
export const catchAsync = <
  // Route parameters (e.g., /user/:id where id is a param)
  TParams = Record<string, never>,
  // Response body type
  TResponse = unknown,
  // Request body type (e.g., POST data)
  TRequest = unknown,
  // Query parameters (e.g., ?filter=active)
  TQuery = Record<string, string>,
>(
  handler: (
    ...args: Parameters<RequestHandler<TParams, TResponse, TRequest, TQuery>>
  ) => Promise<unknown>,
): RequestHandler<TParams, TResponse, TRequest, TQuery> => {
  return (req, res, next) => {
    // Catch any Promise rejections and pass them to Express error handler
    void handler(req, res, next).catch(next);
  };
};
