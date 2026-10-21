import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { signAccessToken, signRefreshToken } from "@/lib/jwt";

const bodySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(20)
    .regex(/^[a-z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  email: z.string().trim().email().toLowerCase(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .refine((value) => Buffer.byteLength(value, "utf8") <= 72, "Password must be 72 UTF-8 bytes or fewer"),
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
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    const { name, username, email, password } = parsed.data;

    const [existingEmail, existingUsername] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      prisma.user.findUnique({ where: { username } }),
    ]);
    if (existingEmail) return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    if (existingUsername) return NextResponse.json({ error: "Username already taken" }, { status: 409 });

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({ data: { name, username, email, passwordHash } });

    const accessToken = signAccessToken({ userId: user.id });
    const refreshToken = signRefreshToken({ userId: user.id });

    return NextResponse.json(
      {
        accessToken,
        refreshToken,
        user: { id: user.id, name: user.name, username: user.username, email: user.email, avatarUrl: user.avatarUrl },
      },
      { status: 201 }
    );
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Email or username already in use" }, { status: 409 });
    }
    return NextResponse.json({ error: "Signup failed. Please try again." }, { status: 500 });
  }
}
