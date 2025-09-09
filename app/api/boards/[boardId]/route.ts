import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

type Ctx = { params: { boardId: string } };

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const me = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const board = await prisma.board.findUnique({
      where: { id: params.boardId },
      select: { id: true, ownerId: true },
    });
    if (!board) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (board.ownerId !== me.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Clean up children, then board (lists/cards, memberships, activities)
    await prisma.$transaction([
      prisma.activity.deleteMany({ where: { boardId: board.id } }),
      prisma.membership.deleteMany({ where: { boardId: board.id } }),
      prisma.card.deleteMany({ where: { list: { boardId: board.id } } }),
      prisma.list.deleteMany({ where: { boardId: board.id } }),
      prisma.board.delete({ where: { id: board.id } }),
    ]);

    return new NextResponse(null, { status: 204 });
  } catch (e) {
    console.error("DELETE board error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}