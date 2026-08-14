"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";

import { cn } from "@/lib/utils";
import { RecipeCard, type RecipeRecord } from "@/components/app/recipe-card";

type Mode = "PANTRY" | "LEFTOVERS" | "APPLIANCE" | "PET";

const APPLIANCES = [
  { id: "air-fryer", label: "Air fryer" },
  { id: "instant-pot", label: "Instant Pot" },
  { id: "slow-cooker", label: "Slow cooker" },
  { id: "oven", label: "Oven" },
  { id: "hob", label: "Hob" },
  { id: "microwave", label: "Microwave" },
];

const TABS: Array<{ id: Mode; label: string; blurb: string }> = [
  { id: "PANTRY", label: "From my pantry", blurb: "Dinner from everything you have." },
  { id: "LEFTOVERS", label: "Leftovers", blurb: "Turn cooked food into a second meal." },
  { id: "APPLIANCE", label: "By appliance", blurb: "Written for one machine, properly." },
  { id: "PET", label: "PantryPup", blurb: "Food for your dog or cat." },
];

export function Generator({
  pantryCount,
  quota,
  canPet,
}: {
  pantryCount: number;
  quota: { used: number; limit: number | null; remaining: number | null };
  canPet: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("PANTRY");
  const [leftovers, setLeftovers] = useState("");
  const [appliance, setAppliance] = useState(APPLIANCES[0].id);
  const [species, setSpecies] = useState<"dog" | "cat">("dog");
  const [weight, setWeight] = useState("12");
  const [petNotes, setPetNotes] = useState("");

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const [results, setResults] = useState<RecipeRecord[]>([]);
  const [remaining, setRemaining] = useState(quota.remaining);

  const empty = pantryCount === 0 && mode !== "PET";
  const outOfQuota = remaining !== null && remaining <= 0;

  async function generate() {
    setError(null);
    setUpgrade(false);
    setPending(true);
    setResults([]);

    const body: Record<string, unknown> = { kind: mode };
    if (mode === "LEFTOVERS") body.leftovers = leftovers;
    if (mode === "APPLIANCE") body.appliance = appliance;
    if (mode === "PET") {
      body.species = species;
      body.weightKg = Number(weight);
      if (petNotes.trim()) body.notes = petNotes.trim();
    }

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        recipes?: RecipeRecord[];
        quota?: { remaining: number | null };
        error?: string;
        code?: string;
      };

      if (!res.ok || !data.recipes) {
        if (data.code === "UPGRADE" || data.code === "QUOTA") setUpgrade(true);
        throw new Error(data.error ?? "Generation failed.");
      }

      setResults(data.recipes);
      if (data.quota) setRemaining(data.quota.remaining);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  const disabled =
    pending ||
    outOfQuota ||
    (mode === "LEFTOVERS" && leftovers.trim().length < 2) ||
    (mode === "PET" && (!canPet || !weight)) ||
    empty;

  return (
    <div>
      {/* Mode tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-full bg-surface-neutral p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setMode(tab.id)}
            aria-pressed={mode === tab.id}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-small font-medium transition-all duration-200 ease-apple",
              mode === tab.id ? "bg-white text-ink shadow-sm" : "text-ink-soft hover:text-ink",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6 rounded-card bg-white p-7 shadow-card">
        <p className="text-regular text-ink-soft">
          {TABS.find((t) => t.id === mode)?.blurb}
        </p>

        {mode === "LEFTOVERS" && (
          <div className="mt-6">
            <label htmlFor="leftovers" className="block text-small font-medium text-ink">
              What's left over?
            </label>
            <textarea
              id="leftovers"
              rows={3}
              value={leftovers}
              onChange={(e) => setLeftovers(e.target.value)}
              placeholder="Half a roast chicken, some cold rice, a bit of gravy"
              className="field mt-2 resize-none"
            />
          </div>
        )}

        {mode === "APPLIANCE" && (
          <div className="mt-6">
            <span className="block text-small font-medium text-ink">Which machine?</span>
            <div className="mt-3 flex flex-wrap gap-2">
              {APPLIANCES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setAppliance(item.id)}
                  aria-pressed={appliance === item.id}
                  className={cn(
                    "rounded-full px-4 py-2 text-small transition-colors duration-200",
                    appliance === item.id
                      ? "bg-ink text-white"
                      : "bg-surface-muted text-ink-soft hover:bg-surface-neutral",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === "PET" && (
          <div className="mt-6 space-y-5">
            {!canPet && (
              <p className="rounded-form bg-accent-quiet px-4 py-3 text-small text-ink">
                PantryPup is part of Plus.{" "}
                <Link href="/app/billing" className="font-medium text-accent hover:underline">
                  Upgrade
                </Link>{" "}
                to use it.
              </p>
            )}

            <div className="flex flex-wrap gap-6">
              <div>
                <span className="block text-small font-medium text-ink">Species</span>
                <div className="mt-2 flex gap-2">
                  {(["dog", "cat"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSpecies(s)}
                      aria-pressed={species === s}
                      className={cn(
                        "rounded-full px-5 py-2 text-small capitalize transition-colors duration-200",
                        species === s
                          ? "bg-ink text-white"
                          : "bg-surface-muted text-ink-soft hover:bg-surface-neutral",
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="weight" className="block text-small font-medium text-ink">
                  Adult weight (kg)
                </label>
                <input
                  id="weight"
                  type="number"
                  min={0.5}
                  max={100}
                  step={0.5}
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="field mt-2 w-32"
                />
              </div>
            </div>

            <div>
              <label htmlFor="petNotes" className="block text-small font-medium text-ink">
                Anything else? <span className="text-ink-faint">(optional)</span>
              </label>
              <input
                id="petNotes"
                value={petNotes}
                onChange={(e) => setPetNotes(e.target.value)}
                placeholder="Sensitive stomach, doesn't like fish"
                className="field mt-2"
              />
            </div>

            <p className="text-tiny text-ink-faint">
              Home-cooked pet food isn't complete without supplementation. Check
              with your vet before it replaces a full diet.
            </p>
          </div>
        )}

        {empty && (
          <p className="mt-6 rounded-form bg-surface-muted px-4 py-3 text-small text-ink-soft">
            Your pantry is empty.{" "}
            <Link href="/app/pantry" className="font-medium text-accent hover:underline">
              Add a few things
            </Link>{" "}
            first, or photograph your fridge.
          </p>
        )}

        {error && (
          <div className="mt-6 rounded-form bg-[#fdeceb] px-4 py-3">
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

        <div className="mt-7 flex flex-wrap items-center gap-4">
          <button type="button" onClick={generate} disabled={disabled} className="btn-primary">
            {pending ? "Writing recipes…" : "Generate"}
          </button>

          {remaining !== null && (
            <span className="text-small text-ink-faint">
              {remaining} of {quota.limit} left today
            </span>
          )}
        </div>

        {pending && (
          <p className="mt-4 text-small text-ink-faint">
            This takes a few seconds — it's writing from scratch, not searching a list.
          </p>
        )}
      </div>

      <AnimatePresence>
        {results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.28, 0.11, 0.32, 1] }}
            className="mt-10"
          >
            <h2 className="text-h6 font-semibold tracking-tight text-ink">
              {results.length} {results.length === 1 ? "recipe" : "recipes"}
            </h2>
            <div className="mt-5 grid gap-5 lg:grid-cols-3">
              {results.map((recipe) => (
                <RecipeCard key={recipe.id} recipe={recipe} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
