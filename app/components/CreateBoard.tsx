"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";

export default function CreateBoard() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  async function createBoard() {
    const name = title.trim();
    if (!name) return;
    setLoading(true);
    try {
      const res = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: name }),
      });
      if (!res.ok) throw new Error(await res.text());
      setTitle("");
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
        className="flex items-center gap-1 text-sm font-medium text-green-400 border border-green-500 rounded px-2 py-1 hover:bg-green-500 hover:text-white transition-colors"
      >
        <Plus className="w-4 h-4" />
        New board
      </button>
    );
  }

  return (
    <div className="mt-2 p-3 bg-gray-800 border border-gray-700 rounded-lg shadow-sm max-w-md">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={loading}
        className="w-full rounded bg-gray-700 text-gray-100 px-2 py-2 outline-none"
        placeholder="Board title"
      />
      <div className="mt-3 flex gap-2">
        <button
          onClick={createBoard}
          disabled={loading}
          className="px-3 py-2 text-sm rounded bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
        >
          Create
        </button>
        <button
          onClick={() => { setOpen(false); setTitle(""); }}
          disabled={loading}
          className="px-3 py-2 text-sm rounded bg-gray-600 hover:bg-gray-500 text-gray-100 disabled:opacity-50 flex items-center gap-1"
        >
          <X className="w-4 h-4" />
          Cancel
        </button>
      </div>
    </div>
  );
}