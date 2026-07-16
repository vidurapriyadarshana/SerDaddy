import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class ServersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, data: { name: string; ip: string }) {
    // Generate secure agent token
    const agentToken = 'sd_agt_' + crypto.randomBytes(8).toString('hex');

    return this.prisma.server.create({
      data: {
        name: data.name,
        ip: data.ip,
        status: 'OFFLINE',
        agentToken,
        userId,
      },
    });
  }

  async findAll(userId: string) {
    const servers = await this.prisma.server.findMany({
      where: { userId },
      include: {
        _count: { select: { projects: true } },
      },
    });

    return servers.map((s) => ({
      id: s.id,
      name: s.name,
      ip: s.ip,
      status: s.status,
      agentToken: s.agentToken,
      projects: s._count.projects,
      createdAt: s.createdAt,
    }));
  }

  async findOne(userId: string, id: string) {
    const server = await this.prisma.server.findFirst({
      where: { id, userId },
      include: {
        projects: {
          select: { id: true, subdomain: true, status: true },
        },
      },
    });

    if (!server) {
      throw new NotFoundException(`Server node with ID ${id} not found.`);
    }

    return server;
  }

  getInstallScript(token: string, hostUrl: string): string {
    const panelUrl = hostUrl || 'http://localhost:4000';
    
    return `#!/bin/bash
set -e

TOKEN="${token}"
PANEL_URL="${panelUrl}"

if [ -z "$TOKEN" ]; then
  echo "❌ Error: Server token is missing!"
  exit 1
fi

echo "🚀 Installing SerDaddy Agent on clean target host..."

# 1. Update and install basic dependencies
echo "📦 Installing system dependencies (git, curl, wget, nginx, certbot)..."
sudo apt-get update -y
sudo apt-get install -y git curl wget nginx certbot python3-certbot-nginx

# 2. Install Node.js if not present
if ! command -v node &> /dev/null; then
  echo "🟢 Installing Node.js..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

# 3. Create Agent Directory
sudo mkdir -p /var/www/serdaddy-agent
cd /var/www/serdaddy-agent

# 4. Fetch the Go agent binary
echo "📥 Downloading agent binary..."
# Stop existing service if running and remove old binary to avoid 'Text file busy'
if systemctl is-active --quiet serdaddy-agent.service; then
  echo "🛑 Stopping existing agent service..."
  sudo systemctl stop serdaddy-agent.service || true
fi
sudo rm -f serdaddy-agent

# Dynamically pulls compiled agent matching architecture:
if command -v wget &> /dev/null; then
  sudo wget -O serdaddy-agent "${panelUrl}/api/servers/download/linux-amd64"
else
  sudo curl -sSL -o serdaddy-agent "${panelUrl}/api/servers/download/linux-amd64"
fi
sudo chmod +x serdaddy-agent

# 5. Create Systemd Service Configuration
echo "⚙️ Creating Systemd service..."
sudo tee /etc/systemd/system/serdaddy-agent.service > /dev/null <<EOF
[Unit]
Description=SerDaddy Target Node Agent Daemon
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/serdaddy-agent
ExecStart=/var/www/serdaddy-agent/serdaddy-agent --panel \${PANEL_URL} --token \${TOKEN}
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# 6. Reload Systemd and start daemon
echo "🔄 Starting SerDaddy Agent Daemon..."
sudo systemctl daemon-reload
sudo systemctl enable serdaddy-agent.service
sudo systemctl restart serdaddy-agent.service

echo "✅ SerDaddy Agent successfully registered and started! Check your Control Panel."
`;
  }

  async deleteServer(userId: string, id: string) {
    // 1. Verify server ownership
    const server = await this.prisma.server.findFirst({
      where: { id, userId },
    });

    if (!server) {
      throw new NotFoundException(`Server node with ID ${id} not found.`);
    }

    // 2. Safeguard check: ensure no projects are linked
    const projectCount = await this.prisma.project.count({
      where: { serverId: id },
    });

    if (projectCount > 0) {
      throw new BadRequestException(
        "Cannot delete server: Please delete all linked projects first to clean up configurations."
      );
    }

    // 3. Delete the server node
    await this.prisma.server.delete({
      where: { id },
    });

    return { message: `Server ${server.name} deleted successfully.` };
  }
}
