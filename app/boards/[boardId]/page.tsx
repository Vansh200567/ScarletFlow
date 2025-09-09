// app/boards/[boardId]/page.tsx
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import BoardDnd from "@/app/components/BoardDnd";
import BoardRealtime from "@/app/components/BoardRealtime";
import MembersButton from "@/app/components/MembersButton";
import SearchButton from "@/app/components/SearchButton";
import type { ActivityType, Prisma } from "@prisma/client";

type BoardPageProps = {
  params: { boardId: string };
};

type FeedActor = { name: string | null; email: string | null } | null;
type FeedItem = {
  id: string;
  entityType: string;
  type: ActivityType;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  actor: FeedActor;
};

type ClientCard = {
  id: string;
  title: string;
  description: string | null;
  position: number;
  listId: string;
};

type ClientList = {
  id: string;
  title: string;
  position: number;
  cards: ClientCard[];
};

export default async function BoardPage({ params }: BoardPageProps) {
  const { boardId } = params;

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return <p className="p-8">Please sign in to view this board.</p>;
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user) return <p className="p-8">User not found.</p>;

  const board = await prisma.board.findFirst({
    where: {
      id: boardId,
      OR: [
        { ownerId: user.id },
        { memberships: { some: { userId: user.id } } },
      ],
    },
    include: {
      lists: {
        orderBy: { position: "asc" },
        include: { cards: { orderBy: { position: "asc" } } },
      },
      owner: { select: { id: true, name: true, email: true } },
      memberships: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  });

  if (!board) return <p className="p-8">Board not found or unauthorized.</p>;

  const [activityRaw, totalCards, totalLists, cardsLast7Days] = await Promise.all([
    prisma.activity.findMany({
      where: { boardId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { actor: { select: { name: true, email: true } } },
    }),
    prisma.card.count({ where: { list: { boardId } } }),
    prisma.list.count({ where: { boardId } }),
    prisma.card.count({
      where: {
        list: { boardId },
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  const clientLists: ClientList[] = board.lists.map((l) => ({
    id: l.id,
    title: l.title,
    position: l.position,
    cards: l.cards.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      position: c.position,
      listId: c.listId,
    })),
  }));

  const toObj = (v: Prisma.JsonValue | null): Record<string, unknown> =>
    v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const s = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
  const n = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);

  const activity: FeedItem[] = activityRaw as unknown as FeedItem[];

  function formatActivity(a: FeedItem) {
    const who = a.actor?.name || a.actor?.email || "Someone";
    const m = toObj(a.metadata);
    if (a.entityType === "card" && a.type === "CREATE")
      return `${who} added card "${s(m.title) ?? ""}" to "${s(m.listTitle) ?? ""}"`;
    if (a.entityType === "card" && a.type === "UPDATE" && s(m.field) === "title")
      return `${who} renamed a card: "${s(m.before) ?? ""}" → "${s(m.after) ?? ""}"`;
    if (a.entityType === "card" && a.type === "UPDATE" && s(m.field) === "description")
      return `${who} updated a card's description`;
    if (a.entityType === "card" && a.type === "MOVE")
      return `${who} moved "${s(m.title) ?? ""}" from "${s(m.fromListTitle) ?? ""}" to "${s(m.toListTitle) ?? ""}"`;
    if (a.entityType === "card" && a.type === "DELETE")
      return `${who} deleted card "${s(m.title) ?? ""}" from "${s(m.listTitle) ?? ""}"`;

    if (a.entityType === "list" && a.type === "CREATE")
      return `${who} created list "${s(m.title) ?? ""}"`;
    if (a.entityType === "list" && a.type === "UPDATE" && s(m.field) === "title")
      return `${who} renamed a list: "${s(m.before) ?? ""}" → "${s(m.after) ?? ""}"`;
    if (a.entityType === "list" && a.type === "MOVE") {
      const title = s(m.title) ?? "list";
      return `${who} reordered ${title} (${n(m.before) ?? "?"} → ${n(m.after) ?? "?"})`;
    }
    if (a.entityType === "list" && a.type === "DELETE")
      return `${who} deleted list "${s(m.title) ?? ""}"`;

    return `${who} ${String(a.type).toLowerCase()}d a ${a.entityType}`;
  }

  return (
    <main className="p-8 bg-gray-900 min-h-screen">
      <BoardRealtime boardId={board.id} />

      <Link href="/" className="text-blue-600 hover:underline mb-4 inline-block">
        ← Back to Boards
      </Link>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">{board.title}</h1>
        <div className="flex items-center gap-2">
          <SearchButton boardId={board.id} />
          <MembersButton boardId={board.id} />
        </div>
      </div>

      <div className="flex gap-4">
        <BoardDnd initialLists={clientLists} boardId={board.id} />

        <aside className="w-80 shrink-0 bg-gray-800 rounded-lg shadow-lg p-4 text-gray-100 h-fit">
          <h3 className="text-lg font-bold mb-2">Board Stats</h3>
          <ul className="text-sm space-y-1 mb-4">
            <li>Total Cards: {totalCards}</li>
            <li>Total Lists: {totalLists}</li>
            <li>Cards (Last 7 Days): {cardsLast7Days}</li>
          </ul>

          <h3 className="text-lg font-bold mb-2">Recent Activity</h3>
          <ul className="space-y-2">
            {activity.map((a) => (
              <li key={a.id} className="text-sm">
                <div>{formatActivity(a)}</div>
                <div className="text-xs text-gray-400" suppressHydrationWarning>
                  {new Date(a.createdAt).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </main>
  );
}