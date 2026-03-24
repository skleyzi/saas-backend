import { createMockPrismaService } from '@common/test/mock-prisma.service';
import { Prisma } from '@db/client';
import { BillingInterval, SubscriptionStatus } from '@db/enums';
import { PrismaService } from '@modules/prisma/prisma.service';
import { ResourcesService } from '@modules/resources/resources.service';
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

describe('ResourcesService', () => {
  let resourcesService: ResourcesService;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;

  const userId = 'user-id';
  const resourceId = 'resource-id';

  const createPrismaNotFoundError = () =>
    new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '5.0.0',
    });

  beforeEach(async () => {
    mockPrisma = createMockPrismaService();

    const module = await Test.createTestingModule({
      providers: [
        ResourcesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    resourcesService = module.get<ResourcesService>(ResourcesService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('create', () => {
    const subscriptionWithPlan = {
      id: 'id',
      userId,
      planId: 'plan-id',
      stripeSubscriptionId: 'sub-id',
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 3600 * 24 * 1000),
      cancelAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      plan: {
        id: 'plan-id',
        name: 'Gold Plan',
        priceInCents: 1000,
        currency: 'USD',
        interval: BillingInterval.MONTH,
        intervalCount: 1,
        stripePriceId: 'price-id',
        stripeProductId: 'product-id',
        maxResources: 2,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    const createDto = {
      title: 'Resource 1',
      content: 'Some Content',
    };

    const createdResource = {
      id: 'resource-id',
      ...createDto,
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should create and return resource', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(subscriptionWithPlan);
      mockPrisma.resource.count.mockResolvedValue(0);
      mockPrisma.resource.create.mockResolvedValue(createdResource);

      const result = await resourcesService.create(userId, createDto);
      expect(result).toEqual(createdResource);
    });

    it('should throw if user has no active subscription', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(null);

      await expect(resourcesService.create(userId, createDto)).rejects.toThrow(
        'Active subscription required',
      );
    });

    it('should throw if user has reached plan limit', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(subscriptionWithPlan);
      mockPrisma.resource.count.mockResolvedValue(2);

      await expect(resourcesService.create(userId, createDto)).rejects.toThrow(
        'Plan limit reached (2 resources max)',
      );
    });

    it('should rethrow unknown errors', async () => {
      mockPrisma.subscription.findFirst.mockRejectedValue(
        new Error('connection failed'),
      );

      await expect(resourcesService.create(userId, createDto)).rejects.toThrow(
        'connection failed',
      );
    });
  });

  describe('list', () => {
    const resources = [
      {
        id: 'resource-id',
        title: 'Resource 1',
        content: 'Some Content',
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    it('should return resources', async () => {
      mockPrisma.resource.findMany.mockResolvedValue(resources);

      const result = await resourcesService.list(userId);
      expect(result).toEqual(resources);
    });

    it('should return empty array when no resources exist', async () => {
      mockPrisma.resource.findMany.mockResolvedValue([]);

      const result = await resourcesService.list(userId);
      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    const resource = {
      id: resourceId,
      title: 'Resource 1',
      content: 'Some Content',
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should return resource', async () => {
      mockPrisma.resource.findFirst.mockResolvedValue(resource);

      const result = await resourcesService.findById(userId, resourceId);
      expect(result).toEqual(resource);
    });

    it('should throw if resource not found', async () => {
      mockPrisma.resource.findFirst.mockResolvedValue(null);

      await expect(
        resourcesService.findById(userId, resourceId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto = {
      title: 'Updated Title',
      content: 'Updated Content',
    };

    const updatedResource = {
      id: resourceId,
      ...updateDto,
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should update resource and return updated resource', async () => {
      mockPrisma.resource.update.mockResolvedValue(updatedResource);

      const result = await resourcesService.update(
        userId,
        resourceId,
        updateDto,
      );
      expect(result).toEqual(updatedResource);
    });

    it('should throw if resource not found', async () => {
      mockPrisma.resource.update.mockRejectedValue(createPrismaNotFoundError());

      await expect(
        resourcesService.update(userId, resourceId, updateDto),
      ).rejects.toThrow(Prisma.PrismaClientKnownRequestError);
    });
  });

  describe('delete', () => {
    it('should delete resource', async () => {
      mockPrisma.resource.delete.mockResolvedValue({
        id: resourceId,
        userId,
        title: 'Resource 1',
        content: 'Some Content',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await resourcesService.delete(userId, resourceId);

      expect(mockPrisma.resource.delete).toHaveBeenCalledWith({
        where: { id: resourceId, userId },
      });
    });

    it('should throw if resource not found', async () => {
      mockPrisma.resource.delete.mockRejectedValue(createPrismaNotFoundError());

      await expect(resourcesService.delete(userId, resourceId)).rejects.toThrow(
        Prisma.PrismaClientKnownRequestError,
      );
    });
  });
});
