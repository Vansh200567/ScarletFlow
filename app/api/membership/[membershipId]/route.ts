import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";

type Ctx = { params: { membershipId: string } };

// PATCH role
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return new NextResponse("Unauthorized", { status: 401 });

    const me = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!me) return new NextResponse("Unauthorized", { status: 401 });

    const { role } = await req.json() as { role?: "OWNER" | "MEMBER" };
    if (!role) return new NextResponse("Role required", { status: 400 });

    const membership = await prisma.membership.findUnique({
      where: { id: params.membershipId },
      include: { board: true, user: true },
    });
    if (!membership) return new NextResponse("Not found", { status: 404 });

    // must be owner of the board to change roles
    if (membership.board.ownerId !== me.id) return new NextResponse("Forbidden", { status: 403 });

    const updated = await prisma.membership.update({
      where: { id: membership.id },
      data: { role },
      include: { user: true, board: true },
    });

    // activity + realtime
    await prisma.activity.create({
      data: {
        boardId: updated.boardId,
        actorId: me.id,
        type: "UPDATE",
        entityType: "membership",
        entityId: updated.id,
        metadata: { email: updated.user.email, role: updated.role },
      },
    });
    try {
      await pusherServer.trigger(`board-${updated.boardId}`, "membership:updated", {
        id: updated.id,
        role: updated.role,
        user: {
          id: updated.user.id,
          name: updated.user.name,
          email: updated.user.email,
          image: updated.user.image ?? null,
        },
      });
    } catch {}

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return new NextResponse("Server error", { status: 500 });
  }
}

// DELETE membership
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return new NextResponse("Unauthorized", { status: 401 });

    const me = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!me) return new NextResponse("Unauthorized", { status: 401 });

    const membership = await prisma.membership.findUnique({
      where: { id: params.membershipId },
      include: { board: true, user: true },
    });
    if (!membership) return new NextResponse("Not found", { status: 404 });

    if (membership.board.ownerId !== me.id) return new NextResponse("Forbidden", { status: 403 });

    await prisma.membership.delete({ where: { id: membership.id } });

    await prisma.activity.create({
      data: {
        boardId: membership.boardId,
        actorId: me.id,
        type: "DELETE",
        entityType: "membership",
        entityId: membership.id,
        metadata: { email: membership.user.email },
      },
    });
    try {
      await pusherServer.trigger(`board-${membership.boardId}`, "membership:removed", {
        id: membership.id,
        user: {
          id: membership.user.id,
          name: membership.user.name,
          email: membership.user.email,
          image: membership.user.image ?? null,
        },
      });
    } catch {}

    return new NextResponse(null, { status: 204 });
  } catch (e) {
    console.error(e);
    return new NextResponse("Server error", { status: 500 });
  }
}