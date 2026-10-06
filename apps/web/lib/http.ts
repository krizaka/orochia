import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ConfigurationError } from "./env";

/** An error that carries the HTTP status it should be answered with. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function jsonError(status: number, error: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ success: false, error, ...extra }, { status });
}

/**
 * Turns any thrown value into a response without leaking internals: an HttpError keeps its
 * status and message, a validation error answers 400, everything else is a generic 500/503.
 */
export function errorResponse(error: unknown, context: string) {
  if (error instanceof HttpError) return jsonError(error.status, error.message);
  if (error instanceof ZodError) return jsonError(400, "Invalid payload", { details: error.flatten() });
  if (error instanceof SyntaxError) return jsonError(400, "Malformed JSON body");
  if (error instanceof ConfigurationError) {
    console.error(`[${context}] configuration error: ${error.message}`);
    return jsonError(503, "Service temporarily unavailable");
  }
  console.error(`[${context}]`, error);
  return jsonError(500, "Internal server error");
}

/** True for a PostgreSQL unique-constraint violation. */
export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "23505";
}
