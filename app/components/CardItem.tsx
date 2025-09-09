// app/components/CardItem.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Edit, Trash } from "lucide-react";
import CardModel from "@/app/components/CardModal";

type Card = {
  id: string;
  title: string;
  description: string | null;
  listId: string;
};

export default function CardItem({ card }: { card: Card }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState(card.title ?? "");
  const [description, setDescription] = useState(card.description ?? "");
  const [loading, setLoading] = useState(false);

  async function saveCard() {
    if (!title.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/cards/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
      if (!res.ok) throw new Error(await res.text());
      setEditing(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function deleteCard() {
    if (!confirm("Delete this card?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/cards/${card.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error(await res.text());
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (editing) {
    return (
      <div className="p-3 mb-3 bg-gray-800 border border-gray-700 rounded-lg shadow-sm">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={loading}
          className="w-full rounded bg-gray-700 text-gray-100 px-2 py-1 outline-none"
          placeholder="Card title"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={loading}
          className="w-full mt-2 rounded bg-gray-700 text-gray-100 px-2 py-1 outline-none"
          rows={3}
          placeholder="Description (optional)"
        />
        <div className="mt-2 flex gap-2">
          <button
            onClick={saveCard}
            disabled={loading}
            className="px-2 py-1 text-xs rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
          >
            Save
          </button>
          <button
            onClick={() => {
              setEditing(false);
              setTitle(card.title ?? "");
              setDescription(card.description ?? "");
            }}
            disabled={loading}
            className="px-2 py-1 text-xs rounded bg-gray-600 hover:bg-gray-500 text-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className="p-3 mb-3 bg-gray-800 border border-gray-700 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-150 cursor-pointer"
        onClick={() => setShowModal(true)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-100 truncate">
              {card.title?.trim() ? card.title : "Untitled"}
            </h3>
            {card.description?.trim() && (
              <p className="text-xs text-gray-300 mt-1 whitespace-pre-wrap break-words">
                {card.description}
              </p>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditing(true);
              }}
              className="p-1 rounded hover:bg-gray-700 text-gray-300"
              aria-label="Edit card"
              title="Edit"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                void deleteCard();
              }}
              className="p-1 rounded hover:bg-gray-700 text-red-400"
              aria-label="Delete card"
              title="Delete"
            >
              <Trash className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {showModal && (
        <CardModel cardId={card.id} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}