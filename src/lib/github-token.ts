import { clerkClient } from '@clerk/nextjs/server';

export async function getGithubToken(clerkUserId: string): Promise<string | null> {
  try {
    const client = await clerkClient();
    // Clerk uses 'oauth_github' as the provider string
    const response = await client.users.getUserOauthAccessToken(clerkUserId, 'oauth_github');
    
    // In newer Clerk SDKs, response is an object containing a data array
    if (response && response.data && response.data.length > 0) {
      return response.data[0].token;
    }
    
    // Fallback for older Clerk SDKs where response might be the array directly
    if (Array.isArray(response) && response.length > 0) {
      return response[0].token;
    }
    
    return null;
  } catch (error) {
    console.error("Error resolving GitHub token from Clerk:", error);
    return null;
  }
}
