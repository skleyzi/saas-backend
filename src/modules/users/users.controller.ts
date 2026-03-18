import { CurrentUser } from '@common/decorators/current-user.decorator';
import { RequestUser } from '@common/types/auth-request.types';
import { UpdateProfileDto } from '@modules/users/dto/update-profile.dto';
import { UserResponseDto } from '@modules/users/dto/user-response.dto';
import { UsersService } from '@modules/users/users.service';
import { Body, Controller, Get, Patch } from '@nestjs/common';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: RequestUser): UserResponseDto {
    return new UserResponseDto(user);
  }

  @Patch('me')
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() updateDto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    const user = await this.usersService.update(userId, updateDto);
    return new UserResponseDto(user);
  }
}
