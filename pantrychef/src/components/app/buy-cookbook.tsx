"use client";

import { useState } from "react";

export function BuyCookbook({
  slug,
  stripeReady,
}: {
  slug: string;
  stripeReady: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buy() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/stripe/cookbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Could not start checkout.");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPending(false);
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={buy}
        disabled={pending || !stripeReady}
        className="btn-primary w-full"
      >
        {pending ? "Opening checkout…" : "Buy this cookbook"}
      </button>

      {!stripeReady && (
        <p className="mt-2 text-tiny text-[#8a5a00]">
          Stripe keys aren't set on this deployment, so checkout is disabled.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-2 text-tiny text-[#b3261e]">
          {error}
        </p>
      )}
    </div>
  );
}
