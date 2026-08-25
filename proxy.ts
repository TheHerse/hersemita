import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/runners(.*)",
  "/groups(.*)",
  "/activities(.*)",
  "/alerts(.*)",
  "/settings(.*)",
  "/parent/dashboard(.*)",
  "/parent/runners(.*)",
  "/parent/consent(.*)",
  "/adult(.*)",
  "/privacy/requests(.*)",
]);

const supabaseOrigin = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
      : null;
  } catch {
    return null;
  }
})();

const clerkProtectionScriptOrigin = "https://*.protect.clerk.com";
const clerkProtectionConnectOrigin = "https://*.protect.clerk.com:*";

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
}, {
  contentSecurityPolicy: {
    strict: true,
    directives: {
      "base-uri": ["self"],
      "connect-src": [
        clerkProtectionConnectOrigin,
        ...(supabaseOrigin ? [supabaseOrigin] : []),
      ],
      "frame-ancestors": ["none"],
      "frame-src": [clerkProtectionScriptOrigin],
      "img-src": [
        "data:",
        "blob:",
        ...(supabaseOrigin ? [supabaseOrigin] : []),
      ],
      "object-src": ["none"],
      "script-src": [clerkProtectionScriptOrigin],
      "upgrade-insecure-requests": [],
    },
  },
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
