/**
 * _shared/errors.ts — Centralised Error Handling
 *
 * Maps MySQL errors and application errors to readable HTTP responses.
 * NEVER leaks SQL statements, credentials, or server internals to the client.
 *
 * Error mapping:
 *   AuthError           → 401 Unauthorized
 *   ValidationError     → 400 Bad Request
 *   NotFoundError       → 404 Not Found
 *   SIGNAL (45000)      → 409 Conflict     (trigger / procedure business rule)
 *   FK violation (1452) → 400 Bad Request   (related record missing)
 *   FK violation (1451) → 409 Conflict      (cannot delete, children exist)
 *   Duplicate (1062)    → 409 Conflict
 *   CHECK fail (3819)   → 400 Bad Request
 *   Everything else     → 500 Internal Server Error
 */

import { AuthError } from "./auth.ts";

// ============================================================
// CORS Headers — required for browser cross-origin requests
// ============================================================
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

// ============================================================
// Response Helpers
// ============================================================

/** Creates a JSON response with CORS headers. */
export function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Handles CORS preflight OPTIONS requests. */
export function corsResponse(): Response {
  return new Response("ok", { headers: corsHeaders });
}

// ============================================================
// Custom Error Classes
// ============================================================

/** Thrown when a database record is not found. → 404 */
export class NotFoundError extends Error {
  constructor(message = "Record not found.") {
    super(message);
    this.name = "NotFoundError";
  }
}

/** Thrown when user input fails validation. → 400 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

// ============================================================
// Central Error Handler
// ============================================================

/**
 * Maps any thrown error to an appropriate HTTP response.
 * Called in the catch block of every Edge Function.
 */
export function handleError(error: unknown): Response {
  const err     = error as Record<string, unknown>;
  const message = (err?.message as string) || "An unexpected error occurred.";
  const errName = (err?.name as string) || "";

  // --- Authentication errors → 401 ---
  if (errName === "AuthError" || error instanceof AuthError) {
    return jsonResponse({ success: false, message: message || "Authentication required." }, 401);
  }

  // --- Validation errors → 400 ---
  if (errName === "ValidationError") {
    return jsonResponse({ success: false, message }, 400);
  }

  // --- Not found errors → 404 ---
  if (errName === "NotFoundError") {
    return jsonResponse({ success: false, message }, 404);
  }

  // --- MySQL-specific errors ---
  const errno    = err?.errno as number | undefined;
  const sqlState = err?.sqlState as string | undefined;

  // SIGNAL from stored procedure or trigger (SQLSTATE 45000, errno 1644)
  // These are intentional business-rule errors (e.g., "FIR already closed")
  if (sqlState === "45000" || errno === 1644) {
    return jsonResponse({ success: false, message }, 409);
  }

  // FK violation — cannot add child (referenced parent doesn't exist)
  if (errno === 1452) {
    return jsonResponse(
      { success: false, message: "Related record does not exist. Check that all referenced IDs are valid." },
      400
    );
  }

  // FK violation — cannot delete parent (children still reference it)
  if (errno === 1451) {
    return jsonResponse(
      { success: false, message: "Cannot delete this record because other records depend on it." },
      409
    );
  }

  // Duplicate entry (UNIQUE constraint violation)
  if (errno === 1062) {
    return jsonResponse(
      { success: false, message: "Record already exists. A duplicate value was detected." },
      409
    );
  }

  // CHECK constraint violation
  if (errno === 3819) {
    return jsonResponse(
      { success: false, message: "Invalid value. A data validation constraint was violated." },
      400
    );
  }

  // Data too long for column
  if (errno === 1406) {
    return jsonResponse(
      { success: false, message: "Input value is too long for the field." },
      400
    );
  }

  // --- Unexpected errors → 500 (NEVER leak internals) ---
  console.error("Unexpected error:", error);
  return jsonResponse(
    { success: false, message: "Internal server error. Please try again later." },
    500
  );
}

