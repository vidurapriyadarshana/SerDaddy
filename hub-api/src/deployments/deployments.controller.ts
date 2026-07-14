import { Controller, Post, Get, Param } from '@nestjs/common';
import { DeploymentsService } from './deployments.service';

@Controller('api')
export class DeploymentsController {
  constructor(private readonly service: DeploymentsService) {}

  @Post('projects/:id/deploy')
  async deployProject(@Param('id') projectId: string) {
    return this.service.triggerDeployment(projectId);
  }

  @Get('deployments/:id/logs')
  async getLogs(@Param('id') deploymentId: string) {
    return this.service.getDeploymentLogs(deploymentId);
  }

  @Post('deployments/:id/rollback')
  async rollback(@Param('id') deploymentId: string) {
    return this.service.triggerRollback(deploymentId);
  }
}
