import express from 'express';
import diagramRoutes from './routes/diagramRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import metricsRoutes from './routes/metrics.js';

/**
 * Creates and configures the Express application.
 * Extracted from server.ts to enable testing without starting the HTTP server.
 */
export const createApp = () => {
  const app = express();

  app.use(express.json());
  app.use('/api/metrics', metricsRoutes); // Must come before /api to avoid auth middleware
  app.use('/api', diagramRoutes);
  app.use('/', healthRoutes);

  return app;
};
