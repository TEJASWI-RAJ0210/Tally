import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUserId, AuthError } from "@/lib/authMiddleware";

export async function GET(req: NextRequest) {
  try {
    const userId = requireUserId(req);
    const groups = await prisma.group.findMany({
      where: { members: { some: { userId } } },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, username: true, avatarUrl: true } } },
        },
      },
    });
    return NextResponse.json({ groups });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json({ error: "Failed to load groups" }, { status: 500 });
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(60),
  memberIds: z.array(z.string().uuid()).max(100).default([]),
});

export async function POST(req: NextRequest) {
  try {
    const userId = requireUserId(req);
    const { name, memberIds } = createSchema.parse(await req.json());
    const uniqueMemberIds = Array.from(new Set(memberIds.filter((id) => id !== userId)));
    if (uniqueMemberIds.length) {
      const acceptedFriendships = await prisma.friendship.findMany({
        where: {
          status: "ACCEPTED",
          OR: [
            { userId, friendId: { in: uniqueMemberIds } },
            { friendId: userId, userId: { in: uniqueMemberIds } },
          ],
        },
      });
      const acceptedIds = new Set(acceptedFriendships.map((friendship) =>
        friendship.userId === userId ? friendship.friendId : friendship.userId
      ));
      if (uniqueMemberIds.some((id) => !acceptedIds.has(id))) {
        return NextResponse.json({ error: "Groups can only include accepted friends" }, { status: 403 });
      }
    }

    const allMemberIds = [userId, ...uniqueMemberIds];

    const group = await prisma.group.create({
      data: { name, createdBy: userId, members: { create: allMemberIds.map((id) => ({ userId: id })) } },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, username: true, avatarUrl: true } } },
        },
      },
    });

    return NextResponse.json({ group }, { status: 201 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Enter a group name and valid friend list" }, { status: 400 });
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("Group creation failed", e.code);
      return NextResponse.json({ error: "Could not create group with those members" }, { status: 400 });
    }
    console.error("Group creation failed", e);
    return NextResponse.json({ error: "Failed to create group" }, { status: 500 });
  }
}
