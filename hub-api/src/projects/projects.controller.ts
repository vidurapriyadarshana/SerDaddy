import { Controller, Get, Post, Delete, Body, Param, Headers } from '@nestjs/common';
import { ProjectsService } from './projects.service';

@Controller('api/projects')
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}

  @Post()
  async create(
    @Headers('x-user-id') userId: string,
    @Body() data: { serverId: string; repoUrl: string; branch: string; subdomain: string }
  ) {
    return this.service.createProject(userId, data);
  }

  @Get()
  async findAll(@Headers('x-user-id') userId: string) {
    return this.service.findAll(userId);
  }

  @Get(':id')
  async findOne(
    @Headers('x-user-id') userId: string,
    @Param('id') id: string
  ) {
    return this.service.findOne(userId, id);
  }

  @Post(':id/env')
  async addEnv(
    @Param('id') projectId: string,
    @Body() data: { key: string; value: string }
  ) {
    return this.service.addEnvVariable(projectId, data.key, data.value);
  }

  @Delete(':id/env/:key')
  async removeEnv(
    @Param('id') projectId: string,
    @Param('key') key: string
  ) {
    return this.service.removeEnvVariable(projectId, key);
  }
}
