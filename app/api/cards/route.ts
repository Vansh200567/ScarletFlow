// app/api/cards/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher"; // keep import

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return new NextResponse("Unauthorized", { status: 401 });
    const actor = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!actor) return new NextResponse("Unauthorized", { status: 401 });

    const { title, description, listId } = await req.json();
    if (!title || !listId) return new NextResponse("Missing required fields", { status: 400 });

    // max position
    const maxPos = await prisma.card.aggregate({
      where: { listId },
      _max: { position: true },
    });

    // create card
    const newCard = await prisma.card.create({
      data: {
        title,
        description: description || "",
        position: (maxPos._max.position ?? 0) + 1,
        listId,
      },
    });

    // find list for board + title
    const list = await prisma.list.findUnique({ where: { id: listId } });

    // activity log (CREATE card)
    if (list) {
      await prisma.activity.create({
        data: {
          boardId: list.boardId,
          actorId: actor.id,
          type: "CREATE",
          entityType: "card",
          entityId: newCard.id,
          metadata: {
            title: newCard.title,
            listTitle: list.title,
          },
        },
      });

      // ✅ Non-blocking realtime trigger
      try {
        await pusherServer.trigger(`board-${list.boardId}`, "card:created", {
          id: newCard.id,
          listId: newCard.listId,
        });
      } catch (err) {
        console.warn("[pusher] card:created trigger failed (ignoring):", err);
      }
    }

    return NextResponse.json(newCard);
  } catch (error) {
    console.error(error);
    return new NextResponse("Server error", { status: 500 });
  }
}