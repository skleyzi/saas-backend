import { CurrentUser } from '@common/decorators/current-user.decorator';
import { CreateResourceDto } from '@modules/resources/dto/create-resource.dto';
import { ResourceResponseDto } from '@modules/resources/dto/resource-response.dto';
import { UpdateResourceDto } from '@modules/resources/dto/update-resource.dto';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
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

  @Get()
  async listResources(
    @CurrentUser('id') userId: string,
  ): Promise<ResourceResponseDto[]> {
    const resources = await this.resourcesService.list(userId);
    return resources.map((r) => new ResourceResponseDto(r));
  }

  @Get(':id')
  async getResource(
    @CurrentUser('id') userId: string,
    @Param('id') resourceId: string,
  ): Promise<ResourceResponseDto> {
    const resource = await this.resourcesService.findById(userId, resourceId);
    return new ResourceResponseDto(resource);
  }

  @Patch(':id')
  async updateResource(
    @CurrentUser('id') userId: string,
    @Param('id') resourceId: string,
    @Body() dto: UpdateResourceDto,
  ): Promise<ResourceResponseDto> {
    const resource = await this.resourcesService.update(
      userId,
      resourceId,
      dto,
    );
    return new ResourceResponseDto(resource);
  }

  @Delete(':id')
  @HttpCode(204)
  async deleteResource(
    @CurrentUser('id') userId: string,
    @Param('id') resourceId: string,
  ): Promise<void> {
    await this.resourcesService.delete(userId, resourceId);
  }
}
