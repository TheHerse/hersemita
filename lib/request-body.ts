export type BoundedJsonResult =
  | { ok: true; value: unknown }
  | { ok: false; status: 400 | 413; error: string };

export async function readBoundedJson(
  request: Request,
  maxBytes = 32 * 1024
): Promise<BoundedJsonResult> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    return { ok: false, status: 400, error: "Expected an application/json request" };
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const declaredBytes = Number(contentLength);
    if (!Number.isSafeInteger(declaredBytes) || declaredBytes < 0) {
      return { ok: false, status: 400, error: "Invalid Content-Length header" };
    }
    if (declaredBytes > maxBytes) {
      return { ok: false, status: 413, error: "Request body is too large" };
    }
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false, status: 400, error: "Could not read request body" };
  }

  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    return { ok: false, status: 413, error: "Request body is too large" };
  }

  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, status: 400, error: "Invalid JSON request" };
  }
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
