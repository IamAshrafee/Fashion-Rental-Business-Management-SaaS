const PRODUCTION_REQUIRED = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'CORS_ORIGINS',
  'SMS_PROVIDER_URL',
  'SMS_PROVIDER_API_KEY',
  'BULL_BOARD_USERNAME',
  'BULL_BOARD_PASSWORD',
] as const;

export function validateEnvironment(environment: Record<string, unknown>) {
  if (environment.NODE_ENV !== 'production') return environment;
  const credentialsKey = String(
    environment.CREDENTIALS_ENCRYPTION_KEY
    || environment.COURIER_CREDENTIALS_ENCRYPTION_KEY
    || '',
  );
  const missing = PRODUCTION_REQUIRED.filter(
    (key) => typeof environment[key] !== 'string' || !String(environment[key]).trim(),
  );
  if (missing.length)
    throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
  if (!credentialsKey) {
    throw new Error('Missing required production environment variable: CREDENTIALS_ENCRYPTION_KEY');
  }
  for (const key of [
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
  ] as const) {
    if (
      String(environment[key]).length < 32 ||
      String(environment[key]).includes('change-in-production')
    ) {
      throw new Error(
        `${key} must be a non-default secret of at least 32 characters in production`,
      );
    }
  }
  if (credentialsKey.length < 32 || credentialsKey.includes('change-in-production')) {
    throw new Error(
      'CREDENTIALS_ENCRYPTION_KEY must be a non-default secret of at least 32 characters in production',
    );
  }
  return environment;
}
