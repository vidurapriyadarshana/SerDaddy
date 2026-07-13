import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SocketModule } from '../socket/socket.module';
import { DeploymentsService } from './deployments.service';
import { DeploymentsProcessor } from './deployments.processor';
import { DeploymentsController } from './deployments.controller';
import { WebhooksController } from './webhooks.controller';

@Module({
  imports: [
    PrismaModule,
    SocketModule,
  ],
  controllers: [DeploymentsController, WebhooksController],
  providers: [DeploymentsService, DeploymentsProcessor],
  exports: [DeploymentsService],
})
export class DeploymentsModule {}
