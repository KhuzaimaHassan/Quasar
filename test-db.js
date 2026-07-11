const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkMessages() {
  const messages = await prisma.message.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  console.log('Last 10 messages from DB:');
  for (const m of messages.reverse()) {
    console.log(`[${m.role}] ${m.content.slice(0, 50)}...`);
  }
}
checkMessages().then(() => prisma.$disconnect());
