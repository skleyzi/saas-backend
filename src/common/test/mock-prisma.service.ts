export const createMockPrismaService = () => ({
  user: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  session: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  subscription: {
    findFirst: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  resource: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  plan: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    upsert: jest.fn(),
    updateMany: jest.fn(),
  },
  webhookEvent: {
    create: jest.fn(),
    update: jest.fn(),
  },
});
