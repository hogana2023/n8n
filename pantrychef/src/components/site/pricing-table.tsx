"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import { cn } from "@/lib/utils";
import { PLANS, PLAN_ORDER, type PlanId } from "@/lib/plans";

type Interval = "month" | "year";

export function PricingTable({ compact = false }: { compact?: boolean }) {
  const [interval, setInterval] = useState<Interval>("year");
  const [pending, setPending] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const { data: session, status } = useSession();

  async function choose(plan: PlanId) {
    setError(null);

    if (plan === "FREE") {
      router.push(session ? "/app" : "/signup");
      return;
    }

    // Checkout needs a customer, so unauthenticated visitors sign up first and
    // come straight back to the plan they picked.
    if (status !== "authenticated") {
      router.push(`/signup?plan=${plan}&interval=${interval}`);
      return;
    }

    setPending(plan);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, interval }),
      });

      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Could not start checkout.");
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPending(null);
    }
  }

  const currentPlan = session?.user?.plan;

  return (
    <div>
      {/* Billing interval switch */}
      <div className="flex justify-center">
        <div
          role="tablist"
          aria-label="Billing interval"
          className="inline-flex rounded-full bg-surface-muted p-1"
        >
          {(["month", "year"] as const).map((option) => (
            <button
              key={option}
              role="tab"
              aria-selected={interval === option}
              onClick={() => setInterval(option)}
              className={cn(
                "rounded-full px-5 py-2 text-small font-medium transition-all duration-200 ease-apple",
                interval === option
                  ? "bg-white text-ink shadow-sm"
                  : "text-ink-soft hover:text-ink",
              )}
            >
              {option === "month" ? "Monthly" : "Yearly"}
              {option === "year" && (
                <span className="ml-1.5 text-tiny text-herb">save 30%</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mx-auto mt-6 max-w-md rounded-form bg-[#fdeceb] px-4 py-3 text-center text-small text-[#b3261e]"
        >
          {error}
        </p>
      )}

      <div
        className={cn(
          "mt-12 grid gap-6 lg:grid-cols-3",
          compact && "mt-8",
        )}
      >
        {PLAN_ORDER.map((id) => {
          const plan = PLANS[id];
          const price = interval === "month" ? plan.monthly : plan.yearly;
          const isCurrent = currentPlan === id;

          return (
            <div
              key={id}
              className={cn(
                "relative flex flex-col rounded-card p-8 transition-transform duration-300 ease-apple",
                plan.highlighted
                  ? "bg-ink text-white shadow-lifted lg:-translate-y-3"
                  : "bg-white text-ink shadow-card ring-1 ring-hairline/60",
              )}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-8 rounded-full bg-herb px-3 py-1 text-tiny font-medium text-white">
                  Most popular
                </span>
              )}

              <h3
                className={cn(
                  "text-h5 font-semibold tracking-tight",
                  plan.highlighted ? "text-white" : "text-ink",
                )}
              >
                {plan.name}
              </h3>
              <p
                className={cn(
                  "mt-2 text-small text-pretty",
                  plan.highlighted ? "text-white/65" : "text-ink-soft",
                )}
              >
                {plan.tagline}
              </p>

              <div className="mt-8 flex items-baseline gap-1">
                <span
                  className={cn(
                    "text-[2.75rem] font-semibold tracking-[-0.02em] tabular-nums",
                    plan.highlighted ? "text-white" : "text-ink",
                  )}
                >
                  £{price}
                </span>
                <span
                  className={cn(
                    "text-small",
                    plan.highlighted ? "text-white/60" : "text-ink-faint",
                  )}
                >
                  /month
                </span>
              </div>
              <p
                className={cn(
                  "mt-1 text-tiny",
                  plan.highlighted ? "text-white/50" : "text-ink-faint",
                )}
              >
                {price === 0
                  ? "Free forever"
                  : interval === "year"
                    ? `Billed £${price * 12} yearly`
                    : "Billed monthly"}
              </p>

              <button
                type="button"
                disabled={pending !== null || isCurrent}
                onClick={() => choose(id)}
                className={cn(
                  "mt-8 w-full",
                  plan.highlighted
                    ? "btn-pill bg-white text-ink hover:bg-white/90 disabled:opacity-50"
                    : id === "FREE"
                      ? "btn-secondary"
                      : "btn-primary",
                )}
              >
                {isCurrent
                  ? "Your current plan"
                  : pending === id
                    ? "Opening checkout…"
                    : id === "FREE"
                      ? "Start free"
                      : `Choose ${plan.name}`}
              </button>

              <ul className="mt-8 space-y-3.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-3">
                    <span
                      aria-hidden
                      className={cn(
                        "mt-[0.3rem] shrink-0 text-small",
                        plan.highlighted ? "text-herb-soft" : "text-herb",
                      )}
                    >
                      ✓
                    </span>
                    <span
                      className={cn(
                        "text-small text-pretty",
                        plan.highlighted ? "text-white/75" : "text-ink-soft",
                      )}
                    >
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
