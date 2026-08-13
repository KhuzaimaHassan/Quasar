import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.findFirst({
    where: {
      apiKeys: {
        none: { provider: 'google' }
      }
    }
  })

  if (!user) {
    console.log("No user without google key found")
    return
  }

  const convoPro = await prisma.conversation.create({
    data: {
      userId: user.id,
      title: 'Test Pro',
      model: 'gemini-2.5-pro'
    }
  })
  
  const convoFlash = await prisma.conversation.create({
    data: {
      userId: user.id,
      title: 'Test Flash',
      model: 'gemini-3.5-flash'
    }
  })

  console.log(JSON.stringify({
    clerkId: user.clerkId,
    convoPro: convoPro.id,
    convoFlash: convoFlash.id
  }))
}

main().catch(console.error).finally(() => prisma.$disconnect())
