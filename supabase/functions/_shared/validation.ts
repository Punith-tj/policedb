/**
 * _shared/validation.ts — Input Validation & URL Parsing
 *
 * Validates request body fields BEFORE they reach the database.
 * Invalid input → ValidationError → HTTP 400.
 *
 * Also contains URL/pagination helpers used by every Edge Function.
 */

import { ValidationError } from "./errors.ts";

// ============================================================
// Request Body Parsing
// ============================================================

/** Parses the request body as JSON. Throws ValidationError on failure. */
export async function parseBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      throw new ValidationError("Request body must be a JSON object.");
    }
    return body as Record<string, unknown>;
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError("Invalid JSON in request body.");
  }
}

// ============================================================
// Field Validators
// ============================================================

/** Checks that all required fields are present and non-empty. */
export function requireFields(body: Record<string, unknown>, fields: string[]): void {
  for (const field of fields) {
    const val = body[field];
    if (val === undefined || val === null || val === "") {
      throw new ValidationError(`Missing required field: ${field}`);
    }
  }
}

/** Validates and returns a positive integer (for IDs, ages). */
export function validatePositiveInt(value: unknown, fieldName: string): number {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    throw new ValidationError(`${fieldName} must be a positive integer.`);
  }
  return num;
}

/** Validates date format YYYY-MM-DD. */
export function validateDate(value: unknown, fieldName: string): string {
  const str = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    throw new ValidationError(`${fieldName} must be in YYYY-MM-DD format.`);
  }
  const d = new Date(str + "T00:00:00Z");
  if (isNaN(d.getTime())) {
    throw new ValidationError(`${fieldName} is not a valid date.`);
  }
  return str;
}

/** Validates phone number: digits, hyphens, spaces, +, max 15 chars. */
export function validatePhone(value: unknown, fieldName: string): string {
  const phone = String(value).trim();
  if (!/^[\d\s\-+()]{1,15}$/.test(phone)) {
    throw new ValidationError(
      `${fieldName} must contain only digits, hyphens, spaces, or + (max 15 chars).`
    );
  }
  return phone;
}

/** Validates FIR number format: FIR-YYYY-NNN. */
export function validateFirNumber(value: unknown): string {
  const fir = String(value).trim();
  if (!/^FIR-\d{4}-\d{3}$/.test(fir)) {
    throw new ValidationError("FIR number must match format FIR-YYYY-NNN (e.g., FIR-2024-001).");
  }
  return fir;
}

/** Validates case status against the four allowed values. */
const ALLOWED_STATUSES = ["Pending", "Under Investigation", "Solved", "Closed"];
export function validateStatus(value: unknown): string {
  const status = String(value).trim();
  if (!ALLOWED_STATUSES.includes(status)) {
    throw new ValidationError(`Status must be one of: ${ALLOWED_STATUSES.join(", ")}`);
  }
  return status;
}

/** Validates string max length. */
export function validateMaxLength(value: unknown, fieldName: string, max: number): string {
  const str = String(value);
  if (str.length > max) {
    throw new ValidationError(`${fieldName} must not exceed ${max} characters.`);
  }
  return str;
}

/** Validates gender value. */
export function validateGender(value: unknown): string {
  const gender = String(value).trim();
  if (!["Male", "Female", "Other"].includes(gender)) {
    throw new ValidationError("Gender must be one of: Male, Female, Other.");
  }
  return gender;
}

// ============================================================
// URL Routing & Pagination
// ============================================================

/**
 * Parses URL path to extract route segments after the function name.
 *
 * Example:
 *   URL path: /functions/v1/stations-officers/stations/1
 *   functionName: "stations-officers"
 *   → segments: ["stations", "1"], params: URLSearchParams
 */
export function parseRoute(
  req: Request,
  functionName: string
): { segments: string[]; params: URLSearchParams } {
  const url      = new URL(req.url);
  const pathname = url.pathname;

  // Find the function name in the path, take everything after it
  const fnIndex = pathname.indexOf(functionName);
  let subPath   = "";
  if (fnIndex >= 0) {
    subPath = pathname.substring(fnIndex + functionName.length);
  } else {
    subPath = pathname;
  }

  // Split into segments, decode URI components, filter empties
  const segments = subPath
    .split("/")
    .filter(Boolean)
    .map(decodeURIComponent);

  return { segments, params: url.searchParams };
}

/**
 * Extracts pagination from query params.
 * Defaults: page=1, limit=20, max limit=100.
 */
export function parsePagination(params: URLSearchParams): {
  page: number;
  limit: number;
  offset: number;
} {
  let page  = parseInt(params.get("page")  || "1",  10);
  let limit = parseInt(params.get("limit") || "20", 10);

  if (isNaN(page)  || page  < 1) page  = 1;
  if (isNaN(limit) || limit < 1) limit = 20;
  if (limit > 100) limit = 100;  // Cap to prevent abuse

  return { page, limit, offset: (page - 1) * limit };
}

