import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getGithubToken } from "@/lib/github-token";

// TEMPORARY TEST SCAFFOLDING - To be removed in #99
export async function GET(_req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = await getGithubToken(userId);
    if (!token) {
      return NextResponse.json(
        { error: "No GitHub token found for this user. Ensure you have connected your GitHub account with the correct scopes." },
        { status: 404 }
      );
    }

    // Temporarily testing the backend connection to the upcoming Step 3 endpoint
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";
    const internalSecret = process.env.INTERNAL_SERVICE_SECRET || "dev_internal_secret";

    const backendRes = await fetch(`${backendUrl}/tools/github/test`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": internalSecret,
      },
      body: JSON.stringify({
        github_token: token,
        action: "list_repos", // default test action
        params: {}
      }),
    });

    if (!backendRes.ok) {
      const errorText = await backendRes.text();
      return NextResponse.json({ error: `Backend error: ${errorText}` }, { status: backendRes.status });
    }

    const data = await backendRes.json();
    return NextResponse.json({ success: true, backend_response: data });

  } catch (error: any) {
    console.error("Error in temporary test route:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
