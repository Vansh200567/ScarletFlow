"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";

export default function CreateList({ boardId }: { boardId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  async function createList() {
    if (!title.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, boardId }),
      });
      if (!res.ok) throw new Error(await res.text());
      setTitle("");
      setOpen(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-w-[260px] max-h-[65vh] bg-gray-800 p-3 rounded-lg shadow-lg flex-shrink-0 flex flex-col">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center justify-center gap-2 text-sm font-medium text-green-400 border border-green-500 rounded px-3 py-2 hover:bg-green-500 hover:text-white transition-colors flex-1"
        >
          <Plus className="w-4 h-4" />
          Add List
        </button>
      ) : (
        <>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={loading}
            className="w-full rounded bg-gray-700 text-gray-100 px-2 py-1 outline-none"
            placeholder="List title"
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={createList}
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
        </>
      )}
    </div>
  );
}