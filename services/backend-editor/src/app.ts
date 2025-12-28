import express from 'express';
import diagramRoutes from './routes/diagramRoutes.js';
import healthRoutes from './routes/healthRoutes.js';

/**
 * Creates and configures the Express application.
 * Extracted from server.ts to enable testing without starting the HTTP server.
 */
export const createApp = () => {
  const app = express();

  app.use(express.json());
  app.use('/api', diagramRoutes);
  app.use('/', healthRoutes);

  return app;
};
