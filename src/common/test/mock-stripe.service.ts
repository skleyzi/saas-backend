export const createMockStripeService = () => ({
  createCustomer: jest.fn(),
  createCheckoutSession: jest.fn(),
  retrieveCustomer: jest.fn(),
  retrieveProduct: jest.fn(),
  retrieveSubscription: jest.fn(),
  retrievePrice: jest.fn(),
  constructWebhookEvent: jest.fn(),
  cancelSubscription: jest.fn(),
  resumeSubscription: jest.fn(),
  cancelSubscriptionImmediately: jest.fn(),
  createPortalSession: jest.fn(),
  hasActiveSubscription: jest.fn(),
});
