// app/api/lists/[listId]/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";

type Ctx = { params: { listId: string } };

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return new NextResponse("Unauthorized", { status: 401 });

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return new NextResponse("Unauthorized", { status: 401 });

    const body = await req.json() as Partial<{ title: string; position: number }>;
    const existing = await prisma.list.findUnique({
      where: { id: params.listId },
      include: { board: { select: { id: true } } },
    });
    if (!existing) return new NextResponse("Not found", { status: 404 });

    const updated = await prisma.list.update({
      where: { id: params.listId },
      data: {
        title: body.title ?? existing.title,
        position: body.position ?? existing.position,
      },
    });

    // activity
    if (body.title !== undefined && body.title !== existing.title) {
      await prisma.activity.create({
        data: {
          boardId: existing.boardId,
          actorId: user.id,
          type: "UPDATE",
          entityType: "list",
          entityId: updated.id,
          metadata: { field: "title", before: existing.title, after: updated.title },
        },
      });
      await pusherServer.trigger(`board-${existing.boardId}`, "list:updated", {
        id: updated.id,
        title: updated.title,
      });
    }

    if (body.position !== undefined && body.position !== existing.position) {
      await prisma.activity.create({
        data: {
          boardId: existing.boardId,
          actorId: user.id,
          type: "MOVE",
          entityType: "list",
          entityId: updated.id,
          metadata: { title: updated.title, before: existing.position, after: updated.position },
        },
      });
      await pusherServer.trigger(`board-${existing.boardId}`, "list:moved", {
        id: updated.id,
        position: updated.position,
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

    const list = await prisma.list.findUnique({
      where: { id: params.listId },
      include: { board: { select: { id: true } } },
    });
    if (!list) return new NextResponse("Not found", { status: 404 });

    await prisma.list.delete({ where: { id: params.listId } });

    await prisma.activity.create({
      data: {
        boardId: list.boardId,
        actorId: user.id,
        type: "DELETE",
        entityType: "list",
        entityId: list.id,
        metadata: { title: list.title },
      },
    });

    await pusherServer.trigger(`board-${list.boardId}`, "list:deleted", { id: list.id });

    return new NextResponse(null, { status: 204 });
  } catch (e) {
    console.error(e);
    return new NextResponse("Server error", { status: 500 });
  }
}