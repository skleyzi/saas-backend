import { SubscriptionStatus } from '@db/enums';
import { PrismaService } from '@modules/prisma/prisma.service';
import { CreateResourceDto } from '@modules/resources/dto/create-resource.dto';
import {
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

@Injectable()
export class ResourcesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, createResourceDto: CreateResourceDto) {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: {
          in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING],
        },
      },
      include: { plan: true },
    });

    if (!subscription) {
      throw new HttpException('Active subscription required', 402);
    }

    const count = await this.prisma.resource.count({ where: { userId } });

    if (count >= subscription.plan.maxResources) {
      throw new ForbiddenException(
        `Plan limit reached (${subscription.plan.maxResources} resources max)`,
      );
    }

    return await this.prisma.resource.create({
      data: { ...createResourceDto, userId },
    });
  }

  async list(userId: string) {
    return await this.prisma.resource.findMany({ where: { userId } });
  }

  async findById(userId: string, resourceId: string) {
    const resource = await this.prisma.resource.findFirst({
      where: { id: resourceId, userId },
    });

    if (!resource) throw new NotFoundException('Resource not found');

    return resource;
  }
}
