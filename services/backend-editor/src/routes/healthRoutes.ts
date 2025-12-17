/**
 * Health Check Routes
 *
 * Provides endpoints for monitoring backend-editor health
 */

import { Router } from 'express';
import mongoose from 'mongoose';

const router = Router();

/**
 * Basic health check - returns 200 if server is running
 */
router.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'backend-editor' });
});

/**
 * Detailed health check - checks all dependencies
 */
router.get('/health/detailed', async (_req, res) => {
  const instanceId = process.env.INSTANCE_ID || 'unknown';
  const checks: {
    service: string;
    instance: string;
    timestamp: string;
    status: string;
    checks: {
      mongodb: string;
    };
  } = {
    service: 'backend-editor',
    instance: instanceId,
    timestamp: new Date().toISOString(),
    status: 'healthy',
    checks: {
      mongodb: 'unknown',
    },
  };

  // Check MongoDB
  try {
    checks.checks.mongodb =
      mongoose.connection.readyState === 1 ? 'healthy' : 'unhealthy';
  } catch (error) {
    checks.checks.mongodb = 'error';
  }

  // Overall status
  const hasUnhealthy = Object.values(checks.checks).some(
    (v) => v === 'unhealthy' || v === 'error',
  );
  checks.status = hasUnhealthy ? 'degraded' : 'healthy';

  const statusCode = checks.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(checks);
});

export default router;
