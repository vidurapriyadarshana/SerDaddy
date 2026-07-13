import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { AgentGateway } from '../socket/agent.gateway';
import { decrypt } from '../utils/crypto';

@Processor('deployments')
export class DeploymentsProcessor {
  constructor(
    private prisma: PrismaService,
    private gateway: AgentGateway
  ) {}

  private async appendLog(id: string, text: string) {
    try {
      await this.prisma.$executeRaw`UPDATE "Deployment" SET "logSummary" = "logSummary" || ${text} WHERE id = ${id}`;
    } catch (err) {
      try {
        const dep = await this.prisma.deployment.findUnique({ where: { id } });
        if (dep) {
          await this.prisma.deployment.update({
            where: { id },
            data: { logSummary: dep.logSummary + text },
          });
        }
      } catch (fallbackErr) {
        console.error(`Failed to append log for deployment ${id}:`, fallbackErr.message);
      }
    }
  }

  @Process('deploy-job')
  async handleDeployJob(job: Job<{ projectId: string; deploymentId: string; commitHash: string }>) {
    const { projectId, deploymentId } = job.data;

    // 1. Update deployment state to BUILDING
    await this.prisma.deployment.update({
      where: { id: deploymentId },
      data: { buildStatus: 'BUILDING' },
    });
    await this.appendLog(deploymentId, `[SerDaddy] Job processed. Transmitting build parameters to Agent...\n`);

    try {
      // 2. Fetch project, server, and variables
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        include: {
          server: true,
          environmentVariables: true,
        },
      });

      if (!project) {
        throw new Error(`Project ${projectId} not found during processing.`);
      }

      const serverId = project.serverId;

      // 3. Compile decrypted environment variables
      const envMap: Record<string, string> = {
        PORT: String(project.port),
      };

      for (const envVar of project.environmentVariables) {
        try {
          envMap[envVar.key] = decrypt(envVar.value);
        } catch (decryptErr) {
          console.error(`Failed to decrypt variable ${envVar.key}:`, decryptErr.message);
          envMap[envVar.key] = envVar.value; // Fallback
        }
      }

      // 4. Construct payload
      const payload = {
        deploymentId,
        repoUrl: project.repoUrl,
        branch: project.branch,
        assignedPort: project.port,
        env: envMap,
      };

      // 5. Send event to Go Agent
      const sent = this.gateway.sendToAgent(serverId, 'deploy:start', payload);

      if (!sent) {
        throw new Error(`Agent is OFFLINE or disconnected. Cannot trigger deployment.`);
      }

      // Log success transmission
      await this.appendLog(
        deploymentId,
        `[SerDaddy] Build parameters successfully sent to target agent (Server ID: ${serverId}). Waiting for agent build logs...\n`
      );

    } catch (err) {
      console.error(`Error in DeploymentsProcessor:`, err.message);

      // Update deployment status to FAILED in case of connection failure or setup error
      await this.prisma.deployment.update({
        where: { id: deploymentId },
        data: { buildStatus: 'FAILED' },
      });
      await this.appendLog(
        deploymentId,
        `[SerDaddy] ERROR: ${err.message}\n[SerDaddy] Deployment aborted.\n`
      );

      await this.prisma.project.update({
        where: { id: projectId },
        data: { status: 'FAILED' },
      });

      throw err;
    }
  }
}
