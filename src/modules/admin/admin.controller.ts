import { PaginationQueryDto } from '@common/dto/pagination-query.dto';
import { AdminGuard } from '@common/guards/admin.guard';
import { AdminUserResponseDto } from '@modules/users/dto/admin-user-response.dto';
import { UpdateUserDto } from '@modules/users/dto/update-user.dto';
import { UserResponseDto } from '@modules/users/dto/user-response.dto';
import { UsersService } from '@modules/users/users.service';
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';

@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly usersService: UsersService) {}

  @Get('users')
  async getAllUsers(@Query() query: PaginationQueryDto): Promise<{
    data: UserResponseDto[];
    meta: { hasNextPage: boolean; nextCursor: string | null };
  }> {
    const result = await this.usersService.getAllUsers(query);
    return {
      data: result.data.map((user) => new UserResponseDto(user)),
      meta: result.meta,
    };
  }

  @Get('users/:userId')
  async getUserById(
    @Param('userId') userId: string,
  ): Promise<AdminUserResponseDto> {
    const user = await this.usersService.getAdminUserById(userId);
    return new AdminUserResponseDto(user);
  }

  @Patch('users/:userId')
  async updateUser(
    @Param('userId') userId: string,
    @Body() updateuserDto: UpdateUserDto,
  ): Promise<AdminUserResponseDto> {
    const updatedUser = await this.usersService.updateUser(
      userId,
      updateuserDto,
    );
    return new AdminUserResponseDto(updatedUser);
  }
}
