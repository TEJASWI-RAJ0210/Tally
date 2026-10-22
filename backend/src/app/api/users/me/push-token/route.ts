import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId, AuthError } from "@/lib/authMiddleware";

const bodySchema = z.object({ token: z.string() });

export async function PATCH(req: NextRequest) {
  try {
    const userId = requireUserId(req);
    const { token } = bodySchema.parse(await req.json());
    await prisma.user.update({ where: { id: userId }, data: { pushToken: token } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
