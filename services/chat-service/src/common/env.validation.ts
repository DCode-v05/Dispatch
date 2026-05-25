const REQUIRED = ['JWT_SECRET', 'MONGODB_URI', 'RABBITMQ_URL'] as const;

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
      `[chat-service] Missing required env vars: ${missing.join(', ')}`,
    );
  }

  if (config.NODE_ENV === 'production') {
    const secret =
      typeof config.JWT_SECRET === 'string' ? config.JWT_SECRET : '';
    if (secret.length < 32) {
      throw new Error(
        '[chat-service] JWT_SECRET must be at least 32 characters in production',
      );
    }
    if (
      secret === 'dev-jwt-secret' ||
      secret === 'your-secret-key-change-in-production'
    ) {
      throw new Error(
        '[chat-service] JWT_SECRET is set to a known default value — generate a strong secret',
      );
    }
    const fe =
      typeof config.FRONTEND_URL === 'string' ? config.FRONTEND_URL : '';
    if (!fe || !fe.startsWith('https://')) {
      throw new Error(
        '[chat-service] FRONTEND_URL must be set to an https:// origin in production',
      );
    }
  }

  return config;
}
