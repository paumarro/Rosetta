import mongoose from 'mongoose';

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/carbyte-editor';

// MongoDB Connection with retry logic
export const connectDB = async () => {
  const MAX_RETRIES = 5;
  const RETRY_DELAY = 5000; // 5 seconds
  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      await mongoose.connect(MONGODB_URI);
      console.log('Connected to MongoDB');
      return;
    } catch (error) {
      console.error(
        `Failed to connect to MongoDB (attempt ${String(retries + 1)}/${String(MAX_RETRIES)}):`,
        error,
      );
      retries++;
      if (retries < MAX_RETRIES) {
        console.log(`Retrying in ${String(RETRY_DELAY / 1000)} seconds...`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      }
    }
  }

  console.error('Failed to connect to MongoDB after maximum retries');
  process.exit(1);
};
