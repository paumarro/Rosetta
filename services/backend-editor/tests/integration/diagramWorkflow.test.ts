import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { createTestApp } from '../helpers/testApp.js';
import { DiagramModel } from '../../src/models/diagramModel.js';

describe('Diagram Controller - Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  const app = createTestApp();

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
    await DiagramModel.createIndexes();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await DiagramModel.deleteMany({});
  });

  // ============================================================================
  // FULL WORKFLOW INTEGRATION TESTS
  // ============================================================================

  describe('Full Create-Update-Delete Workflow', () => {
    it('should support complete diagram lifecycle', async () => {
      const learningPathId = 'workflow-test-uuid';

      // Step 1: Create diagram
      const createResponse = await request(app)
        .post('/api/diagrams/by-lp')
        .send({ learningPathId, name: 'Workflow Test' });

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.learningPathId).toBe(learningPathId);
      expect(createResponse.body.nodes.length).toBeGreaterThan(0);
      expect(createResponse.body.edges.length).toBeGreaterThan(0);

      // Step 2: Verify diagram exists in database
      const diagram = await DiagramModel.findOne({ learningPathId });
      expect(diagram).not.toBeNull();
      expect(diagram?.name).toBe('Workflow Test');

      // Step 3: Delete diagram
      const deleteResponse = await request(app).delete(
        `/api/diagrams/by-lp/${learningPathId}`,
      );

      expect(deleteResponse.status).toBe(204);

      // Step 4: Verify diagram is deleted
      const deletedDiagram = await DiagramModel.findOne({ learningPathId });
      expect(deletedDiagram).toBeNull();
    });

    it('should handle create-delete-recreate cycle', async () => {
      const learningPathId = 'cycle-test-uuid';

      // Create
      const create1 = await request(app)
        .post('/api/diagrams/by-lp')
        .send({ learningPathId, name: 'Cycle Test' });
      expect(create1.status).toBe(201);

      // Delete
      const delete1 = await request(app).delete(
        `/api/diagrams/by-lp/${learningPathId}`,
      );
      expect(delete1.status).toBe(204);

      // Recreate with same learningPathId (should work after delete)
      const create2 = await request(app)
        .post('/api/diagrams/by-lp')
        .send({ learningPathId, name: 'Cycle Test Recreated' });
      expect(create2.status).toBe(201);
      expect(create2.body.name).toBe('Cycle Test Recreated');

      // Verify only one diagram exists
      const count = await DiagramModel.countDocuments({ learningPathId });
      expect(count).toBe(1);
    });
  });

  // ============================================================================
  // CONCURRENT REQUEST HANDLING
  // ============================================================================

  describe('Concurrent Request Handling', () => {
    it('should handle concurrent creates with same learningPathId idempotently', async () => {
      const learningPathId = 'concurrent-create-uuid';
      const numRequests = 10;

      const promises = Array(numRequests)
        .fill(null)
        .map(() =>
          request(app)
            .post('/api/diagrams/by-lp')
            .send({ learningPathId, name: 'Concurrent Create' }),
        );

      const responses = await Promise.all(promises);

      // Count successes (200 or 201)
      const successCount = responses.filter(
        (r) => r.status === 200 || r.status === 201,
      ).length;
      expect(successCount).toBe(numRequests);

      // Exactly one should be 201 (created), rest should be 200 (idempotent)
      const createdCount = responses.filter((r) => r.status === 201).length;
      const idempotentCount = responses.filter((r) => r.status === 200).length;
      expect(createdCount).toBe(1);
      expect(idempotentCount).toBe(numRequests - 1);

      // Only one diagram in database
      const count = await DiagramModel.countDocuments({ learningPathId });
      expect(count).toBe(1);
    });

    it('should handle concurrent creates with different learningPathIds', async () => {
      const numRequests = 5;

      const promises = Array(numRequests)
        .fill(null)
        .map((_, i) =>
          request(app)
            .post('/api/diagrams/by-lp')
            .send({
              learningPathId: `parallel-create-${i}`,
              name: `Parallel Create ${i}`,
            }),
        );

      const responses = await Promise.all(promises);

      // All should be 201 (created)
      responses.forEach((response) => {
        expect(response.status).toBe(201);
      });

      // All diagrams should exist
      const count = await DiagramModel.countDocuments({});
      expect(count).toBe(numRequests);
    });

    it('should handle concurrent deletes idempotently', async () => {
      const learningPathId = 'concurrent-delete-uuid';

      // First create a diagram
      await request(app)
        .post('/api/diagrams/by-lp')
        .send({ learningPathId, name: 'To Delete Concurrently' });

      // Concurrent deletes
      const numRequests = 5;
      const promises = Array(numRequests)
        .fill(null)
        .map(() => request(app).delete(`/api/diagrams/by-lp/${learningPathId}`));

      const responses = await Promise.all(promises);

      // One should be 204 (deleted), rest should be 404 (already deleted)
      const deletedCount = responses.filter((r) => r.status === 204).length;
      const notFoundCount = responses.filter((r) => r.status === 404).length;
      expect(deletedCount).toBe(1);
      expect(notFoundCount).toBe(numRequests - 1);

      // Diagram should not exist
      const count = await DiagramModel.countDocuments({ learningPathId });
      expect(count).toBe(0);
    });
  });

  // ============================================================================
  // DATA CONSISTENCY TESTS
  // ============================================================================

  describe('Data Consistency', () => {
    it('should maintain unique learningPathId constraint', async () => {
      const learningPathId = 'unique-lp-uuid';

      // Create first diagram
      await DiagramModel.create({
        learningPathId,
        name: 'First Diagram',
        nodes: [],
        edges: [],
      });

      // Attempt to create via API with same learningPathId
      const response = await request(app)
        .post('/api/diagrams/by-lp')
        .send({ learningPathId, name: 'Second Diagram' });

      // Should return 200 (idempotent) with first diagram
      expect(response.status).toBe(200);
      expect(response.body.name).toBe('First Diagram');
    });

    it('should maintain unique name constraint across different learningPathIds', async () => {
      // Create first diagram with specific name
      await request(app)
        .post('/api/diagrams/by-lp')
        .send({ learningPathId: 'uuid-1', name: 'Unique Name' });

      // Attempt to create with different learningPathId but same name
      const response = await request(app)
        .post('/api/diagrams/by-lp')
        .send({ learningPathId: 'uuid-2', name: 'Unique Name' });

      // Should return 409 Conflict
      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already exists');
    });

    it('should populate default template nodes and edges', async () => {
      const response = await request(app)
        .post('/api/diagrams/by-lp')
        .send({ learningPathId: 'template-test-uuid', name: 'Template Test' });

      expect(response.status).toBe(201);

      // Verify default template is applied
      expect(Array.isArray(response.body.nodes)).toBe(true);
      expect(Array.isArray(response.body.edges)).toBe(true);
      expect(response.body.nodes.length).toBeGreaterThan(0);
      expect(response.body.edges.length).toBeGreaterThan(0);

      // Verify node structure
      const firstNode = response.body.nodes[0];
      expect(firstNode).toHaveProperty('id');
      expect(firstNode).toHaveProperty('type');
      expect(firstNode).toHaveProperty('position');
    });

    it('should preserve diagram data after retrieval', async () => {
      const learningPathId = 'preserve-data-uuid';
      const customName = 'Preserved Diagram';

      // Create diagram
      const createResponse = await request(app)
        .post('/api/diagrams/by-lp')
        .send({ learningPathId, name: customName });

      expect(createResponse.status).toBe(201);
      const originalDiagram = createResponse.body;

      // Retrieve from database
      const dbDiagram = await DiagramModel.findOne({ learningPathId });

      // Compare key fields
      expect(dbDiagram?._id.toString()).toBe(originalDiagram._id);
      expect(dbDiagram?.learningPathId).toBe(originalDiagram.learningPathId);
      expect(dbDiagram?.name).toBe(originalDiagram.name);
      expect(dbDiagram?.nodes.length).toBe(originalDiagram.nodes.length);
      expect(dbDiagram?.edges.length).toBe(originalDiagram.edges.length);
    });
  });

  // NOTE: Basic error handling tests (404, name fallback) are in unit tests.
  // Integration tests focus on workflow scenarios.

  // ============================================================================
  // BATCH OPERATIONS TESTS
  // ============================================================================

  describe('Batch Operations', () => {
    it('should handle multiple sequential create-delete operations', async () => {
      const operations = 10;

      for (let i = 0; i < operations; i++) {
        const learningPathId = `batch-${i}`;

        // Create
        const createRes = await request(app)
          .post('/api/diagrams/by-lp')
          .send({ learningPathId, name: `Batch ${i}` });
        expect(createRes.status).toBe(201);

        // Delete
        const deleteRes = await request(app).delete(
          `/api/diagrams/by-lp/${learningPathId}`,
        );
        expect(deleteRes.status).toBe(204);
      }

      // Verify no diagrams remain
      const count = await DiagramModel.countDocuments({});
      expect(count).toBe(0);
    });

    it('should handle creating many diagrams then deleting all', async () => {
      const numDiagrams = 20;

      // Create many diagrams
      const createPromises = Array(numDiagrams)
        .fill(null)
        .map((_, i) =>
          request(app)
            .post('/api/diagrams/by-lp')
            .send({ learningPathId: `bulk-${i}`, name: `Bulk ${i}` }),
        );

      const createResponses = await Promise.all(createPromises);
      createResponses.forEach((r) => expect(r.status).toBe(201));

      // Verify all created
      let count = await DiagramModel.countDocuments({});
      expect(count).toBe(numDiagrams);

      // Delete all
      const deletePromises = Array(numDiagrams)
        .fill(null)
        .map((_, i) => request(app).delete(`/api/diagrams/by-lp/bulk-${i}`));

      const deleteResponses = await Promise.all(deletePromises);
      deleteResponses.forEach((r) => expect(r.status).toBe(204));

      // Verify all deleted
      count = await DiagramModel.countDocuments({});
      expect(count).toBe(0);
    });
  });

  // ============================================================================
  // SAGA COMPENSATION SIMULATION TESTS
  // ============================================================================

  describe('SAGA Compensation Simulation', () => {
    it('should support compensation scenario: create then immediate delete', async () => {
      const learningPathId = 'compensation-sim-uuid';

      // Simulate: Backend creates diagram
      const createRes = await request(app)
        .post('/api/diagrams/by-lp')
        .send({ learningPathId, name: 'Compensation Test' });
      expect(createRes.status).toBe(201);

      // Simulate: Backend's step 2 fails, compensation deletes diagram
      const deleteRes = await request(app).delete(
        `/api/diagrams/by-lp/${learningPathId}`,
      );
      expect(deleteRes.status).toBe(204);

      // Verify diagram is gone (compensation successful)
      const diagram = await DiagramModel.findOne({ learningPathId });
      expect(diagram).toBeNull();
    });

    it('should support retry after compensation', async () => {
      const learningPathId = 'retry-after-comp-uuid';

      // First attempt: create then compensate
      await request(app)
        .post('/api/diagrams/by-lp')
        .send({ learningPathId, name: 'First Attempt' });
      await request(app).delete(`/api/diagrams/by-lp/${learningPathId}`);

      // Second attempt: should succeed as new creation
      const retryRes = await request(app)
        .post('/api/diagrams/by-lp')
        .send({ learningPathId, name: 'Retry Attempt' });

      expect(retryRes.status).toBe(201);
      expect(retryRes.body.name).toBe('Retry Attempt');

      // Verify diagram exists
      const diagram = await DiagramModel.findOne({ learningPathId });
      expect(diagram).not.toBeNull();
      expect(diagram?.name).toBe('Retry Attempt');
    });

    it('should handle compensation for non-existent diagram gracefully', async () => {
      // Simulate: Backend tries to compensate for diagram that was never created
      const deleteRes = await request(app).delete(
        '/api/diagrams/by-lp/never-created-uuid',
      );

      // Should return 404 but not crash
      expect(deleteRes.status).toBe(404);
    });
  });
});
