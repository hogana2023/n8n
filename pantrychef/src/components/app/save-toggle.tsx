"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

export function SaveToggle({ id, saved }: { id: string; saved: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(saved);
  const [pending, setPending] = useState(false);

  async function toggle() {
    const next = !on;
    setOn(next); // optimistic
    setPending(true);

    const res = await fetch(`/api/recipes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ saved: next }),
    });

    if (!res.ok) setOn(!next); // put it back rather than lie
    else router.refresh();
    setPending(false);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={on}
      className={cn(
        "rounded-full px-4 py-2 text-small font-medium transition-all duration-200 ease-apple active:scale-95",
        on ? "bg-ink text-white" : "bg-surface-neutral text-ink hover:bg-hairline",
      )}
    >
      {on ? "Saved" : "Save"}
    </button>
  );
}
