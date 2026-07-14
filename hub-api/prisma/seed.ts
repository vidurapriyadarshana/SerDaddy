import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const mockServerToken = 'MOCK_SERVER_TOKEN';

  // Upsert the default mock user
  const user = await prisma.user.upsert({
    where: { username: 'local_sandbox_dev' },
    update: {},
    create: {
      username: 'local_sandbox_dev',
      email: 'sandbox@serdaddy.local',
      avatarUrl: 'https://avatars.githubusercontent.com/u/9919?v=4',
    },
  });

  // Upsert a server record linked to mock user
  const server = await prisma.server.upsert({
    where: { agentToken: mockServerToken },
    update: { userId: user.id },
    create: {
      name: 'Local-Mock-Server',
      ip: '127.0.0.1',
      status: 'OFFLINE',
      agentToken: mockServerToken,
      userId: user.id,
    },
  });

  console.log(`✅ Seeded mock server: "${server.name}" (Token: ${server.agentToken})`);

  // Upsert a project record linked to mock user
  const project = await prisma.project.upsert({
    where: { subdomain: 'mockapp.local' },
    update: { userId: user.id },
    create: {
      repoUrl: 'https://github.com/developer_john/mockapp.git',
      branch: 'main',
      subdomain: 'mockapp.local',
      port: 3001,
      status: 'READY',
      serverId: server.id,
      userId: user.id,
    },
  });

  console.log(`✅ Seeded mock project: "${project.subdomain}" (Assigned Port: ${project.port}, ID: ${project.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
