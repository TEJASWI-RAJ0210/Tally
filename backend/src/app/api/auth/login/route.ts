import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { signAccessToken, signRefreshToken } from "@/lib/jwt";

const bodySchema = z.object({
  // Accept either email or username in the same field, since people often
  // forget which one they signed up with — matches how Splitwise etc. behave.
  identifier: z.string().trim().min(1).toLowerCase(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Email/username and password are required" }, { status: 400 });
    }
    const { identifier, password } = parsed.data;

    const user = await prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { username: identifier }] },
    });

    // Keep the same response for unknown users and bad passwords.
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json({ error: "Invalid email/username or password" }, { status: 401 });
    }

    const accessToken = signAccessToken({ userId: user.id });
    const refreshToken = signRefreshToken({ userId: user.id });

    return NextResponse.json({
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, username: user.username, email: user.email, avatarUrl: user.avatarUrl },
    });
  } catch {
    return NextResponse.json({ error: "Login failed. Please try again." }, { status: 500 });
  }
}
