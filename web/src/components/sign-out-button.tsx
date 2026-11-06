"use client";

import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="text-muted-foreground hover:text-foreground"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
