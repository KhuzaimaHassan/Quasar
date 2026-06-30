import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Define which routes are protected.
// We protect everything under (dashboard) -> /chat, /documents, /memory, /settings, /projects, /agents, /profile
// The (auth) routes like /sign-in and /sign-up are left public by default if not matched here.
const isProtectedRoute = createRouteMatcher([
  "/chat(.*)",
  "/documents(.*)",
  "/memory(.*)",
  "/settings(.*)",
  "/projects(.*)",
  "/agents(.*)",
  "/profile(.*)"
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.redirect(new URL("/sign-in", req.url));
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
