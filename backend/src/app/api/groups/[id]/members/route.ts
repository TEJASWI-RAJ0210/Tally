import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUserId, AuthError } from "@/lib/authMiddleware";

const bodySchema = z.object({ userId: z.string().uuid() });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const requesterId = requireUserId(req);
    const { userId } = bodySchema.parse(await req.json());

    const requesterMembership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: params.id, userId: requesterId } },
    });
    if (!requesterMembership) return NextResponse.json({ error: "Group not found" }, { status: 404 });

    const friendship = await prisma.friendship.findFirst({
      where: {
        status: "ACCEPTED",
        OR: [
          { userId: requesterId, friendId: userId },
          { userId, friendId: requesterId },
        ],
      },
    });
    if (!friendship) return NextResponse.json({ error: "Only accepted friends can be added" }, { status: 403 });

    const existing = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: params.id, userId } },
    });
    if (existing) return NextResponse.json({ member: existing });

    const member = await prisma.groupMember.create({ data: { groupId: params.id, userId } });
    return NextResponse.json({ member }, { status: 201 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Enter a valid user" }, { status: 400 });
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return NextResponse.json({ error: "Group or user not found" }, { status: 404 });
    }
    console.error("Adding group member failed", e);
    return NextResponse.json({ error: "Failed to add member" }, { status: 500 });
  }
}
