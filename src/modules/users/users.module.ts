import { UsersController } from '@modules/users/users.controller';
import { UsersService } from '@modules/users/users.service';
import { Module } from '@nestjs/common';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
