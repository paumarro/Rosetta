import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { createTestApp } from '../helpers/testApp.js';
import { DiagramModel } from '../../src/models/diagramModel.js';

describe('Diagram Controller - SAGA Endpoints', () => {
  let mongoServer: MongoMemoryServer;
  const app = createTestApp();

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
    // Ensure indexes are created before running tests
    await DiagramModel.createIndexes();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear all diagrams before each test
    await DiagramModel.deleteMany({});
  });

  // ============================================================================
  // CREATE DIAGRAM BY LP (POST /api/diagrams/by-lp)
  // ============================================================================

  describe('POST /api/diagrams/by-lp', () => {
    it('should create diagram with valid data and return 201', async () => {
      const response = await request(app)
        .post('/api/diagrams/by-lp')
        .send({ learningPathId: 'uuid-123', name: 'Test LP' });

      expect(response.status).toBe(201);
      expect(response.body._id).toBeDefined();
      expect(response.body.learningPathId).toBe('uuid-123');
      expect(response.body.name).toBe('Test LP');
      expect(response.body.nodes).toBeDefined();
      expect(response.body.edges).toBeDefined();

      // Verify diagram was saved in database
      const diagram = await DiagramModel.findOne({ learningPathId: 'uuid-123' });
      expect(diagram).not.toBeNull();
      expect(diagram?.name).toBe('Test LP');
    });

    it('should return 200 for idempotent retry (same learningPathId)', async () => {
      // Create first diagram
      await DiagramModel.create({
        learningPathId: 'uuid-idempotent',
        name: 'First LP',
        nodes: [],
        edges: [],
      });

      // Attempt to create again with same learningPathId (different name)
      const response = await request(app)
        .post('/api/diagrams/by-lp')
        .send({ learningPathId: 'uuid-idempotent', name: 'Different Name' });

      // Should return 200 with existing diagram (idempotent)
      expect(response.status).toBe(200);
      expect(response.body.learningPathId).toBe('uuid-idempotent');
      expect(response.body.name).toBe('First LP'); // Original name preserved

      // Verify only one diagram exists
      const count = await DiagramModel.countDocuments({
        learningPathId: 'uuid-idempotent',
      });
      expect(count).toBe(1);
    });

    it('should return 409 for duplicate name (different learningPathId)', async () => {
      // Create first diagram with a specific name
      await DiagramModel.create({
        learningPathId: 'uuid-first',
        name: 'Duplicate Name',
        nodes: [],
        edges: [],
      });

      // Attempt to create with different learningPathId but same name
      const response = await request(app)
        .post('/api/diagrams/by-lp')
        .send({ learningPathId: 'uuid-second', name: 'Duplicate Name' });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already exists');
    });

    it('should use learningPathId as name when name is not provided', async () => {
      const response = await request(app)
        .post('/api/diagrams/by-lp')
        .send({ learningPathId: 'uuid-no-name' });

      expect(response.status).toBe(201);
      expect(response.body.learningPathId).toBe('uuid-no-name');
      expect(response.body.name).toBe('uuid-no-name');
    });

    it('should use learningPathId as name when name is empty string', async () => {
      const response = await request(app)
        .post('/api/diagrams/by-lp')
        .send({ learningPathId: 'uuid-empty-name', name: '   ' });

      expect(response.status).toBe(201);
      expect(response.body.name).toBe('uuid-empty-name');
    });
  });

  // ============================================================================
  // DELETE DIAGRAM BY LP (DELETE /api/diagrams/by-lp/:lpId)
  // ============================================================================

  describe('DELETE /api/diagrams/by-lp/:lpId', () => {
    it('should delete diagram and return 204', async () => {
      // Create a diagram to delete
      await DiagramModel.create({
        learningPathId: 'uuid-to-delete',
        name: 'To Delete',
        nodes: [],
        edges: [],
      });

      const response = await request(app).delete(
        '/api/diagrams/by-lp/uuid-to-delete',
      );

      expect(response.status).toBe(204);

      // Verify diagram was deleted
      const diagram = await DiagramModel.findOne({
        learningPathId: 'uuid-to-delete',
      });
      expect(diagram).toBeNull();
    });

    it('should return 404 when diagram not found', async () => {
      const response = await request(app).delete(
        '/api/diagrams/by-lp/non-existent-uuid',
      );

      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
    });
  });

  // ============================================================================
  // INPUT VALIDATION (Unit tests for edge cases - integration tests cover workflows)
  // ============================================================================

  describe('Input Validation', () => {
    it('should reject request without learningPathId', async () => {
      const response = await request(app)
        .post('/api/diagrams/by-lp')
        .send({ name: 'Test Name' });

      // learningPathId is required by the schema
      expect(response.status).toBe(500);
    });

    it('should handle very long name gracefully', async () => {
      const longName = 'A'.repeat(1000);
      const response = await request(app)
        .post('/api/diagrams/by-lp')
        .send({ learningPathId: 'uuid-long-name', name: longName });

      // Should still create (MongoDB doesn't have default length limits)
      expect(response.status).toBe(201);
      expect(response.body.name).toBe(longName);
    });

    it('should handle special characters in name', async () => {
      const specialName = 'Test <script>alert("xss")</script> & "quotes"';
      const response = await request(app)
        .post('/api/diagrams/by-lp')
        .send({ learningPathId: 'uuid-special-chars', name: specialName });

      expect(response.status).toBe(201);
      // Name should be stored as-is (sanitization is frontend responsibility)
      expect(response.body.name).toBe(specialName);
    });

    it('should handle unicode characters in name', async () => {
      const unicodeName = 'テスト名前 🚀 émoji';
      const response = await request(app)
        .post('/api/diagrams/by-lp')
        .send({ learningPathId: 'uuid-unicode', name: unicodeName });

      expect(response.status).toBe(201);
      expect(response.body.name).toBe(unicodeName);
    });
  });
});
