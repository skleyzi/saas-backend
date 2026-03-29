import { PaginationQueryDto } from '@common/dto/pagination-query.dto';
import { SubscriptionStatus } from '@db/enums';
import { PrismaService } from '@modules/prisma/prisma.service';
import { UpdateProfileDto } from '@modules/users/dto/update-profile.dto';
import { UpdateUserDto } from '@modules/users/dto/update-user.dto';
import { Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly userSelect = {
    id: true,
    email: true,
    name: true,
    role: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
  } as const;

  async findById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: this.userSelect,
    });

    if (!user) throw new NotFoundException('User not found');

    return user;
  }

  async getAdminUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscriptions: {
          where: {
            status: {
              in: [
                SubscriptionStatus.ACTIVE,
                SubscriptionStatus.TRIALING,
                SubscriptionStatus.PAST_DUE,
              ],
            },
          },
          include: { plan: true },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    return user;
  }

  async getAllUsers(query: PaginationQueryDto) {
    const { limit, cursor } = query;

    const users = await this.prisma.user.findMany({
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      orderBy: { id: 'asc' },
      select: this.userSelect,
    });

    const hasNextPage = users.length > limit;

    const items = hasNextPage ? users.slice(0, -1) : users;

    const lastItem = items[items.length - 1];
    const nextCursor = hasNextPage ? lastItem.id : null;

    return {
      data: items,
      meta: {
        hasNextPage,
        nextCursor,
      },
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    return await this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: this.userSelect,
    });
  }

  async updateUser(userId: string, dto: UpdateUserDto) {
    return await this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: this.userSelect,
    });
  }

  async deleteById(userId: string) {
    await this.prisma.user.delete({ where: { id: userId } });
  }
}
