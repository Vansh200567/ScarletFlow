"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export default function Nav() {
  const { data: session } = useSession();
  return (
    <nav className="p-4 flex justify-end space-x-4">
      {session ? (
        <>
          <span>Hello, {session.user?.name}</span>
          <button
            onClick={() => signOut()}
            className="px-3 py-1 bg-red-500 text-white rounded"
          >
            Sign Out
          </button>
        </>
      ) : (
        <button
          onClick={() => signIn("github")}
          className="px-3 py-1 bg-green-500 text-white rounded"
        >
          Sign In with GitHub
        </button>
      )}
    </nav>
  );
}
