// app/api/boards/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return new NextResponse("Unauthorized", { status: 401 });

    const me = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!me) return new NextResponse("Unauthorized", { status: 401 });

    const { title } = await req.json();
    if (!title?.trim()) return new NextResponse("Title required", { status: 400 });

    // Create board with ownerId
    const board = await prisma.board.create({
      data: {
        title: title.trim(),
        ownerId: me.id,
        memberships: {
          create: {
            userId: me.id,
            role: "OWNER",
          },
        },
      },
      include: {
        memberships: true,
      },
    });

    return NextResponse.json(board, { status: 201 });
  } catch (e) {
    console.error(e);
    return new NextResponse("Server error", { status: 500 });
  }
}