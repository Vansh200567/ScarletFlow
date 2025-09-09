"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";

export default function CreateCard({ listId }: { listId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  async function createCard() {
    if (!title.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, listId }),
      });
      if (!res.ok) throw new Error(await res.text());
      setTitle("");
      setDescription("");
      setOpen(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2 flex items-center gap-1 text-sm font-medium text-green-400 border border-green-500 rounded px-2 py-1 hover:bg-green-500 hover:text-white transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add Card
      </button>
    );
  }

  return (
    <div className="mt-2 p-3 bg-gray-800 border border-gray-700 rounded-lg shadow-sm">
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
        rows={2}
        placeholder="Description (optional)"
      />
      <div className="mt-2 flex gap-2">
        <button
          onClick={createCard}
          disabled={loading}
          className="px-2 py-1 text-xs rounded bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
        >
          Add
        </button>
        <button
          onClick={() => setOpen(false)}
          disabled={loading}
          className="px-2 py-1 text-xs rounded bg-gray-600 hover:bg-gray-500 text-gray-100 disabled:opacity-50 flex items-center gap-1"
        >
          <X className="w-3 h-3" />
          Cancel
        </button>
      </div>
    </div>
  );
}