"use client";

import { useState } from "react";

export function BillingActions({
  hasBillingAccount,
  stripeReady,
}: {
  hasBillingAccount: boolean;
  stripeReady: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Could not open the portal.");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPending(false);
    }
  }

  if (!hasBillingAccount) return null;

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={openPortal}
        disabled={pending || !stripeReady}
        className="btn-secondary"
      >
        {pending ? "Opening…" : "Manage billing"}
      </button>
      <p className="mt-2 max-w-[18rem] text-tiny text-ink-faint">
        Change plan, update your card, or cancel. Opens Stripe.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-tiny text-[#b3261e]">
          {error}
        </p>
      )}
    </div>
  );
}
