import { clerkClient } from '@clerk/nextjs/server';

export async function getGithubToken(clerkUserId: string): Promise<string | null> {
  try {
    const client = await clerkClient();
    // Clerk 7 uses 'github' instead of 'oauth_github'
    const response = await client.users.getUserOauthAccessToken(clerkUserId, 'github');

    // In newer Clerk SDKs, response is an object containing a data array
    if (response && response.data && response.data.length > 0) {
      const entry = response.data[0];
      console.log("[GITHUB_TOKEN] Resolved OAuth token", {
        hasToken: !!entry.token,
        scopes: entry.scopes ?? [],
      });
      return entry.token;
    }
    
    // Fallback for older Clerk SDKs where response might be the array directly
    if (Array.isArray(response) && response.length > 0) {
      console.log("[GITHUB_TOKEN] Resolved OAuth token (legacy path)", {
        hasToken: !!response[0].token,
      });
      return response[0].token;
    }
    
    console.log("[GITHUB_TOKEN] No OAuth token found for user");
    return null;
  } catch (error) {
    console.error("[GITHUB_TOKEN] Failed to resolve token:", error instanceof Error ? error.message : "Unknown error");
    return null;
  }
}
