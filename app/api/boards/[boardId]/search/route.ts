import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

type Ctx = { params: { boardId: string } };

export async function GET(req: Request, { params }: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const me = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!me) return new NextResponse("Unauthorized", { status: 401 });

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    if (!q) return NextResponse.json([]);

    // Make sure the user can access this board (owner or member)
    const board = await prisma.board.findFirst({
      where: {
        id: params.boardId,
        OR: [{ ownerId: me.id }, { memberships: { some: { userId: me.id } } }],
      },
      select: { id: true },
    });
    if (!board) return new NextResponse("Forbidden", { status: 403 });

    // Simple contains search (case-insensitive)
    const cards = await prisma.card.findMany({
      where: {
        list: { boardId: params.boardId },
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        description: true,
        list: { select: { id: true, title: true } },
      },
      take: 50,
    });

    return NextResponse.json(cards);
  } catch (e) {
    console.error("search error", e);
    return new NextResponse("Server error", { status: 500 });
  }
}