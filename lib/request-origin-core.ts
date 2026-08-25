export function originMatchesRequest(requestUrl: string, origin: string | null, configuredBaseUrl: string) {
  if (!origin) return false;
  try {
    const requestOrigin = new URL(requestUrl).origin;
    const configuredOrigin = new URL(configuredBaseUrl).origin;
    return origin === requestOrigin || origin === configuredOrigin;
  } catch {
    return false;
  }
}
