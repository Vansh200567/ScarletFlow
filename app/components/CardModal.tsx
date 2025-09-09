// app/components/CardModal.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { pusherClient } from "@/lib/pusher-client";

type UserLite = { name: string | null; email: string | null };
type Comment = { id: string; body: string; createdAt: string; user: UserLite };
type CardDetail = {
  id: string;
  title: string;
  description: string | null;
  list: { id: string; title: string; boardId: string };
  comments: Comment[];
};

export default function CardModal({
  cardId,
  onClose,
}: {
  cardId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [data, setData] = useState<CardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/cards/${cardId}`, {
      credentials: "include",
    });

    if (res.status === 401) {
      window.location.href = `/api/auth/signin?callbackUrl=${encodeURIComponent(
        window.location.href
      )}`;
      return;
    }

    if (!res.ok) {
      setLoading(false);
      return;
    }
    const json = (await res.json()) as CardDetail;
    setData(json);
    setLoading(false);
  }, [cardId]);

  useEffect(() => {
    void load();
  }, [load]);

  // 🔔 Subscribe to Pusher for live comments
  useEffect(() => {
    if (!data?.list?.boardId) return;
    const channelName = `board-${data.list.boardId}`;
    const channel = pusherClient.subscribe(channelName);

    const onCreated = (payload: { cardId: string; comment: Comment }) => {
      if (payload.cardId !== cardId) return;
      setData((prev) =>
        prev
          ? { ...prev, comments: [payload.comment, ...prev.comments] }
          : prev
      );
    };

    const onDeleted = (payload: { cardId: string; commentId: string }) => {
      if (payload.cardId !== cardId) return;
      setData((prev) =>
        prev
          ? {
              ...prev,
              comments: prev.comments.filter((c) => c.id !== payload.commentId),
            }
          : prev
      );
    };

    channel.bind("comment:created", onCreated);
    channel.bind("comment:deleted", onDeleted);

    return () => {
      channel.unbind("comment:created", onCreated);
      channel.unbind("comment:deleted", onDeleted);
      pusherClient.unsubscribe(channelName);
    };
  }, [data?.list?.boardId, cardId]);

  // Close on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function addComment() {
    const body = comment.trim();
    if (!body) return;
    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId, body }),
      credentials: "include",
    });
    if (res.ok) {
      setComment("");
      await load();
      router.refresh();
    }
  }

  async function deleteComment(id: string) {
    const res = await fetch(`/api/comments/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) {
      await load();
      router.refresh();
    }
  }

  const title = data?.title?.trim() ? data.title : "Card";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-gray-900 border border-gray-800 rounded-xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-gray-100">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded hover:bg-gray-800 text-gray-300"
            aria-label="Close"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* Description */}
          <section>
            <h3 className="text-sm font-semibold text-gray-300 mb-2">Description</h3>
            {loading ? (
              <div className="h-20 rounded bg-gray-800 animate-pulse" />
            ) : (
              <p className="text-gray-200 whitespace-pre-wrap">
                {data?.description || "No description."}
              </p>
            )}
          </section>

          {/* Comments */}
          <section>
            <h3 className="text-sm font-semibold text-gray-300 mb-2">Comments</h3>
            <div className="flex gap-2 mb-3">
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Write a comment…"
                className="flex-1 rounded bg-gray-800 text-gray-100 px-3 py-2 outline-none border border-gray-700"
              />
              <button
                onClick={addComment}
                className="px-3 py-2 rounded bg-green-600 hover:bg-green-700 text-white text-sm"
              >
                Add
              </button>
            </div>

            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {loading ? (
                <>
                  <div className="h-12 rounded bg-gray-800 animate-pulse" />
                  <div className="h-12 rounded bg-gray-800 animate-pulse" />
                </>
              ) : data && data.comments.length > 0 ? (
                data.comments.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 rounded-lg border border-gray-800 bg-gray-900"
                  >
                    <div className="text-xs text-gray-400 mb-1">
                      {(c.user?.name || c.user?.email || "Someone") +
                        " · " +
                        new Date(c.createdAt).toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-100 whitespace-pre-wrap">
                      {c.body}
                    </div>
                    <div className="mt-2">
                      <button
                        onClick={() => deleteComment(c.id)}
                        className="text-xs px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-white"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-400">No comments yet.</div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}