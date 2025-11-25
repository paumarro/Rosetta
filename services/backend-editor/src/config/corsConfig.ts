import cors from 'cors';

const CORS_ORIGINS = (
  process.env.CORS_ORIGINS ||
  'http://localhost:5173,http://localhost:5174,http://localhost:8080,http://127.0.0.1:5173,http://127.0.0.1:5174'
)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const allowedSet = new Set(CORS_ORIGINS);
const dynamicMatchers = [
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
];

export const corsOptions = {
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ) => {
    if (!origin) {
      callback(null, true);
      return;
    } // allow non-browser tools
    if (
      allowedSet.has(origin) ||
      dynamicMatchers.some((re) => re.test(origin))
    ) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
  credentials: true,
};

export default cors(corsOptions);
