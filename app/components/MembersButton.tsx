// app/components/MembersButton.tsx
"use client";

import { useState } from "react";
import MembersModal from "@/app/components/MembersModal";

export default function MembersButton({ boardId }: { boardId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="ml-3 text-sm px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-100 border border-gray-700"
      >
        Members
      </button>
      {open && <MembersModal boardId={boardId} onClose={() => setOpen(false)} />}
    </>
  );
}