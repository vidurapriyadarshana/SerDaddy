import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const mockServerToken = 'MOCK_SERVER_TOKEN';

  // Upsert a server record for local development testing
  const server = await prisma.server.upsert({
    where: { agentToken: mockServerToken },
    update: {},
    create: {
      name: 'Local-Mock-Server',
      ip: '127.0.0.1',
      status: 'OFFLINE',
      agentToken: mockServerToken,
    },
  });

  console.log(`✅ Seeded mock server: "${server.name}" (Token: ${server.agentToken})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
