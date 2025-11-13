// Script to clear Yjs persistence data from MongoDB
// Run with: node clear-yjs-persistence.js

const { MongoClient } = require('mongodb');

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/carbyte-editor';

async function clearYjsPersistence() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db();
    const collections = await db.listCollections().toArray();

    console.log('\nAvailable collections:');
    collections.forEach((col) => console.log('- ' + col.name));

    // y-mongodb typically creates collections like 'ydocs' or 'y-updates'
    const yjsCollections = collections.filter(
      (col) =>
        col.name.startsWith('y') ||
        col.name.includes('doc') ||
        col.name.includes('update'),
    );

    if (yjsCollections.length === 0) {
      console.log('\nNo Yjs persistence collections found.');
    } else {
      console.log('\nClearing Yjs persistence collections:');
      for (const col of yjsCollections) {
        const count = await db.collection(col.name).countDocuments();
        if (count > 0) {
          await db.collection(col.name).deleteMany({});
          console.log(`✓ Cleared ${col.name} (${count} documents)`);
        }
      }
    }

    console.log('\n✓ Done!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

clearYjsPersistence();
