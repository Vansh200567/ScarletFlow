import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";

type Ctx = { params: { commentId: string } };

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return new NextResponse("Unauthorized", { status: 401 });

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return new NextResponse("Unauthorized", { status: 401 });

    const existing = await prisma.comment.findUnique({
      where: { id: params.commentId },
      include: { card: { include: { list: { select: { boardId: true } } } } },
    });
    if (!existing) return new NextResponse("Not found", { status: 404 });

    // (Optional) restrict delete to author only:
    // if (existing.userId !== user.id) return new NextResponse("Forbidden", { status: 403 });

    await prisma.comment.delete({ where: { id: params.commentId } });

    // activity
    await prisma.activity.create({
      data: {
        boardId: existing.card.list.boardId,
        actorId: user.id,
        type: "DELETE",
        entityType: "comment",
        entityId: existing.id,
        metadata: { cardId: existing.cardId },
      },
    });

    // realtime
    try {
      await pusherServer.trigger(`board-${existing.card.list.boardId}`, "comment:deleted", {
        cardId: existing.cardId,
        commentId: existing.id,
      });
    } catch {}

    return new NextResponse(null, { status: 204 });
  } catch (e) {
    console.error(e);
    return new NextResponse("Server error", { status: 500 });
  }
}