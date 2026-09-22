"use client";
import { signOut } from "next-auth/react";
export function AccountMenu() {
  return (
    <button
      className="text-sm text-white/70"
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      Sign out
    </button>
  );
}
