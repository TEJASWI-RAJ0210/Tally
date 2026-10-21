import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyRefreshToken, signAccessToken, signRefreshToken } from "@/lib/jwt";

const bodySchema = z.object({ refreshToken: z.string() });

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "refreshToken is required" }, { status: 400 });
  }
  try {
    const { userId } = verifyRefreshToken(parsed.data.refreshToken);
    return NextResponse.json({
      accessToken: signAccessToken({ userId }),
      refreshToken: signRefreshToken({ userId }),
    });
  } catch {
    return NextResponse.json({ error: "Invalid or expired refresh token" }, { status: 401 });
  }
}
