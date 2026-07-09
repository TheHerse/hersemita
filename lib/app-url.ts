export function appBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.NODE_ENV !== "production" && process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "https://www.hersemita.com";
}
