"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";

import { cn } from "@/lib/utils";

/**
 * A real, working slice of the product on the marketing page: toggle what you
 * have, watch the matches re-rank. Runs entirely client-side against a fixed
 * demo set — no account, no request.
 */

type DemoRecipe = {
  title: string;
  minutes: number;
  needs: string[];
  image: string;
};

const INGREDIENTS = [
  "eggs",
  "onion",
  "garlic",
  "tomato",
  "pasta",
  "rice",
  "chicken",
  "spinach",
  "cheddar",
  "chickpea",
  "lemon",
  "yoghurt",
] as const;

const DEMO_RECIPES: DemoRecipe[] = [
  {
    title: "Ten-minute tomato & garlic pasta",
    minutes: 10,
    needs: ["pasta", "tomato", "garlic"],
    image: "linear-gradient(135deg,#e8503a,#f0894f)",
  },
  {
    title: "Weeknight chicken traybake",
    minutes: 35,
    needs: ["chicken", "onion", "lemon", "garlic"],
    image: "linear-gradient(135deg,#b9762f,#e2a95a)",
  },
  {
    title: "Spinach & cheddar folded omelette",
    minutes: 8,
    needs: ["eggs", "spinach", "cheddar"],
    image: "linear-gradient(135deg,#2f7d4f,#7bbd83)",
  },
  {
    title: "Chickpea & yoghurt bowl",
    minutes: 15,
    needs: ["chickpea", "yoghurt", "lemon", "spinach"],
    image: "linear-gradient(135deg,#3f6f9c,#79a7cd)",
  },
  {
    title: "Egg fried rice",
    minutes: 12,
    needs: ["rice", "eggs", "onion", "garlic"],
    image: "linear-gradient(135deg,#8a6d3b,#c9a86a)",
  },
];

const INITIAL = new Set<string>(["eggs", "onion", "garlic", "tomato", "pasta"]);

export function HeroDemo() {
  const [selected, setSelected] = useState<Set<string>>(INITIAL);

  const toggle = (item: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });

  const ranked = useMemo(() => {
    return DEMO_RECIPES.map((recipe) => {
      const missing = recipe.needs.filter((n) => !selected.has(n));
      const coverage = (recipe.needs.length - missing.length) / recipe.needs.length;
      return { recipe, missing, coverage };
    })
      .filter((m) => m.coverage > 0)
      .sort((a, b) => {
        if (a.missing.length !== b.missing.length) return a.missing.length - b.missing.length;
        if (b.coverage !== a.coverage) return b.coverage - a.coverage;
        return a.recipe.minutes - b.recipe.minutes;
      })
      .slice(0, 3);
  }, [selected]);

  const cookNow = ranked.filter((m) => m.missing.length === 0).length;

  return (
    <div className="mx-auto max-w-5xl overflow-hidden rounded-[1.75rem] bg-white shadow-lifted ring-1 ring-hairline/60">
      {/* Window chrome, macOS style. */}
      <div className="flex items-center gap-2 border-b border-hairline/60 bg-surface-muted/70 px-5 py-3.5">
        <span className="size-3 rounded-full bg-[#ff5f57]" />
        <span className="size-3 rounded-full bg-[#febc2e]" />
        <span className="size-3 rounded-full bg-[#28c840]" />
        <p className="ml-3 text-tiny font-medium text-ink-faint">Tonight</p>
      </div>

      <div className="grid gap-0 md:grid-cols-[1fr_1.15fr]">
        {/* Pantry side */}
        <div className="border-b border-hairline/60 p-6 md:border-b-0 md:border-r md:p-8">
          <div className="flex items-baseline justify-between">
            <h3 className="text-h6 font-semibold tracking-tight text-ink">In my kitchen</h3>
            <span className="text-tiny tabular-nums text-ink-faint">
              {selected.size} item{selected.size === 1 ? "" : "s"}
            </span>
          </div>

          <p className="mt-1 text-small text-ink-faint">Tap to add or remove.</p>

          <div className="mt-5 flex flex-wrap gap-2">
            {INGREDIENTS.map((item) => {
              const on = selected.has(item);
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggle(item)}
                  aria-pressed={on}
                  className={cn(
                    "rounded-full px-3.5 py-2 text-small capitalize transition-all duration-200 ease-apple active:scale-95",
                    on
                      ? "bg-herb text-white shadow-sm"
                      : "bg-surface-muted text-ink-soft hover:bg-surface-neutral",
                  )}
                >
                  {item}
                </button>
              );
            })}
          </div>
        </div>

        {/* Results side */}
        <div className="bg-surface-sunken p-6 md:p-8">
          <div className="flex items-baseline justify-between">
            <h3 className="text-h6 font-semibold tracking-tight text-ink">
              You can cook
            </h3>
            <span className="text-tiny tabular-nums text-herb">
              {cookNow} ready now
            </span>
          </div>

          <ul className="mt-5 space-y-3">
            <AnimatePresence mode="popLayout" initial={false}>
              {ranked.map(({ recipe, missing }) => (
                <motion.li
                  key={recipe.title}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.32, ease: [0.28, 0.11, 0.32, 1] }}
                  className="flex items-center gap-4 rounded-2xl bg-white p-3.5 shadow-card"
                >
                  <span
                    aria-hidden
                    className="size-12 shrink-0 rounded-xl"
                    style={{ backgroundImage: recipe.image }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-small font-semibold text-ink">
                      {recipe.title}
                    </p>
                    <p className="mt-0.5 text-tiny text-ink-faint">
                      {recipe.minutes} min
                      {missing.length === 0 ? (
                        <span className="text-herb"> · everything in stock</span>
                      ) : (
                        <span> · add {missing.join(", ")}</span>
                      )}
                    </p>
                  </div>
                  {missing.length === 0 && (
                    <span className="shrink-0 rounded-full bg-herb-soft px-2.5 py-1 text-tiny font-medium text-herb">
                      Cook
                    </span>
                  )}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>

          {ranked.length === 0 && (
            <p className="mt-6 text-small text-ink-faint">
              Add an ingredient to see what you can make.
            </p>
          )}

          <Link
            href="/signup"
            className="mt-6 inline-block text-small font-medium text-accent hover:underline underline-offset-4"
          >
            Do this with your real kitchen ›
          </Link>
        </div>
      </div>
    </div>
  );
}
