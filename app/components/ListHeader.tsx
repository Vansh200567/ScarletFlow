"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash, Edit } from "lucide-react";

export default function ListHeader({ listId, title }: { listId: string; title: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const [loading, setLoading] = useState(false);

  async function saveTitle() {
    if (!value.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/lists/${listId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: value }),
      });
      if (!res.ok) throw new Error("Failed to update list title");
      setEditing(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function deleteList() {
    if (!confirm("Delete this list?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/lists/${listId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete list");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (editing) {
    return (
      <div className="sticky top-0 z-10 -mx-3 px-3 py-2 bg-gray-800 rounded-t-lg">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full rounded bg-gray-700 text-gray-100 px-2 py-1 outline-none"
          disabled={loading}
        />
        <div className="mt-2 flex gap-2">
          <button
            onClick={saveTitle}
            disabled={loading}
            className="px-2 py-1 text-xs rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
          >
            Save
          </button>
          <button
            onClick={() => { setEditing(false); setValue(title); }}
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
    <div className="sticky top-0 z-10 -mx-3 px-3 py-2 bg-gray-800 rounded-t-lg flex items-center justify-between">
      <h2 className="text-sm font-semibold text-gray-100 truncate">{title}</h2>
      <div className="flex gap-1">
        <button
          onClick={() => setEditing(true)}
          className="p-1 rounded hover:bg-gray-700 text-gray-300"
        >
          <Edit className="w-4 h-4" />
        </button>
        <button
          onClick={deleteList}
          className="p-1 rounded hover:bg-gray-700 text-red-400"
        >
          <Trash className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}