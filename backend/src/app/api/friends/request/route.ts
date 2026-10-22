import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUserId, AuthError } from "@/lib/authMiddleware";

const bodySchema = z.object({ username: z.string().trim().min(3).max(20) });

export async function POST(req: NextRequest) {
  try {
    const userId = requireUserId(req);
    const { username } = bodySchema.parse(await req.json());

    const friend = await prisma.user.findUnique({ where: { username: username.toLowerCase() } });
    if (!friend) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (friend.id === userId) return NextResponse.json({ error: "Can't friend yourself" }, { status: 400 });

    const existing = await prisma.friendship.findMany({
      where: {
        OR: [
          { userId, friendId: friend.id },
          { userId: friend.id, friendId: userId },
        ],
      },
    });

    if (existing.some((friendship) => friendship.status === "ACCEPTED")) {
      return NextResponse.json({ error: "You're already friends" }, { status: 409 });
    }
    const incomingRequest = existing.find((friendship) => friendship.userId === friend.id && friendship.friendId === userId);
    if (incomingRequest) {
      await prisma.friendship.updateMany({
        where: {
          OR: [
            { userId, friendId: friend.id },
            { userId: friend.id, friendId: userId },
          ],
        },
        data: { status: "ACCEPTED" },
      });
      return NextResponse.json({ request: { ...incomingRequest, status: "ACCEPTED" }, message: "Friend request accepted" });
    }
    if (existing.length) {
      return NextResponse.json({ error: "Friend request already sent" }, { status: 409 });
    }

    const request = await prisma.friendship.create({
      data: { userId, friendId: friend.id, status: "PENDING" },
    });

    // TODO: send push notification to friend.pushToken via Expo Push API here

    return NextResponse.json({ request }, { status: 201 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Enter a valid username" }, { status: 400 });
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "Friend request already sent" }, { status: 409 });
    }
    console.error("Friend request failed", e);
    return NextResponse.json({ error: "Could not send friend request" }, { status: 500 });
  }
}
