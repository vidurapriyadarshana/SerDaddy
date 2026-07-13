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

  constructor(private prisma: PrismaService) {}

  async handleConnection(client: Socket) {
    console.log(`🔌 Agent trying to connect: Client Socket ID: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    const serverId = this.activeConnections.get(client.id);
    if (serverId) {
      this.activeConnections.delete(client.id);
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
    console.log(`📊 Metrics received from Server ${serverId}: CPU: ${metrics.cpuPercent}%, RAM: ${Math.round(metrics.ramUsedBytes / 1024 / 1024)}MB`);
  }
}
