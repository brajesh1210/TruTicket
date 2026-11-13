// Maps the result codes of the 2.8 database functions to HTTP errors (PHASE2_PLAN §2.8).
// A function returns a code such as OVER_CAP; the table says what the client sees.
import { ApiError } from "./http.ts";

/** code -> [HTTP status, error code, message shown to the user] */
export type Outcomes = Record<string, [number, string, string]>;

/** RPC results come back as a row, a list of rows, or a bare value. Returns the first row. */
export function rowOf(data: unknown): Record<string, unknown> {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") throw new Error("empty rpc result");
  return row as Record<string, unknown>;
}

/** The result code from a table-returning function (out_result) or a scalar one. */
export function resultOf(data: unknown): string {
  if (typeof data === "string") return data;
  const row = rowOf(data);
  return String(row.out_result ?? "");
}

/** An ApiError for a refused result. Unknown codes become a generic retryable error. */
export function refuse(result: string, table: Outcomes): ApiError {
  const e = table[result] ?? [500, "TRY_AGAIN", "Something went wrong. Try again."];
  return new ApiError(e[0], e[1], e[2]);
}
