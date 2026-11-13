/** One error type for every backend call. `code` is the API error code (e.g. EMAIL_NOT_VERIFIED). */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 0) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

/** Codes that mean the sign-in is over. The app signs out on these. */
export const SESSION_ENDED_CODES: ReadonlySet<string> = new Set(["AUTH_INVALID", "SESSION_REVOKED"]);

export function messageOf(e: unknown, fallback = "Something went wrong. Please try again."): string {
  if (e instanceof ApiError) return e.message;
  return fallback;
}
