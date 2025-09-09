// app/api/cards/[cardId]/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";

type Ctx = { params: { cardId: string } };


export async function GET(_req: Request, { params }: { params: { cardId: string } }) {
  const card = await prisma.card.findUnique({
    where: { id: params.cardId },
    include: {
      list: { select: { id: true, title: true, boardId: true } },
      comments: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true, email: true } } }, // ← uses userId/user
      },
    },
  });
  if (!card) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json(card);
}
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return new NextResponse("Unauthorized", { status: 401 });

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return new NextResponse("Unauthorized", { status: 401 });

    const body = await req.json() as Partial<{ title: string; description: string | null; position: number; listId: string }>;

    const existing = await prisma.card.findUnique({
      where: { id: params.cardId },
      include: { list: { select: { id: true, title: true, boardId: true } } },
    });
    if (!existing) return new NextResponse("Not found", { status: 404 });

    const updated = await prisma.card.update({
      where: { id: params.cardId },
      data: {
        title: body.title ?? existing.title,
        description: body.description ?? existing.description,
        position: body.position ?? existing.position,
        listId: body.listId ?? existing.listId,
      },
      include: { list: { select: { id: true, title: true, boardId: true } } },
    });

    const boardId = updated.list.boardId;

    // Distinguish MOVE vs UPDATE for nicer activity + events
    const movedAcrossLists = body.listId && body.listId !== existing.listId;
    const positionChanged = body.position !== undefined && body.position !== existing.position;

    if (movedAcrossLists || positionChanged) {
      // activity
      await prisma.activity.create({
        data: {
          boardId,
          actorId: user.id,
          type: "MOVE",
          entityType: "card",
          entityId: updated.id,
          metadata: {
            title: updated.title,
            fromListId: existing.list.id,
            fromListTitle: existing.list.title,
            toListId: updated.list.id,
            toListTitle: updated.list.title,
            position: updated.position,
          },
        },
      });

      // realtime move
      await pusherServer.trigger(`board-${boardId}`, "card:moved", {
        id: updated.id,
        fromListId: existing.list.id,
        toListId: updated.list.id,
        position: updated.position,
        title: updated.title,
        description: updated.description,
      });
    } else {
      // activity (plain update)
      await prisma.activity.create({
        data: {
          boardId,
          actorId: user.id,
          type: "UPDATE",
          entityType: "card",
          entityId: updated.id,
          metadata: { title: updated.title },
        },
      });

      // realtime update
      await pusherServer.trigger(`board-${boardId}`, "card:updated", {
        id: updated.id,
        listId: updated.list.id,
        title: updated.title,
        description: updated.description,
      });
    }

    return NextResponse.json(updated);
  } catch (e) {
    console.error(e);
    return new NextResponse("Server error", { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return new NextResponse("Unauthorized", { status: 401 });

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return new NextResponse("Unauthorized", { status: 401 });

    const card = await prisma.card.findUnique({
      where: { id: params.cardId },
      include: { list: { select: { id: true, title: true, boardId: true } } },
    });
    if (!card) return new NextResponse("Not found", { status: 404 });

    await prisma.card.delete({ where: { id: params.cardId } });

    await prisma.activity.create({
      data: {
        boardId: card.list.boardId,
        actorId: user.id,
        type: "DELETE",
        entityType: "card",
        entityId: card.id,
        metadata: { title: card.title, listTitle: card.list.title },
      },
    });

    await pusherServer.trigger(`board-${card.list.boardId}`, "card:deleted", {
      id: card.id,
      listId: card.list.id,
    });

    return new NextResponse(null, { status: 204 });
  } catch (e) {
    console.error(e);
    return new NextResponse("Server error", { status: 500 });
  }
}