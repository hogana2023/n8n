"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Uncertain = { name: string; confidence: string; note: string | null };

export function PhotoScan({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const [added, setAdded] = useState<string[] | null>(null);
  const [uncertain, setUncertain] = useState<Uncertain[]>([]);

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setUpgrade(false);
    setAdded(null);
    setUncertain([]);
    setPending(true);

    try {
      const body = new FormData();
      body.append("image", file);

      const res = await fetch("/api/vision", { method: "POST", body });
      const data = (await res.json()) as {
        added?: Array<{ name: string }>;
        uncertain?: Uncertain[];
        skipped?: number;
        error?: string;
        code?: string;
      };

      if (!res.ok) {
        if (data.code === "UPGRADE") setUpgrade(true);
        throw new Error(data.error ?? "Could not read that photo.");
      }

      setAdded((data.added ?? []).map((item) => item.name));
      setUncertain(data.uncertain ?? []);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPending(false);
      // Let the same file be picked again after a failure.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="rounded-card bg-white p-6 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-h6 font-semibold tracking-tight text-ink">
            Photograph your fridge
          </h2>
          <p className="mt-1.5 text-small text-pretty text-ink-soft">
            One photo, and it fills the pantry in for you. It asks about
            anything it can't read rather than guessing.
          </p>
        </div>

        <div className="shrink-0">
          <input
            ref={inputRef}
            id="fridge-photo"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            capture="environment"
            onChange={onFile}
            disabled={!enabled || pending}
            className="sr-only"
          />
          <label
            htmlFor="fridge-photo"
            aria-disabled={!enabled || pending}
            className={
              enabled && !pending
                ? "btn-primary cursor-pointer"
                : "btn-pill cursor-not-allowed bg-surface-neutral text-ink-faint"
            }
          >
            {pending ? "Reading…" : "Take a photo"}
          </label>
        </div>
      </div>

      {!enabled && (
        <p className="mt-5 rounded-form bg-accent-quiet px-4 py-3 text-small text-ink">
          Photo scanning is part of Plus.{" "}
          <Link href="/app/billing" className="font-medium text-accent hover:underline">
            Upgrade
          </Link>{" "}
          to use it.
        </p>
      )}

      {pending && (
        <p className="mt-5 text-small text-ink-faint">
          Reading the shelves. This takes a few seconds.
        </p>
      )}

      {error && (
        <div className="mt-5 rounded-form bg-[#fdeceb] px-4 py-3">
          <p role="alert" className="text-small text-[#b3261e]">
            {error}
          </p>
          {upgrade && (
            <Link
              href="/app/billing"
              className="mt-2 inline-block text-small font-medium text-accent hover:underline"
            >
              See plans ›
            </Link>
          )}
        </div>
      )}

      {added && (
        <div className="mt-5 rounded-form bg-herb-soft px-4 py-3">
          <p className="text-small font-medium text-herb">
            {added.length === 0
              ? "Couldn't find any food in that photo."
              : `Added ${added.length} item${added.length === 1 ? "" : "s"}.`}
          </p>
          {added.length > 0 && (
            <p className="mt-1 text-small text-ink-soft">{added.join(", ")}</p>
          )}
        </div>
      )}

      {uncertain.length > 0 && (
        <div className="mt-3 rounded-form bg-surface-muted px-4 py-3">
          <p className="text-small font-medium text-ink">Not sure about these</p>
          <p className="mt-1 text-small text-ink-soft">
            {uncertain.map((item) => item.name).join(", ")}
          </p>
          <p className="mt-1.5 text-tiny text-ink-faint">
            Add them by hand below if they're right.
          </p>
        </div>
      )}
    </div>
  );
}
