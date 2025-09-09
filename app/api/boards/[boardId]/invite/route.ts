import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";

type Ctx = { params: { boardId: string } };

export async function POST(req: Request, { params }: Ctx) {
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

    const { email: rawEmail, role } = await req.json();
    const email = (rawEmail ?? "").trim();
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

    // Must be OWNER to invite
    const board = await prisma.board.findUnique({
      where: { id: params.boardId },
      select: { id: true, ownerId: true },
    });
    if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });
    if (board.ownerId !== me.id) {
      return NextResponse.json({ error: "Only the owner can invite" }, { status: 403 });
    }

    // Case-insensitive user lookup
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, name: true, email: true, image: true },
    });
    if (!user) {
      return NextResponse.json(
        { error: "User not found. Ask them to sign in once.", emailTried: email },
        { status: 404 }
      );
    }

    // Already a member?
    const existing = await prisma.membership.findFirst({
      where: { boardId: board.id, userId: user.id },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: "Already a member" }, { status: 409 });
    }

    const membership = await prisma.membership.create({
      data: {
        boardId: board.id,
        userId: user.id,
        role: role === "OWNER" ? "OWNER" : "MEMBER",
      },
      include: { user: true },
    });

    // Realtime fanout
    try {
      await pusherServer.trigger(`board-${board.id}`, "membership:added", {
        id: membership.id,
        role: membership.role,
        user: {
          id: membership.user.id,
          name: membership.user.name,
          email: membership.user.email,
          image: membership.user.image,
        },
      });
    } catch (err) {
      console.warn("[pusher] membership:added failed", err);
    }

    return NextResponse.json(
      {
        id: membership.id,
        role: membership.role,
        user: {
          id: membership.user.id,
          name: membership.user.name,
          email: membership.user.email,
          image: membership.user.image,
        },
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("Invite error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}