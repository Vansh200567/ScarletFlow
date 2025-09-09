// app/components/MembersModal.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { X, UserPlus, Trash2 } from "lucide-react";
import { pusherClient } from "@/lib/pusher-client";

type UserLite = { id: string; name: string | null; email: string | null; image: string | null };
type Member = { id: string; role: "OWNER" | "MEMBER"; user: UserLite };
type PayloadMembers = { owner: UserLite | null; members: Member[]; meRole: "OWNER" | "MEMBER" };

export default function MembersModal({
  boardId,
  onClose,
}: {
  boardId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<PayloadMembers | null>(null);
  const [loading, setLoading] = useState(true);

  // invite form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const isOwner = data?.meRole === "OWNER";

  const load = useCallback(async () => {
    setLoading(true);
    setInviteError(null);
    const res = await fetch(`/api/boards/${boardId}/members`, {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) {
      setLoading(false);
      setData(null);
      return;
    }
    const json = (await res.json()) as PayloadMembers;
    setData(json);
    setLoading(false);
  }, [boardId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime updates for members list
  useEffect(() => {
    const channel = pusherClient.subscribe(`board-${boardId}`);

    const onAdded = (p: { id: string; role: "OWNER" | "MEMBER"; user: UserLite }) => {
      setData((prev) =>
        prev ? { ...prev, members: [...prev.members, { id: p.id, role: p.role, user: p.user }] } : prev
      );
    };
    const onUpdated = (p: { id: string; role: "OWNER" | "MEMBER"; user: UserLite }) => {
      setData((prev) =>
        prev
          ? { ...prev, members: prev.members.map((m) => (m.id === p.id ? { ...m, role: p.role } : m)) }
          : prev
      );
    };
    const onRemoved = (p: { id: string; user: UserLite }) => {
      setData((prev) => (prev ? { ...prev, members: prev.members.filter((m) => m.id !== p.id) } : prev));
    };

    channel.bind("membership:added", onAdded);
    channel.bind("membership:updated", onUpdated);
    channel.bind("membership:removed", onRemoved);

    return () => {
      channel.unbind("membership:added", onAdded);
      channel.unbind("membership:updated", onUpdated);
      channel.unbind("membership:removed", onRemoved);
      pusherClient.unsubscribe(`board-${boardId}`);
    };
  }, [boardId]);

  // ----- actions -----
  async function invite() {
    const email = inviteEmail.trim();
    if (!email || inviteLoading) return;

    setInviteLoading(true);
    setInviteError(null);

    try {
      const res = await fetch(`/api/boards/${boardId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }), // role defaults to MEMBER server-side
      });

      if (res.status === 401) {
        setInviteError("You must be signed in.");
      } else if (res.status === 403) {
        setInviteError("Only the board owner can invite members.");
      } else if (res.status === 404) {
        setInviteError("User not found. Ask them to sign in at least once.");
      } else if (res.status === 409) {
        setInviteError("That user is already a member.");
      } else if (!res.ok) {
        setInviteError("Something went wrong inviting this user.");
      } else {
        // success: clear input; Pusher will append the member automatically
        setInviteEmail("");
        // fallback refresh if pusher is slow
        void load();
      }
    } catch  {
      setInviteError("Network error. Check your dev server.");
    } finally {
      setInviteLoading(false);
    }
  }

  async function updateRole(m: Member, role: "OWNER" | "MEMBER") {
    const res = await fetch(`/api/memberships/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ role }),
    });
    if (res.ok) void load();
  }

  async function removeMember(m: Member) {
    const res = await fetch(`/api/memberships/${m.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) void load();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-xl bg-gray-900 border border-gray-800 rounded-xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-gray-100">Board Members</h2>
          <button onClick={onClose} className="p-2 rounded hover:bg-gray-800 text-gray-300" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* Invite (only for owner) */}
          {isOwner && (
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-2">Invite by email</h3>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="flex-1 rounded bg-gray-800 text-gray-100 px-3 py-2 outline-none border border-gray-700"
                />
                <button
                  onClick={invite}
                  disabled={!inviteEmail.trim() || inviteLoading}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded bg-green-600 hover:bg-green-700 text-white text-sm disabled:opacity-50"
                >
                  <UserPlus size={16} />
                  {inviteLoading ? "Inviting…" : "Invite"}
                </button>
              </div>
              {inviteError && <p className="mt-2 text-xs text-red-400">{inviteError}</p>}
            </div>
          )}

          {/* Owner */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-2">Owner</h3>
            <div className="p-3 rounded-lg border border-gray-800 bg-gray-900">
              {loading ? (
                <div className="h-6 rounded bg-gray-800 animate-pulse" />
              ) : data?.owner ? (
                <div className="text-sm text-gray-100">
                  {data.owner.name || data.owner.email}
                  <span className="ml-2 text-xs text-gray-400">(OWNER)</span>
                </div>
              ) : (
                <div className="text-sm text-gray-400">—</div>
              )}
            </div>
          </div>

          {/* Members */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-2">Members</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {loading ? (
                <>
                  <div className="h-12 rounded bg-gray-800 animate-pulse" />
                  <div className="h-12 rounded bg-gray-800 animate-pulse" />
                </>
              ) : data && data.members.length > 0 ? (
                data.members.map((m) => (
                  <div
                    key={m.id}
                    className="p-3 rounded-lg border border-gray-800 bg-gray-900 flex items-center justify-between"
                  >
                    <div className="text-sm text-gray-100">
                      {m.user.name || m.user.email}
                      <span className="ml-2 text-xs text-gray-400">({m.role})</span>
                    </div>

                    {isOwner && (
                      <div className="flex items-center gap-2">
                        <select
                          value={m.role}
                          onChange={(e) => updateRole(m, e.target.value as "OWNER" | "MEMBER")}
                          className="bg-gray-800 border border-gray-700 text-gray-100 text-xs rounded px-2 py-1"
                        >
                          <option value="MEMBER">Member</option>
                          <option value="OWNER">Owner</option>
                        </select>
                        <button
                          onClick={() => removeMember(m)}
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-white"
                        >
                          <Trash2 size={14} />
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-400">No members yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}