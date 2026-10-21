import { NextRequest } from "next/server";
import { verifyAccessToken } from "./jwt";

export function requireUserId(req: NextRequest): string {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    throw new AuthError("Missing bearer token");
  }
  const token = header.slice("Bearer ".length);
  try {
    const payload = verifyAccessToken(token);
    return payload.userId;
  } catch {
    throw new AuthError("Invalid or expired token");
  }
}

export class AuthError extends Error {}
