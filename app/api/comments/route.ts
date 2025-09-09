import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return new NextResponse("Unauthorized", { status: 401 });

    const { cardId, body } = await req.json() as { cardId?: string; body?: string };
    if (!cardId || !body?.trim()) {
      return new NextResponse("Missing fields", { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return new NextResponse("Unauthorized", { status: 401 });

    const card = await prisma.card.findUnique({
      where: { id: cardId },
      include: { list: { select: { boardId: true } } },
    });
    if (!card) return new NextResponse("Card not found", { status: 404 });

    const comment = await prisma.comment.create({
      data: { cardId, userId: user.id, body: body.trim() },
      include: { user: { select: { name: true, email: true } } },
    });

    await prisma.activity.create({
      data: {
        boardId: card.list.boardId,
        actorId: user.id,
        type: "CREATE",
        entityType: "comment",
        entityId: comment.id,
        metadata: { cardId, body: comment.body.slice(0, 140) },
      },
    });

    // realtime
    try {
      await pusherServer.trigger(`board-${card.list.boardId}`, "comment:created", {
        cardId,
        comment,
      });
    } catch {}

    return NextResponse.json(comment, { status: 201 });
  } catch (e) {
    console.error(e);
    return new NextResponse("Server error", { status: 500 });
  }
}