import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/runner/login',
  '/runner/upload',
])

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)', 
  '/runners(.*)'
])

export default clerkMiddleware(async (auth, req) => {
  // If it's a protected route, require auth
  if (isProtectedRoute(req)) {
    await auth.protect()
  }
  
  // Public routes are accessible to everyone
  // Clerk will handle redirects based on your env vars
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}