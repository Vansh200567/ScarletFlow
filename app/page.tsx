import CreateBoard from "./components/CreateBoard";
import BoardTile from "./components/BoardTile";
import { getServerSession } from "next-auth";
import { authOptions } from "./api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return (
      <main className="p-8 bg-gray-900 min-h-screen text-gray-100 flex flex-col items-center justify-center">
        <h1 className="text-3xl font-bold mb-4">ScarletFlow</h1>
        <p className="text-gray-300">Please sign in to see your boards.</p>
      </main>
    );
  }

  const me = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!me) {
    return (
      <main className="p-8 bg-gray-900 min-h-screen text-gray-100">
        <p>User not found.</p>
      </main>
    );
  }

  const [owned, shared] = await Promise.all([
    prisma.board.findMany({
      where: { ownerId: me.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, createdAt: true },
    }),
    prisma.board.findMany({
      where: { memberships: { some: { userId: me.id } }, NOT: { ownerId: me.id } },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, createdAt: true },
    }),
  ]);

  return (
    <main className="p-8 bg-gray-900 min-h-screen text-gray-100">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">ScarletFlow</h1>
      </header>

      {/* Create board (green outline style) */}
      <section className="max-w-3xl mb-10">
        <CreateBoard />
      </section>

      {/* Your boards */}
      <section className="max-w-6xl mb-10">
        <h2 className="text-xl font-semibold mb-4">Your boards</h2>
        {owned.length === 0 ? (
          <div className="text-sm text-gray-400">No boards yet. Create one above!</div>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {owned.map((b) => (
              <li key={b.id}>
                <BoardTile
                  id={b.id}
                  title={b.title}
                  subtitle={`Created ${new Date(b.createdAt).toLocaleDateString()}`}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Shared with you */}
      <section className="max-w-6xl">
        <h2 className="text-xl font-semibold mb-4">Shared with you</h2>
        {shared.length === 0 ? (
          <div className="text-sm text-gray-400">No shared boards.</div>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {shared.map((b) => (
              <li key={b.id}>
                {/* No delete button for shared boards */}
                <BoardTile id={b.id} title={b.title} subtitle="Shared board" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}