import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { Injectable } from '@nestjs/common';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'agent',
})
export class AgentGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Map to track active socket connections to server IDs
  private activeConnections = new Map<string, string>();
  // Map to track active server IDs to Socket instances
  private serverSockets = new Map<string, Socket>();

  constructor(private prisma: PrismaService) {}

  async handleConnection(client: Socket) {
    console.log(`🔌 Agent trying to connect: Client Socket ID: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    const serverId = this.activeConnections.get(client.id);
    if (serverId) {
      this.activeConnections.delete(client.id);
      this.serverSockets.delete(serverId);
      try {
        await this.prisma.server.update({
          where: { id: serverId },
          data: { status: 'OFFLINE' },
        });
        console.log(`❌ Server ${serverId} disconnected, status set to OFFLINE.`);
        // Broadcast state change to panel clients
        this.server.emit('server:state_change', { serverId, status: 'OFFLINE' });
      } catch (err) {
        console.error(`Failed to update status for disconnected server ${serverId}:`, err.message);
      }
    }
  }

  /**
   * Dispatches a WebSocket event to a connected Agent.
   * @param serverId Target server ID
   * @param event Socket event name
   * @param payload Payload object
   */
  sendToAgent(serverId: string, event: string, payload: any): boolean {
    const socket = this.serverSockets.get(serverId);
    if (!socket) {
      console.warn(`⚠️ Cannot send event "${event}" to server ${serverId}: Agent not connected.`);
      return false;
    }
    socket.emit(event, payload);
    return true;
  }

  @SubscribeMessage('agent:auth')
  async handleAgentAuth(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { agentToken: string }
  ) {
    const token = data?.agentToken || client.handshake.headers['x-agent-token'] || client.handshake.query['token'];
    
    if (!token) {
      console.log(`⚠️ Agent Auth Rejected: Missing token.`);
      client.disconnect(true);
      return;
    }

    try {
      const dbServer = await this.prisma.server.findUnique({
        where: { agentToken: token as string },
      });

      if (!dbServer) {
        console.log(`⚠️ Agent Auth Failed: Invalid token provided.`);
        client.disconnect(true);
        return;
      }

      // Associate socket with server ID
      this.activeConnections.set(client.id, dbServer.id);
      this.serverSockets.set(dbServer.id, client);

      // Update server status to ONLINE
      await this.prisma.server.update({
        where: { id: dbServer.id },
        data: { status: 'ONLINE' },
      });

      console.log(`🛡️ Server ${dbServer.name} (${dbServer.id}) successfully AUTHENTICATED.`);
      client.emit('auth:success', { serverId: dbServer.id });
      
      // Broadcast state change to panel clients
      this.server.emit('server:state_change', { serverId: dbServer.id, status: 'ONLINE' });
    } catch (err) {
      console.error(`Error during agent authentication:`, err.message);
      client.disconnect(true);
    }
  }

  @SubscribeMessage('metrics:push')
  async handleMetricsPush(
    @ConnectedSocket() client: Socket,
    @MessageBody() metrics: any
  ) {
    const serverId = this.activeConnections.get(client.id);
    if (!serverId) {
      client.disconnect(true);
      return;
    }

    // Broadcast these metrics to panel dashboard clients monitoring this server
    this.server.emit(`metrics:server:${serverId}`, metrics);
  }

  @SubscribeMessage('deploy:log')
  async handleDeployLog(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { deploymentId: string; stream: string; chunk: string }
  ) {
    const serverId = this.activeConnections.get(client.id);
    if (!serverId) {
      client.disconnect(true);
      return;
    }

    if (!data?.deploymentId || !data?.chunk) return;

    try {
      // Append the log chunk to logSummary. Atomic SQL concatenation prevents write collisions
      await this.prisma.$executeRaw`UPDATE "Deployment" SET "logSummary" = "logSummary" || ${data.chunk} WHERE id = ${data.deploymentId}`;
    } catch (err) {
      try {
        // Fallback for non-Postgres databases
        const dep = await this.prisma.deployment.findUnique({ where: { id: data.deploymentId } });
        if (dep) {
          await this.prisma.deployment.update({
            where: { id: data.deploymentId },
            data: { logSummary: dep.logSummary + data.chunk },
          });
        }
      } catch (fallbackErr) {
        console.error(`Failed to append log chunk for deployment ${data.deploymentId}:`, fallbackErr.message);
      }
    }
  }

  @SubscribeMessage('deploy:status')
  async handleDeployStatus(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { deploymentId: string; status: 'SUCCESS' | 'FAILED'; commitHash?: string; releasePath?: string }
  ) {
    const serverId = this.activeConnections.get(client.id);
    if (!serverId) {
      client.disconnect(true);
      return;
    }

    if (!data?.deploymentId || !data?.status) return;

    try {
      const dbDeployment = await this.prisma.deployment.findUnique({
        where: { id: data.deploymentId },
      });

      if (!dbDeployment) {
        console.error(`Deployment ${data.deploymentId} not found.`);
        return;
      }

      const duration = Math.round((Date.now() - dbDeployment.createdAt.getTime()) / 1000);

      await this.prisma.deployment.update({
        where: { id: data.deploymentId },
        data: {
          buildStatus: data.status,
          commitHash: data.commitHash || dbDeployment.commitHash,
          releasePath: data.releasePath,
          duration,
        },
      });

      await this.prisma.project.update({
        where: { id: dbDeployment.projectId },
        data: {
          status: data.status === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
        },
      });

      console.log(`🚀 Deployment ${data.deploymentId} ended with status: ${data.status} (Duration: ${duration}s)`);
    } catch (err) {
      console.error(`Failed to handle deploy status for ${data.deploymentId}:`, err.message);
    }
  }
}
