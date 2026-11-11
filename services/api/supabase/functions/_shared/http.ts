// Shared HTTP helpers: JSON responses, a single error type, and the error shape
// every client sees: { error: { code, message, ...extra } }.

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

export function errorResponse(e: unknown): Response {
  if (e instanceof ApiError) {
    return json({ error: { code: e.code, message: e.message, ...e.extra } }, e.status);
  }
  // Unknown error: log the detail server-side, return a generic message.
  console.error("unhandled", e);
  return json({ error: { code: "INTERNAL", message: "Something went wrong. Please try again." } }, 500);
}

export async function readJsonObject(req: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "INVALID_INPUT", "Request body must be JSON.");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ApiError(400, "INVALID_INPUT", "Request body must be a JSON object.");
  }
  return body as Record<string, unknown>;
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || "unknown";
}
