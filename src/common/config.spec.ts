import { validateEnvironment } from './config';

const validConfig = {
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/grocery?schema=public',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  PAYMENT_WEBHOOK_SECRET: 'c'.repeat(32),
  PORT: '3000',
};

describe('validateEnvironment', () => {
  it('accepts configured database, secrets, and port', () => {
    expect(validateEnvironment(validConfig)).toBe(validConfig);
  });

  it('explains how to configure a missing required variable', () => {
    expect(() => validateEnvironment({ ...validConfig, JWT_ACCESS_SECRET: '' })).toThrow(
      'JWT_ACCESS_SECRET is required. Copy .env.example to .env and configure it before starting the API.',
    );
  });

  it('rejects placeholder secrets', () => {
    expect(() =>
      validateEnvironment({ ...validConfig, JWT_REFRESH_SECRET: 'replace-with-a-long-random-refresh-secret' }),
    ).toThrow('JWT_REFRESH_SECRET must be replaced with a unique secret of at least 32 characters.');
  });
});
