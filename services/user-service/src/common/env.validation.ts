const REQUIRED = [
  'JWT_SECRET',
  'POSTGRES_HOST',
  'POSTGRES_PORT',
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'POSTGRES_DB',
  'RABBITMQ_URL',
] as const;

export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const missing: string[] = [];
  for (const key of REQUIRED) {
    const v = config[key];
    if (typeof v !== 'string' || v.trim() === '') {
      missing.push(key);
    }
  }
  if (missing.length) {
    throw new Error(
      `[user-service] Missing required env vars: ${missing.join(', ')}`,
    );
  }

  const portRaw =
    typeof config.POSTGRES_PORT === 'string' ? config.POSTGRES_PORT : '';
  const port = Number(portRaw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `[user-service] POSTGRES_PORT must be a valid port, got "${portRaw}"`,
    );
  }

  if (config.NODE_ENV === 'production') {
    const secret =
      typeof config.JWT_SECRET === 'string' ? config.JWT_SECRET : '';
    if (secret.length < 32) {
      throw new Error(
        '[user-service] JWT_SECRET must be at least 32 characters in production',
      );
    }
    if (
      secret === 'dev-jwt-secret' ||
      secret === 'your-secret-key-change-in-production'
    ) {
      throw new Error(
        '[user-service] JWT_SECRET is set to a known default value — generate a strong secret',
      );
    }
    const fe =
      typeof config.FRONTEND_URL === 'string' ? config.FRONTEND_URL : '';
    if (!fe || !fe.startsWith('https://')) {
      throw new Error(
        '[user-service] FRONTEND_URL must be set to an https:// origin in production',
      );
    }
  }

  return config;
}
