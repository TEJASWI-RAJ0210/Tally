import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, AuthError } from "@/lib/authMiddleware";
import { getBalanceBetween } from "@/lib/balances";

export async function GET(req: NextRequest) {
  try {
    const userId = requireUserId(req);
    const [accepted, incoming, outgoing] = await Promise.all([
      prisma.friendship.findMany({
        where: { status: "ACCEPTED", OR: [{ userId }, { friendId: userId }] },
        select: {
          userId: true,
          friendId: true,
          user: { select: { id: true, name: true, username: true, avatarUrl: true } },
          friend: { select: { id: true, name: true, username: true, avatarUrl: true } },
        },
      }),
      prisma.friendship.findMany({
        where: { friendId: userId, status: "PENDING" },
        select: { id: true, createdAt: true, user: { select: { id: true, name: true, username: true, avatarUrl: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.friendship.findMany({
        where: { userId, status: "PENDING" },
        select: { id: true, createdAt: true, friend: { select: { id: true, name: true, username: true, avatarUrl: true } } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const uniqueFriends = new Map<string, (typeof accepted)[number]["user"]>();
    for (const friendship of accepted) {
      const friend = friendship.userId === userId ? friendship.friend : friendship.user;
      uniqueFriends.set(friend.id, friend);
    }

    const friends = await Promise.all(
      [...uniqueFriends.values()].map(async (friend) => {
        const balance = await getBalanceBetween(userId, friend.id);
        return {
          id: friend.id,
          name: friend.name,
          username: friend.username,
          avatarUrl: friend.avatarUrl,
          balance: balance.toFixed(2),
        };
      })
    );

    const acceptedIds = new Set(uniqueFriends.keys());
    const incomingRequests = incoming.filter((request) => !acceptedIds.has(request.user.id));
    const incomingIds = new Set(incomingRequests.map((request) => request.user.id));
    return NextResponse.json({
      friends,
      incomingRequests: incomingRequests.map((request) => ({ id: request.id, createdAt: request.createdAt, from: request.user })),
      outgoingRequests: outgoing
        .filter((request) => !acceptedIds.has(request.friend.id) && !incomingIds.has(request.friend.id))
        .map((request) => ({ id: request.id, createdAt: request.createdAt, to: request.friend })),
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json({ error: "Failed to load friends" }, { status: 500 });
  }
}
