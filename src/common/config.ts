const requiredVariables = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'PAYMENT_WEBHOOK_SECRET'];
const secretVariables = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'PAYMENT_WEBHOOK_SECRET'];

export function validateEnvironment(config: Record<string, unknown>): Record<string, unknown> {
  for (const name of requiredVariables) {
    const value = config[name];
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`${name} is required. Copy .env.example to .env and configure it before starting the API.`);
    }
  }

  for (const name of secretVariables) {
    const value = config[name] as string;
    if (value.length < 32 || value.toLowerCase().includes('replace-with-')) {
      throw new Error(`${name} must be replaced with a unique secret of at least 32 characters.`);
    }
  }

  const port = config.PORT;
  if (port !== undefined && (!/^\d+$/.test(String(port)) || Number(port) < 1 || Number(port) > 65535)) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  return config;
}
