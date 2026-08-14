"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { cn } from "@/lib/utils";

/**
 * A worked example of each generation mode. These are fixed sample outputs,
 * labelled as such — the real thing runs against your own pantry after signup.
 * Nothing here is presented as a live result or as customer data.
 */

type Mode = {
  id: string;
  label: string;
  ask: string;
  input: string[];
  title: string;
  meta: string;
  lines: string[];
};

const MODES: Mode[] = [
  {
    id: "pantry",
    label: "Pantry",
    ask: "What can I make tonight?",
    input: ["chicken thighs", "spring onions", "rice", "soy sauce", "eggs", "chilli"],
    title: "Charred spring onion chicken rice",
    meta: "30 min · serves 2 · everything in stock",
    lines: [
      "Salt the thighs and leave them skin-side up while the rice steams.",
      "Char the spring onions hard in a dry pan until blistered, then set aside.",
      "Render the thighs skin-side down from cold, 12 minutes, without moving them.",
      "Fold the charred onion and a spoon of the rendered fat through the rice.",
    ],
  },
  {
    id: "leftovers",
    label: "Leftovers",
    ask: "Half a roast chicken and cold rice.",
    input: ["roast chicken", "cooked rice", "stock", "lemon"],
    title: "Chicken and rice soup, avgolemono-style",
    meta: "20 min · serves 3 · uses it all",
    lines: [
      "Strip the carcass and simmer the bones for 15 minutes while you work.",
      "Temper beaten egg with hot stock off the heat, whisking, or it will scramble.",
      "Add the cold rice last and only to warm through, not to cook.",
      "Do not reheat this a second time once the egg is in.",
    ],
  },
  {
    id: "appliance",
    label: "Air fryer",
    ask: "Something in the air fryer.",
    input: ["potatoes", "paprika", "chicken thighs", "lemon"],
    title: "Paprika thighs with crushed potatoes",
    meta: "35 min · serves 2 · air fryer",
    lines: [
      "Parboil the potatoes 8 minutes, drain, and crush them flat under a mug.",
      "Basket at 200°C. Potatoes first, 12 minutes, shaking twice.",
      "Push them to one side, thighs skin-up alongside, 18 minutes more.",
      "Don't stack — anything overlapping steams instead of crisping.",
    ],
  },
  {
    id: "pup",
    label: "PantryPup",
    ask: "Food for a 12kg dog.",
    input: ["turkey mince", "carrot", "pumpkin", "rice", "sunflower oil"],
    title: "Turkey, pumpkin and rice batch",
    meta: "45 min · 6 daily portions · 12kg dog",
    lines: [
      "No onion, garlic, or allium of any kind goes into this. Not for flavour, not at all.",
      "Brown the turkey plain, then simmer with the diced carrot and pumpkin.",
      "Fold the cooked rice through and cool fully before portioning into six.",
      "This is a topper unless your vet has signed off a supplement plan.",
    ],
  },
];

export function HeroDemo() {
  const [active, setActive] = useState(MODES[0]);

  return (
    <div className="overflow-hidden rounded-[1.75rem] bg-white shadow-lifted ring-1 ring-hairline/70">
      {/* Mode switcher */}
      <div className="flex gap-1 overflow-x-auto border-b border-hairline bg-surface-muted/60 p-2">
        {MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            onClick={() => setActive(mode)}
            aria-pressed={active.id === mode.id}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-small font-medium transition-all duration-200 ease-apple",
              active.id === mode.id
                ? "bg-white text-ink shadow-sm"
                : "text-ink-soft hover:text-ink",
            )}
          >
            {mode.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={active.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.28, ease: [0.28, 0.11, 0.32, 1] }}
          className="grid md:grid-cols-[0.85fr_1.15fr]"
        >
          {/* What you give it */}
          <div className="border-b border-hairline p-7 md:border-b-0 md:border-r md:p-9">
            <p className="text-tiny font-medium uppercase tracking-wide text-ink-faint">
              You say
            </p>
            <p className="mt-3 text-h6 font-semibold tracking-tight text-ink">
              {active.ask}
            </p>

            <p className="mt-7 text-tiny font-medium uppercase tracking-wide text-ink-faint">
              You have
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {active.input.map((item) => (
                <li
                  key={item}
                  className="rounded-full bg-surface-muted px-3 py-1.5 text-small text-ink-soft"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* What comes back */}
          <div className="bg-surface-sunken p-7 md:p-9">
            <p className="text-tiny font-medium uppercase tracking-wide text-ink-faint">
              It writes
            </p>
            <h3 className="mt-3 text-h5 font-semibold tracking-tight text-ink">
              {active.title}
            </h3>
            <p className="mt-1.5 text-small text-herb">{active.meta}</p>

            <ol className="mt-6 space-y-3.5">
              {active.lines.map((line, i) => (
                <li key={i} className="flex gap-3.5">
                  <span className="mt-[0.15rem] grid size-5 shrink-0 place-items-center rounded-full bg-ink text-[10px] font-semibold text-white">
                    {i + 1}
                  </span>
                  <span className="text-small text-pretty text-ink-soft">{line}</span>
                </li>
              ))}
            </ol>
          </div>
        </motion.div>
      </AnimatePresence>

      <p className="border-t border-hairline bg-white px-7 py-3.5 text-tiny text-ink-faint md:px-9">
        Worked examples, not live output. Yours are generated against your own
        pantry and requirements.
      </p>
    </div>
  );
}
