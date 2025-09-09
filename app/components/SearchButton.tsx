"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Search } from "lucide-react";

const BoardSearch = dynamic(() => import("./BoardSearch"), { ssr: false });

export default function SearchButton({ boardId }: { boardId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-sm px-3 py-1 rounded border border-gray-600 text-gray-100 hover:bg-gray-800"
        aria-label="Search"
        title="Search"
      >
        <Search size={16} />
        Search
      </button>

      {open && <BoardSearch boardId={boardId} onClose={() => setOpen(false)} />}
    </>
  );
}