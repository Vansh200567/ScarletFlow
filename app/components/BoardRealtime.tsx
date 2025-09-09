// app/components/BoardRealtime.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { pusherClient } from "@/lib/pusher-client";

export default function BoardRealtime({ boardId }: { boardId: string }) {
  const router = useRouter();

  useEffect(() => {
    const channel = pusherClient.subscribe(`board-${boardId}`);

    const events = [
      "list:created",
      "list:updated",
      "list:deleted",
      "list:moved",
      "card:created",
      "card:updated",
      "card:deleted",
      "card:moved",
      "comment:created",
      "comment:deleted",
    ] as const;

    const handler = () => router.refresh();
    events.forEach((e) => channel.bind(e, handler));

    return () => {
      events.forEach((e) => channel.unbind(e, handler));
      pusherClient.unsubscribe(`board-${boardId}`);
    };
  }, [boardId, router]);

  return null;
}