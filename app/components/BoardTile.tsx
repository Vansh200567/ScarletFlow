"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash } from "lucide-react";
import { useState } from "react";

export default function BoardTile({
  id,
  title,
  subtitle,
}: {
  id: string;
  title: string;
  subtitle?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function deleteBoard(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete board "${title}"? This cannot be undone.`)) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/boards/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        alert("Failed to delete board");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Link
      href={`/boards/${id}`}
      className="relative block rounded-lg border border-gray-800 bg-gray-800 hover:bg-gray-700 hover:shadow-lg hover:-translate-y-0.5 transform transition p-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <div className="font-medium text-lg pr-8">{title}</div>
      {subtitle && <div className="text-xs text-gray-400 mt-1">{subtitle}</div>}

      {/* Trash (top-right) */}
      <button
        onClick={deleteBoard}
        disabled={loading}
        title="Delete board"
        aria-label="Delete board"
        className="absolute top-2 right-2 p-1 rounded hover:bg-gray-700 text-red-400 disabled:opacity-50"
      >
        <Trash className="w-4 h-4" />
      </button>
    </Link>
  );
}