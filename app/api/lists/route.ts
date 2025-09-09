import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return new NextResponse("Unauthorized", { status: 401 });
    const actor = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!actor) return new NextResponse("Unauthorized", { status: 401 });

    const { boardId, title } = await req.json();
    if (!boardId || !title) return new NextResponse("Missing required fields", { status: 400 });

    const maxPos = await prisma.list.aggregate({
      where: { boardId },
      _max: { position: true },
    });

    const list = await prisma.list.create({
      data: { boardId, title, position: (maxPos._max.position ?? 0) + 1 },
    });

    await prisma.activity.create({
      data: {
        boardId,
        actorId: actor.id,
        type: "CREATE",
        entityType: "list",
        entityId: list.id,
        metadata: { title: list.title },
      },
    });

    try { await pusherServer.trigger(`board-${boardId}`, "list:created", { id: list.id }); } catch {}

    return NextResponse.json(list);
  } catch (e) {
    console.error(e);
    return new NextResponse("Server error", { status: 500 });
  }
}