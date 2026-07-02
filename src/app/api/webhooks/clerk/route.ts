import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

export async function POST(req: Request) {
  // You can find this in the Clerk Dashboard -> Webhooks -> choose the webhook
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    throw new Error('Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local')
  }

  // Get the headers
  const headerPayload = await headers()
  const svix_id = headerPayload.get('svix-id')
  const svix_timestamp = headerPayload.get('svix-timestamp')
  const svix_signature = headerPayload.get('svix-signature')

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occured -- no svix headers', {
      status: 400,
    })
  }

  // Get the body as raw text for Svix verification
  const body = await req.text()

  // Create a new Svix instance with your secret.
  const wh = new Webhook(WEBHOOK_SECRET)

  let evt: WebhookEvent

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent
  } catch (err) {
    console.error('Error verifying webhook:', err)
    return new Response('Error occured', {
      status: 400,
    })
  }

  // Handle the webhook
  const eventType = evt.type

  if (eventType === 'user.created') {
    const { id, email_addresses, first_name, last_name, image_url } = evt.data
    
    console.log(`Webhook received: user.created for ID ${id}. Email: ${email_addresses?.[0]?.email_address}. Name: ${first_name} ${last_name}. Image: ${image_url}`)
    
    try {
      const email = email_addresses?.[0]?.email_address || ''
      const displayName = [first_name, last_name].filter(Boolean).join(' ') || null

      await db.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            clerkId: id,
            email: email,
            displayName: displayName,
          },
        })

        await tx.workspace.create({
          data: {
            userId: user.id,
            name: 'Personal Workspace',
            // Using the clerkId in the slug ensures global uniqueness 
            // without needing an external random ID library.
            slug: `personal-${id.toLowerCase()}`,
          },
        })
      })
      console.log(`Successfully saved user ${id} and default workspace to database`)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        console.log(`User ${id} already exists in the database (P2002). Treating as success.`)
      } else {
        console.error('Error saving user to database:', error)
        return new Response('Error saving user', { status: 500 })
      }
    }
  }

  return new Response('Webhook processed successfully', { status: 200 })
}
