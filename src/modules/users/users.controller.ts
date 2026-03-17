import { CurrentUser } from '@common/decorators/current-user.decorator';
import { RequestUser } from '@common/types/auth-request.types';
import { UserResponseDto } from '@modules/users/dto/user-response.dto';
import { UsersService } from '@modules/users/users.service';
import { Controller, Get } from '@nestjs/common';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: RequestUser) {
    return new UserResponseDto(user);
  }
}
