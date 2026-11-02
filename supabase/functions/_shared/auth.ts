/**
 * _shared/auth.ts — JWT Authentication
 *
 * Verifies Supabase JWT tokens on every protected request.
 * Extracts the Bearer token from the Authorization header,
 * verifies its signature, expiry, and audience claim.
 *
 * SECURITY RULES:
 *   - NEVER trust a user ID sent by the frontend.
 *   - ALWAYS extract the user ID from the verified JWT payload.
 *   - NEVER expose the JWT secret in responses.
 */

import { jwtVerify } from "npm:jose@5";

/** Represents the authenticated user extracted from the JWT */
export interface AuthUser {
  id: string;                                  // Supabase user UUID (from 'sub' claim)
  email: string;                               // User's email address
  role: string;                                // Supabase role (e.g., 'authenticated')
  app_metadata: Record<string, unknown>;       // Trusted metadata set by server only
}

/**
 * Custom error class for authentication failures.
 * The error handler in errors.ts maps this to HTTP 401.
 */
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Verifies the JWT from the Authorization header.
 * Returns the authenticated user or throws AuthError → 401.
 *
 * @param req - The incoming HTTP request
 * @returns The authenticated user payload
 * @throws AuthError if token is missing, invalid, or expired
 */
export async function verifyAuth(req: Request): Promise<AuthUser> {
  // Step 1: Extract the Authorization header
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new AuthError("Missing Authorization header.");
  }

  // Step 2: Extract the Bearer token
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    throw new AuthError("Invalid Authorization format. Expected: Bearer <token>");
  }
  const token = parts[1];

  // Step 3: Get the JWT secret (automatically available in Supabase Edge Functions)
  const jwtSecret = Deno.env.get("SUPABASE_JWT_SECRET");
  if (!jwtSecret) {
    console.error("SUPABASE_JWT_SECRET is not set.");
    throw new Error("Server authentication configuration error.");
  }

  // Step 4: Verify signature, expiry, and audience
  try {
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token, secret, {
      audience: "authenticated", // Supabase sets aud="authenticated" for signed-in users
    });

    // Step 5: Build and return the user object from verified claims
    return {
      id:           payload.sub || "",
      email:        (payload.email as string) || "",
      role:         (payload.role as string) || "authenticated",
      app_metadata: (payload.app_metadata as Record<string, unknown>) || {},
    };
  } catch (_err) {
    // Token expired, bad signature, wrong audience, malformed, etc.
    console.error("JWT verification failed:", (_err as Error).message);
    throw new AuthError("Invalid or expired authentication token.");
  }
}

