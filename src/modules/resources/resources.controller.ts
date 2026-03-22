import { CurrentUser } from '@common/decorators/current-user.decorator';
import { CreateResourceDto } from '@modules/resources/dto/create-resource.dto';
import { ResourceResponseDto } from '@modules/resources/dto/resource-response.dto';
import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ResourcesService } from './resources.service';

@Controller('resources')
@ApiBearerAuth('accessToken')
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  @Post()
  async createResource(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateResourceDto,
  ): Promise<ResourceResponseDto> {
    const resource = await this.resourcesService.create(userId, dto);
    return new ResourceResponseDto(resource);
  }
}
