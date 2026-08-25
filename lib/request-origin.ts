import { appBaseUrl } from "@/lib/app-url";
import { originMatchesRequest } from "@/lib/request-origin-core";

export function hasTrustedRequestOrigin(request: Request) {
  return originMatchesRequest(request.url, request.headers.get("origin"), appBaseUrl());
}
