import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DeploymentsProcessor } from './deployments.processor';
import { AgentGateway } from '../socket/agent.gateway';

@Injectable()
export class DeploymentsService {
  constructor(
    private prisma: PrismaService,
    private processor: DeploymentsProcessor,
    private gateway: AgentGateway
  ) {}

  async triggerDeployment(projectId: string, commitHash?: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { server: true },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found.`);
    }

    // Set project status to DEPLOYING
    await this.prisma.project.update({
      where: { id: projectId },
      data: { status: 'DEPLOYING' },
    });

    // Create a new Deployment record in DB
    const deployment = await this.prisma.deployment.create({
      data: {
        projectId,
        commitHash: commitHash || 'latest',
        buildStatus: 'QUEUED',
        logSummary: `[SerDaddy] Deployment triggered for project ${project.subdomain}.\n[SerDaddy] Job scheduled in-memory.\n`,
      },
    });

    // Invoke processor asynchronously in-memory to execute the build runner pipeline
    setTimeout(() => {
      this.processor.handleDeployJob({
        data: {
          projectId,
          deploymentId: deployment.id,
          commitHash: commitHash || 'latest',
        },
      } as any).catch(err => {
        console.error(`[SerDaddy] In-memory deployment processor error:`, err.message);
      });
    }, 100);

    return deployment;
  }

  async getDeploymentLogs(deploymentId: string) {
    const deployment = await this.prisma.deployment.findUnique({
      where: { id: deploymentId },
    });

    if (!deployment) {
      throw new NotFoundException(`Deployment with ID ${deploymentId} not found.`);
    }

    return {
      deploymentId: deployment.id,
      logs: deployment.logSummary,
    };
  }

  async triggerRollback(deploymentId: string) {
    const deployment = await this.prisma.deployment.findUnique({
      where: { id: deploymentId },
      include: {
        project: {
          include: { server: true },
        },
      },
    });

    if (!deployment) {
      throw new NotFoundException(`Deployment with ID ${deploymentId} not found.`);
    }

    if (deployment.buildStatus !== 'SUCCESS') {
      throw new BadRequestException(`Cannot roll back to an unsuccessful deployment.`);
    }

    if (!deployment.releasePath) {
      throw new BadRequestException(`Deployment release path is missing. Cannot perform rollback.`);
    }

    const project = deployment.project;
    const serverId = project.serverId;

    // Standard Go Agent project folder extraction (repoUrl suffix parsing)
    const parts = project.repoUrl.split('/');
    const lastPart = parts[parts.length - 1];
    const projectName = lastPart.replace(/\.git$/, '');

    const payload = {
      projectName,
      assignedPort: project.port,
      targetReleasePath: deployment.releasePath,
    };

    // Dispatch deploy:rollback to Go Agent
    const sent = this.gateway.sendToAgent(serverId, 'deploy:rollback', payload);
    if (!sent) {
      throw new BadRequestException(`Target agent is OFFLINE. Cannot perform rollback.`);
    }

    // Set project state to SUCCESS on successful rollback swap
    await this.prisma.project.update({
      where: { id: project.id },
      data: { status: 'SUCCESS' },
    });

    // Create a new success deployment entry in history representing the rollback
    return this.prisma.deployment.create({
      data: {
        projectId: project.id,
        commitHash: deployment.commitHash,
        buildStatus: 'SUCCESS',
        logSummary: `[SerDaddy] Rollback triggered back to release path: ${deployment.releasePath}.\n[SerDaddy] Dispatched swap pointer event to agent (Server ID: ${serverId}).\n[SerDaddy] Rollback completed successfully.\n`,
        releasePath: deployment.releasePath,
      },
    });
  }
}
