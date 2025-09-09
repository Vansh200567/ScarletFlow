import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

type Ctx = { params: { boardId: string } };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return new NextResponse("Unauthorized", { status: 401 });

    const me = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!me) return new NextResponse("Unauthorized", { status: 401 });

    const board = await prisma.board.findUnique({
      where: { id: params.boardId },
      include: {
        owner: { select: { id: true, name: true, email: true, image: true } },
        memberships: {
          include: { user: { select: { id: true, name: true, email: true, image: true } } },
        },
      },
    });
    if (!board) return new NextResponse("Not found", { status: 404 });

    const isOwner = board.ownerId === me.id;
    const isMember = board.memberships.some((m) => m.userId === me.id);
    if (!isOwner && !isMember) return new NextResponse("Forbidden", { status: 403 });

    return NextResponse.json({
      owner: board.owner,
      meRole: isOwner ? "OWNER" : "MEMBER",
      members: board.memberships.map((m) => ({
        id: m.id,
        role: m.role,
        user: m.user,
      })),
    });
  } catch (e) {
    console.error(e);
    return new NextResponse("Server error", { status: 500 });
  }
}