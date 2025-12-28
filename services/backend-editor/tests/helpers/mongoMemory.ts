import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { beforeAll, afterAll, beforeEach } from 'vitest';

let mongoServer: MongoMemoryServer;

/**
 * Sets up an in-memory MongoDB instance for testing.
 * Call this in your test files to get a clean database for each test run.
 */
export const setupTestDB = () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear all collections before each test
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  });
};

/**
 * Gets the current MongoDB URI (for use in tests that need the URI)
 */
export const getMongoUri = () => mongoServer?.getUri();
