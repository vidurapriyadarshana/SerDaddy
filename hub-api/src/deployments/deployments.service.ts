import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DeploymentsProcessor } from './deployments.processor';

@Injectable()
export class DeploymentsService {
  constructor(
    private prisma: PrismaService,
    private processor: DeploymentsProcessor
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
}
