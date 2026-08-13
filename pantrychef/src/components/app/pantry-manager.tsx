"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";

import { cn } from "@/lib/utils";

export type PantryRow = {
  id: string;
  name: string;
  slug: string;
  category: string;
  quantity: string | null;
  expiresAt: string | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  produce: "Produce",
  protein: "Protein",
  dairy: "Dairy",
  grain: "Grains",
  pantry: "Cupboard",
  other: "Other",
};

export function PantryManager({
  initialItems,
  limit,
}: {
  initialItems: PantryRow[];
  limit: number | null;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [name, setName] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [limitHit, setLimitHit] = useState(false);
  const [pending, setPending] = useState(false);

  const atLimit = limit !== null && items.length >= limit;

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;

    setError(null);
    setLimitHit(false);
    setPending(true);

    try {
      const res = await fetch("/api/pantry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          // <input type="date"> gives a bare date; the API wants a full ISO stamp.
          expiresAt: expiresAt ? new Date(`${expiresAt}T00:00:00`).toISOString() : null,
        }),
      });

      const data = (await res.json()) as {
        item?: PantryRow;
        error?: string;
        code?: string;
      };

      if (!res.ok || !data.item) {
        if (data.code === "PANTRY_LIMIT") setLimitHit(true);
        throw new Error(data.error ?? "Could not add that.");
      }

      // The API upserts on slug, so an existing ingredient replaces rather than
      // duplicates its row here too.
      setItems((prev) => {
        const rest = prev.filter((i) => i.slug !== data.item!.slug);
        return [data.item!, ...rest];
      });
      setName("");
      setExpiresAt("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  async function remove(id: string) {
    const previous = items;
    setItems((prev) => prev.filter((i) => i.id !== id));

    const res = await fetch(`/api/pantry?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      setItems(previous); // put it back rather than lie about the delete
      setError("Could not remove that item.");
      return;
    }
    router.refresh();
  }

  const grouped = items.reduce<Record<string, PantryRow[]>>((acc, item) => {
    (acc[item.category] ??= []).push(item);
    return acc;
  }, {});

  return (
    <div>
      <form onSubmit={add} className="rounded-card bg-white p-6 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <label htmlFor="ingredient" className="sr-only">
              Ingredient
            </label>
            <input
              id="ingredient"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Add an ingredient, e.g. two ripe tomatoes"
              className="field"
              disabled={atLimit}
            />
          </div>
          <div className="sm:w-44">
            <label htmlFor="expires" className="sr-only">
              Use by
            </label>
            <input
              id="expires"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="field"
              disabled={atLimit}
            />
          </div>
          <button
            type="submit"
            disabled={pending || atLimit || !name.trim()}
            className="btn-primary shrink-0"
          >
            {pending ? "Adding…" : "Add"}
          </button>
        </div>

        <p className="mt-3 text-tiny text-ink-faint">
          Quantities are optional. “Some rice” is a perfectly good entry.
        </p>

        {error && (
          <p role="alert" className="mt-4 text-small text-[#b3261e]">
            {error}
          </p>
        )}

        {(atLimit || limitHit) && (
          <div className="mt-4 rounded-form bg-accent-quiet px-4 py-3">
            <p className="text-small text-ink">
              You're at the free plan's {limit}-item limit. Remove something, or{" "}
              <Link href="/app/billing" className="font-medium text-accent hover:underline">
                upgrade for unlimited
              </Link>
              .
            </p>
          </div>
        )}
      </form>

      <div className="mt-4 flex items-baseline justify-between px-1">
        <p className="text-small text-ink-soft">
          {items.length} item{items.length === 1 ? "" : "s"}
          {limit !== null && <span className="text-ink-faint"> of {limit}</span>}
        </p>
      </div>

      {items.length === 0 ? (
        <p className="mt-10 text-center text-regular text-ink-soft">
          Nothing here yet. Add the first thing above.
        </p>
      ) : (
        <div className="mt-6 space-y-8">
          {Object.entries(grouped).map(([category, rows]) => (
            <section key={category}>
              <h2 className="text-tiny font-medium uppercase tracking-wide text-ink-faint">
                {CATEGORY_LABELS[category] ?? category}
              </h2>
              <ul className="mt-3 overflow-hidden rounded-card bg-white shadow-card">
                <AnimatePresence initial={false}>
                  {rows.map((item) => {
                    const days = item.expiresAt
                      ? Math.ceil(
                          (new Date(item.expiresAt).getTime() - Date.now()) / 86_400_000,
                        )
                      : null;

                    return (
                      <motion.li
                        key={item.id}
                        layout
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25, ease: [0.28, 0.11, 0.32, 1] }}
                        className="flex items-center gap-4 border-b border-hairline/60 px-5 py-4 last:border-b-0"
                      >
                        <span className="flex-1 text-regular text-ink">{item.name}</span>

                        {days !== null && (
                          <span
                            className={cn(
                              "shrink-0 text-tiny tabular-nums",
                              days <= 2 ? "text-[#b3261e]" : "text-ink-faint",
                            )}
                          >
                            {days < 0
                              ? "past date"
                              : days === 0
                                ? "today"
                                : `${days} day${days === 1 ? "" : "s"}`}
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => remove(item.id)}
                          aria-label={`Remove ${item.name}`}
                          className="shrink-0 rounded-full px-3 py-1 text-tiny text-ink-faint transition-colors hover:bg-surface-muted hover:text-[#b3261e]"
                        >
                          Remove
                        </button>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
