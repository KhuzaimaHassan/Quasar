import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function check() {
  const convos = await prisma.conversation.findMany({
    where: { model: 'gemini-2.5-pro' },
    include: {
      user: {
        include: {
          apiKeys: {
            where: { provider: 'google' }
          }
        }
      }
    }
  });

  const missingKeys = convos.filter(c => c.user.apiKeys.length === 0);
  console.log(`Found ${convos.length} total conversations using gemini-2.5-pro.`);
  console.log(`Of those, ${missingKeys.length} belong to users with NO google API key on file.`);
}

check().catch(console.error).finally(() => prisma.$disconnect());
