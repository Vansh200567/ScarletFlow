// app/components/BoardDnd.tsx
"use client";

import { useMemo, useState, useEffect } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import ListHeader from "@/app/components/ListHeader";
import CreateCard from "@/app/components/CreateCard";
import CreateList from "@/app/components/CreateList";
import CardItem from "@/app/components/CardItem";

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

// ---------- helpers ----------
function between(a: number | null, b: number | null) {
  if (a == null && b == null) return 1;
  if (a == null) return (b as number) - 1;
  if (b == null) return (a as number) + 1;
  return (a + b) / 2;
}
function listKey(id: string) {
  return `list:${id}`;
}
function cardKey(id: string) {
  return `card:${id}`;
}
function parseKey(key: string) {
  const [type, ...rest] = key.split(":");
  return { type, id: rest.join(":") };
}

// ---------- Sortable shells ----------
function SortableListShell({
  list,
  children,
}: {
  list: ClientList;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: listKey(list.id),
      data: { type: "list", listId: list.id },
    });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.9 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

function SortableCardShell({
  card,
  children,
}: {
  card: ClientCard;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: cardKey(card.id),
      data: { type: "card", cardId: card.id, fromListId: card.listId },
    });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.9 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

// ---------- main component ----------
export default function BoardDnd({
  initialLists,
  boardId,
}: {
  initialLists: ClientList[];
  boardId: string;
}) {
  // state
  const [lists, setLists] = useState<ClientList[]>(initialLists);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const listIds = useMemo(() => lists.map((l) => listKey(l.id)), [lists]);

  // sync when parent refreshes
  useEffect(() => {
    setLists(initialLists);
  }, [initialLists]);

  // hydration gate
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  // persist helpers
  async function persistListPosition(listId: string, position: number) {
    await fetch(`/api/lists/${listId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ position }),
    });
  }

  async function persistCard(
    cardId: string,
    data: Partial<Pick<ClientCard, "position" | "listId">>
  ) {
    await fetch(`/api/cards/${cardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  }

  // DnD handler
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const a = parseKey(String(active.id));
    const o = parseKey(String(over.id));

    // move lists
    if (a.type === "list" && o.type === "list") {
      const from = lists.findIndex((l) => listKey(l.id) === String(active.id));
      const to = lists.findIndex((l) => listKey(l.id) === String(over.id));
      if (from === -1 || to === -1) return;

      const next = arrayMove(lists, from, to);
      const prevPos = next[to - 1]?.position ?? null;
      const nextPos = next[to + 1]?.position ?? null;
      const newPos = between(prevPos, nextPos);

      next[to] = { ...next[to], position: newPos };
      setLists(next);
      void persistListPosition(next[to].id, newPos);
      return;
    }

    // card -> card
    if (a.type === "card" && o.type === "card") {
      const srcListIdx = lists.findIndex((l) => l.cards.some((c) => cardKey(c.id) === String(active.id)));
      const srcList = lists[srcListIdx];
      const srcIdx = srcList.cards.findIndex((c) => cardKey(c.id) === String(active.id));

      const dstListIdx = lists.findIndex((l) => l.cards.some((c) => cardKey(c.id) === String(over.id)));
      const dstList = lists[dstListIdx];
      const dstIdx = dstList.cards.findIndex((c) => cardKey(c.id) === String(over.id));

      if (srcListIdx === -1 || dstListIdx === -1 || srcIdx === -1 || dstIdx === -1) return;

      if (srcList.id === dstList.id) {
        // reorder within same list
        const reordered = arrayMove(dstList.cards, srcIdx, dstIdx);
        const prevPos = reordered[dstIdx - 1]?.position ?? null;
        const nextPos = reordered[dstIdx + 1]?.position ?? null;
        const newPos = between(prevPos, nextPos);

        const updatedCards = reordered.map((c, i) => (i === dstIdx ? { ...c, position: newPos } : c));
        const next = lists.slice();
        next[dstListIdx] = { ...dstList, cards: updatedCards };
        setLists(next);
        void persistCard(updatedCards[dstIdx].id, { position: newPos });
        return;
      }

      // cross-list move
      const moving = srcList.cards[srcIdx];
      const srcAfter = srcList.cards.filter((c) => c.id !== moving.id);
      const dstAfter = [...dstList.cards];
      dstAfter.splice(dstIdx, 0, { ...moving, listId: dstList.id });

      const prevPos = dstAfter[dstIdx - 1]?.position ?? null;
      const nextPos = dstAfter[dstIdx + 1]?.position ?? null;
      const newPos = between(prevPos, nextPos);
      dstAfter[dstIdx] = { ...dstAfter[dstIdx], position: newPos };

      const next = lists.slice();
      next[srcListIdx] = { ...srcList, cards: srcAfter };
      next[dstListIdx] = { ...dstList, cards: dstAfter };
      setLists(next);
      void persistCard(moving.id, { listId: dstList.id, position: newPos });
      return;
    }

    // card dropped onto list (empty space)
    if (a.type === "card" && o.type === "list") {
      const srcListIdx = lists.findIndex((l) => l.cards.some((c) => cardKey(c.id) === String(active.id)));
      const srcList = lists[srcListIdx];
      const srcIdx = srcList.cards.findIndex((c) => cardKey(c.id) === String(active.id));

      const dstListIdx = lists.findIndex((l) => listKey(l.id) === String(over.id));
      const dstList = lists[dstListIdx];
      if (srcListIdx === -1 || dstListIdx === -1 || srcIdx === -1) return;

      const moving = srcList.cards[srcIdx];
      const srcAfter = srcList.cards.filter((c) => c.id !== moving.id);

      const dstAfter = [...dstList.cards, { ...moving, listId: dstList.id }];
      const lastNeighbor = dstAfter[dstAfter.length - 2]?.position ?? null;
      const newPos = between(lastNeighbor, null);
      dstAfter[dstAfter.length - 1] = {
        ...dstAfter[dstAfter.length - 1],
        position: newPos,
      };

      const next = lists.slice();
      next[srcListIdx] = { ...srcList, cards: srcAfter };
      next[dstListIdx] = { ...dstList, cards: dstAfter };
      setLists(next);

      void persistCard(moving.id, { listId: dstList.id, position: newPos });
      return;
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <SortableContext items={listIds} strategy={horizontalListSortingStrategy}>
        <div className="flex space-x-4 overflow-x-auto pb-4 px-1 scrollbar-hide flex-1">
          {lists.map((list) => {
            const cardIds = list.cards.map((c) => cardKey(c.id));
            return (
              <SortableListShell key={list.id} list={list}>
                <div className="min-w-[260px] max-h-[65vh] bg-gray-800 p-3 rounded-lg shadow-lg flex-shrink-0 flex flex-col">
                  <ListHeader listId={list.id} title={list.title} />

                  <SortableContext
                    items={cardIds}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="overflow-y-auto pr-1 flex-1 mt-3">
                      {list.cards.map((card) => (
                        <SortableCardShell key={card.id} card={card}>
                          <CardItem card={card} />
                        </SortableCardShell>
                      ))}

                      {/* ✅ Create card for this list */}
                      <CreateCard listId={list.id} />
                    </div>
                  </SortableContext>
                </div>
              </SortableListShell>
            );
          })}

          {/* ✅ Non-draggable "Add List" column at the end */}
          <div className="flex-shrink-0">
            <CreateList boardId={boardId} />
          </div>
        </div>
      </SortableContext>
    </DndContext>
  );
}