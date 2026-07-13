import { Controller, Post, Headers, Req, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { DeploymentsService } from './deployments.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api/webhooks')
export class WebhooksController {
  constructor(
    private readonly deploymentsService: DeploymentsService,
    private readonly prisma: PrismaService
  ) {}

  @Post('github')
  async handleGitHubWebhook(
    @Headers('x-hub-signature-256') signature: string,
    @Req() req: any
  ) {
    const rawBody = JSON.stringify(req.body);
    const webhookSecret = process.env.WEBHOOK_SECRET || 'mock_webhook_secret';

    if (signature) {
      try {
        const hmac = crypto.createHmac('sha256', webhookSecret);
        const digest = 'sha256=' + hmac.update(rawBody).digest('hex');
        
        const signatureBuffer = Buffer.from(signature);
        const digestBuffer = Buffer.from(digest);
        
        if (signatureBuffer.length !== digestBuffer.length || !crypto.timingSafeEqual(signatureBuffer, digestBuffer)) {
          console.warn('⚠️ Webhook validation failed: Invalid signature.');
          throw new BadRequestException('Invalid signature');
        }
      } catch (err) {
        throw new BadRequestException('Signature validation failed');
      }
    } else {
      console.log('ℹ️ Webhook signature check skipped: x-hub-signature-256 header not provided.');
    }

    const payload = req.body as any;
    
    // Check if it's a push event
    if (!payload?.repository || !payload?.ref) {
      return { success: true, message: 'Not a push event. Ignored.' };
    }

    // Extract branch and normalize repo URL
    const branch = payload.ref.replace('refs/heads/', '');
    const repoUrl = payload.repository.html_url; 
    const commitHash = payload.after; 

    const normalizedRepoUrl = repoUrl.toLowerCase().replace(/\.git$/, '');
    
    // Find matching project
    const projects = await this.prisma.project.findMany();
    const matchingProject = projects.find(proj => {
      const projUrl = proj.repoUrl.toLowerCase().replace(/\.git$/, '');
      return projUrl.includes(normalizedRepoUrl) && proj.branch === branch;
    });

    if (!matchingProject) {
      console.log(`ℹ️ Webhook received for repo ${repoUrl} on branch ${branch}, but no matching SerDaddy project found.`);
      return { success: true, message: 'No matching project found. Ignored.' };
    }

    console.log(`🚀 Webhook match found! Triggering deployment for Project ${matchingProject.subdomain} (ID: ${matchingProject.id})`);
    
    const deployment = await this.deploymentsService.triggerDeployment(matchingProject.id, commitHash);

    return {
      success: true,
      message: `Deployment queued for commit: ${commitHash || 'latest'}`,
      deploymentId: deployment.id,
    };
  }
}
