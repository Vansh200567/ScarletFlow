"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X, Search } from "lucide-react";

type Result = {
  id: string;
  title: string;
  description: string | null;
  list: { id: string; title: string };
};

export default function BoardSearch({
  boardId,
  onClose,
}: {
  boardId: string;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // focus when opened
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced search
  useEffect(() => {
    const term = q.trim();
    const t = setTimeout(async () => {
      if (!term) {
        setResults([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/boards/${boardId}/search?q=${encodeURIComponent(term)}`, {
          credentials: "include",
        });
        if (res.ok) {
          const json = (await res.json()) as Result[];
          setResults(json);
        }
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, boardId]);

  // close on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const hasQuery = useMemo(() => q.trim().length > 0, [q]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl mt-20 bg-gray-900 border border-gray-800 rounded-xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Search size={18} className="text-gray-300" />
            <h2 className="text-lg font-semibold text-gray-100">Search cards</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded hover:bg-gray-800 text-gray-300"
            aria-label="Close"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4">
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by title or description…"
            className="w-full rounded bg-gray-800 text-gray-100 px-3 py-2 outline-none border border-gray-700"
          />
        </div>

        <div className="px-4 pb-4">
          {loading && <div className="text-sm text-gray-400">Searching…</div>}

          {!loading && !hasQuery && (
            <div className="text-sm text-gray-400">Type to search this board’s cards.</div>
          )}

          {!loading && hasQuery && results.length === 0 && (
            <div className="text-sm text-gray-400">No results found.</div>
          )}

          {!loading && results.length > 0 && (
            <ul className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {results.map((r) => (
                <li
                  key={r.id}
                  className="p-3 rounded-lg border border-gray-800 bg-gray-900 hover:bg-gray-800 transition"
                >
                  <div className="text-sm font-medium text-gray-100">
                    {r.title?.trim() ? r.title : "Untitled"}
                  </div>
                  {r.description?.trim() && (
                    <div className="text-xs text-gray-300 mt-1 line-clamp-2">
                      {r.description}
                    </div>
                  )}
                  <div className="text-xs text-gray-400 mt-2">List: {r.list.title}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}