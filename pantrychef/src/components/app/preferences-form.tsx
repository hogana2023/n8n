"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

const CUISINES = [
  "Italian", "Indian", "Chinese", "Japanese", "Thai", "Mexican",
  "Middle Eastern", "French", "Greek", "Korean", "Vietnamese", "British",
];

const DIETARY = [
  "vegetarian", "vegan", "pescatarian", "gluten-free", "dairy-free",
  "nut-free", "egg-free", "shellfish-free", "halal", "kosher", "low-carb",
];

const APPLIANCES = [
  "air fryer", "Instant Pot", "slow cooker", "oven", "hob",
  "microwave", "blender", "food processor",
];

type Prefs = {
  cuisines: string[];
  dietary: string[];
  dislikes: string[];
  appliances: string[];
};

function Chips({
  options,
  selected,
  onToggle,
  tone = "default",
}: {
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  tone?: "default" | "warn";
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {options.map((option) => {
        const on = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => onToggle(option)}
            aria-pressed={on}
            className={cn(
              "rounded-full px-3.5 py-2 text-small transition-all duration-200 ease-apple active:scale-95",
              on
                ? tone === "warn"
                  ? "bg-[#b3261e] text-white"
                  : "bg-ink text-white"
                : "bg-surface-muted text-ink-soft hover:bg-surface-neutral",
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

export function PreferencesForm({ initial }: { initial: Prefs }) {
  const router = useRouter();
  const [prefs, setPrefs] = useState<Prefs>(initial);
  const [dislikeInput, setDislikeInput] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(key: keyof Prefs, value: string) {
    setSaved(false);
    setPrefs((prev) => ({
      ...prev,
      [key]: prev[key].includes(value)
        ? prev[key].filter((v) => v !== value)
        : [...prev[key], value],
    }));
  }

  function addDislike(event: React.FormEvent) {
    event.preventDefault();
    const value = dislikeInput.trim().toLowerCase();
    if (!value || prefs.dislikes.includes(value)) return;
    setPrefs((prev) => ({ ...prev, dislikes: [...prev.dislikes, value] }));
    setDislikeInput("");
    setSaved(false);
  }

  async function save() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Could not save.");
      }
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-card bg-white p-7 shadow-card">
        <h2 className="text-h6 font-semibold tracking-tight text-ink">
          Dietary requirements
        </h2>
        <p className="mt-1.5 text-small text-ink-soft">
          Treated as hard constraints. Nothing that breaks one will be suggested.
        </p>
        <Chips
          options={DIETARY}
          selected={prefs.dietary}
          onToggle={(v) => toggle("dietary", v)}
        />
        <p className="mt-4 text-tiny text-ink-faint">
          For a severe allergy, still read the ingredient list before cooking.
          This is software, not a guarantee.
        </p>
      </section>

      <section className="rounded-card bg-white p-7 shadow-card">
        <h2 className="text-h6 font-semibold tracking-tight text-ink">Cuisines you like</h2>
        <p className="mt-1.5 text-small text-ink-soft">
          A steer, not a restriction. Leave empty for anything.
        </p>
        <Chips
          options={CUISINES}
          selected={prefs.cuisines}
          onToggle={(v) => toggle("cuisines", v)}
        />
      </section>

      <section className="rounded-card bg-white p-7 shadow-card">
        <h2 className="text-h6 font-semibold tracking-tight text-ink">Won't eat</h2>
        <p className="mt-1.5 text-small text-ink-soft">
          Dislikes rather than allergies. Add anything you'd rather never see.
        </p>

        <form onSubmit={addDislike} className="mt-4 flex gap-2">
          <input
            value={dislikeInput}
            onChange={(e) => setDislikeInput(e.target.value)}
            placeholder="coriander"
            aria-label="Add something you won't eat"
            className="field flex-1"
          />
          <button type="submit" className="btn-secondary shrink-0">
            Add
          </button>
        </form>

        {prefs.dislikes.length > 0 && (
          <Chips
            options={prefs.dislikes}
            selected={prefs.dislikes}
            onToggle={(v) => toggle("dislikes", v)}
            tone="warn"
          />
        )}
      </section>

      <section className="rounded-card bg-white p-7 shadow-card">
        <h2 className="text-h6 font-semibold tracking-tight text-ink">What you cook with</h2>
        <p className="mt-1.5 text-small text-ink-soft">
          Recipes will lean on what you actually own.
        </p>
        <Chips
          options={APPLIANCES}
          selected={prefs.appliances}
          onToggle={(v) => toggle("appliances", v)}
        />
      </section>

      <div className="flex items-center gap-4">
        <button type="button" onClick={save} disabled={pending} className="btn-primary">
          {pending ? "Saving…" : "Save preferences"}
        </button>
        {saved && <span className="text-small text-herb">Saved.</span>}
        {error && (
          <span role="alert" className="text-small text-[#b3261e]">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
