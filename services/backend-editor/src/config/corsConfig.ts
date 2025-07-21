import cors from 'cors';

const CORS_ORIGINS = (
  process.env.CORS_ORIGINS ||
  'http://localhost:5173,http://localhost:8080,http://127.0.0.1:5173'
).split(',');

export const corsOptions = {
  origin: CORS_ORIGINS,
  credentials: true,
};

export default cors(corsOptions);
