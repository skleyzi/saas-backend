export const mockConfigService = {
  getOrThrow: jest.fn((key: string) => {
    const config: Record<string, string> = {
      JWT_ACCESS_SECRET: 'test-access-secret',
      JWT_REFRESH_SECRET: 'test-refresh-secret',
      JWT_ACCESS_EXPIRES_IN_SECONDS: '900',
      JWT_REFRESH_EXPIRES_IN_SECONDS: '604800',
      STRIPE_SECRET_KEY: 'sk_test_dummy',
      STRIPE_WEBHOOK_SECRET: 'whsec_dummy',
      SUCCESS_URL: 'http://localhost:3000/success',
      CANCEL_URL: 'http://localhost:3000/cancel',
      BILLING_SETTINGS_URL: 'http://localhost:3000/billing',
    };
    if (!config[key]) throw new Error(`Missing test config: ${key}`);
    return config[key];
  }),
};
