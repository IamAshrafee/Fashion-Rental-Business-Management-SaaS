export default () => ({
  // Application
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.APP_PORT || '4000', 10),
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  apiUrl: process.env.API_URL || 'http://localhost:4000/api',
  corsOrigins: process.env.CORS_ORIGINS || 'http://localhost:3000',

  // Database
  database: {
    url: process.env.DATABASE_URL,
  },

  // Redis
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },

  // Storage (MinIO / S3)
  storage: {
    endpoint: process.env.STORAGE_ENDPOINT || 'http://localhost:9000',
    port: parseInt(process.env.STORAGE_PORT || '9000', 10),
    accessKey: process.env.STORAGE_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.STORAGE_SECRET_KEY || 'minioadmin',
    bucket: process.env.STORAGE_BUCKET || 'closetrent-dev',
    region: process.env.STORAGE_REGION || 'us-east-1',
    useSSL: process.env.STORAGE_USE_SSL === 'true',
    publicUrl: process.env.STORAGE_PUBLIC_URL || 'http://localhost:9000/closetrent-dev',
  },

  // Authentication
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production',
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },
  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),

  // Domain
  baseDomain: process.env.BASE_DOMAIN || 'localhost:3000',
  adminSubdomain: process.env.ADMIN_SUBDOMAIN || 'admin',

  // Image Processing
  image: {
    maxSizeMb: parseInt(process.env.MAX_IMAGE_SIZE_MB || '5', 10),
    quality: parseInt(process.env.IMAGE_QUALITY || '80', 10),
    maxWidth: parseInt(process.env.IMAGE_MAX_WIDTH || '1920', 10),
    maxHeight: parseInt(process.env.IMAGE_MAX_HEIGHT || '1920', 10),
    thumbnailWidth: parseInt(process.env.THUMBNAIL_WIDTH || '400', 10),
    thumbnailHeight: parseInt(process.env.THUMBNAIL_HEIGHT || '400', 10),
  },
});
