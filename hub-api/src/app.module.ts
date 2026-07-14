import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { SocketModule } from './socket/socket.module';
import { DeploymentsModule } from './deployments/deployments.module';
import { ProjectsModule } from './projects/projects.module';
import { ServersModule } from './servers/servers.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    SocketModule,
    DeploymentsModule,
    ProjectsModule,
    ServersModule,
    AuthModule,
  ],
})
export class AppModule {}
