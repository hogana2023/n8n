import Link from "next/link";

import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */

export function SectionHeading({
  eyebrow,
  title,
  body,
  align = "left",
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  body?: React.ReactNode;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow && <p className="text-small font-medium text-herb">{eyebrow}</p>}
      <h2 className="mt-3 text-[2rem] font-semibold leading-[1.1] tracking-[-0.022em] text-ink md:text-h2">
        {title}
      </h2>
      {body && <p className="mt-5 text-large text-pretty text-ink-soft">{body}</p>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* What it does — the modes, which are the actual product                     */
/* -------------------------------------------------------------------------- */

const MODES = [
  {
    name: "From your pantry",
    body: "List what you have. Get recipes built around it, in your cuisines, inside your dietary requirements.",
    glyph: "▦",
  },
  {
    name: "From a photo",
    body: "Point your phone at an open fridge. It reads what's there and fills the pantry for you.",
    glyph: "◉",
  },
  {
    name: "From leftovers",
    body: "Half a roast chicken and cold rice is a different problem from raw ingredients. It's treated as one.",
    glyph: "↻",
  },
  {
    name: "For your appliance",
    body: "Air fryer, Instant Pot, slow cooker. Real settings and timings, not an oven recipe with a new name.",
    glyph: "◎",
  },
  {
    name: "For your dog or cat",
    body: "PantryPup writes pet food that costs less than the pouches. Toxic ingredients are hard-blocked.",
    glyph: "✦",
  },
  {
    name: "Into cookbooks",
    body: "Recipes file themselves into collections by category. The good ones become books you can buy.",
    glyph: "❐",
  },
];

export function Modes() {
  return (
    <section id="features" className="band bg-surface-muted">
      <div className="shell">
        <SectionHeading
          eyebrow="Six ways in"
          title="Most recipe apps start with a recipe. This one starts with your kitchen."
          body="Same engine underneath, six different ways of asking. Every one of them respects the allergies and dislikes you set once."
        />

        <ul className="mt-16 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {MODES.map((mode) => (
            <li key={mode.name}>
              <span
                aria-hidden
                className="grid size-11 place-items-center rounded-2xl bg-white text-large text-herb shadow-card"
              >
                {mode.glyph}
              </span>
              <h3 className="mt-5 text-h6 font-semibold tracking-tight text-ink">{mode.name}</h3>
              <p className="mt-2 text-regular text-pretty text-ink-soft">{mode.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* The photo flow — one deep section, because it's the striking one           */
/* -------------------------------------------------------------------------- */

export function PhotoFlow() {
  const steps = [
    { n: "1", text: "Open the fridge and take one photo." },
    { n: "2", text: "It reads the shelves and lists what it can see." },
    { n: "3", text: "Anything it's unsure about it asks about rather than guessing." },
    { n: "4", text: "Your pantry is filled in. Dinner follows from there." },
  ];

  return (
    <section className="band bg-ink">
      <div className="shell grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
        <div>
          <p className="text-small font-medium text-herb-soft">Photograph it</p>
          <h2 className="mt-3 text-[1.9rem] font-semibold leading-[1.12] tracking-[-0.02em] text-white md:text-h3">
            Typing out your fridge is the reason nobody does this.
          </h2>
          <p className="mt-5 text-large text-pretty text-white/70">
            So don't. One photo of an open fridge and PantryChef reads the shelves.
            It won't pretend to know what's inside an unlabelled container, and
            it flags what it isn't sure about instead of quietly adding it.
          </p>

          <ol className="mt-10 space-y-5">
            {steps.map((step) => (
              <li key={step.n} className="flex gap-4">
                <span className="grid size-7 shrink-0 place-items-center rounded-full border border-white/25 text-tiny font-semibold text-white/80">
                  {step.n}
                </span>
                <span className="text-regular text-white/75">{step.text}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* A representation of the scan result, not a screenshot. */}
        <div className="rounded-card bg-white/[0.06] p-7 ring-1 ring-white/10">
          <div className="flex items-center justify-between">
            <p className="text-small font-medium text-white/60">Read from your photo</p>
            <span className="rounded-full bg-herb/20 px-2.5 py-1 text-tiny text-herb-soft">
              14 items
            </span>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {["eggs", "spring onions", "cheddar", "chicken thighs", "spinach", "double cream", "tortillas", "chestnut mushrooms"].map(
              (item) => (
                <span
                  key={item}
                  className="rounded-full bg-white/10 px-3 py-1.5 text-small text-white/85"
                >
                  {item}
                </span>
              ),
            )}
          </div>

          <div className="mt-7 rounded-2xl bg-white/[0.05] p-4">
            <p className="text-tiny font-medium uppercase tracking-wide text-white/40">
              Not sure about
            </p>
            <p className="mt-2 text-small text-white/70">
              A tub on the middle shelf, and something wrapped in foil. Tap to tell it what they are.
            </p>
          </div>

          <p className="mt-6 text-tiny text-white/35">
            Illustrative of the scan output. Photo scanning is on Plus.
          </p>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* PantryPup                                                                  */
/* -------------------------------------------------------------------------- */

export function PantryPup() {
  return (
    <section className="band bg-white">
      <div className="shell grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
        <div className="order-2 lg:order-1">
          <div className="rounded-card bg-herb-soft p-8">
            <p className="text-small font-medium text-herb">Hard-blocked, every time</p>
            <ul className="mt-5 flex flex-wrap gap-2">
              {["onion", "garlic", "grapes", "raisins", "chocolate", "xylitol", "macadamia", "cooked bones"].map(
                (item) => (
                  <li
                    key={item}
                    className="rounded-full bg-white px-3 py-1.5 text-small text-ink line-through decoration-[#b3261e]/50 decoration-2"
                  >
                    {item}
                  </li>
                ),
              )}
            </ul>
            <p className="mt-6 text-small text-pretty text-ink-soft">
              Cats are treated as obligate carnivores regardless of what's asked
              for. Every recipe says plainly that home-cooked food needs
              supplementation, and to check the balance with your vet before it
              becomes a staple rather than a topper.
            </p>
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <p className="text-small font-medium text-herb">PantryPup</p>
          <h2 className="mt-3 text-[1.9rem] font-semibold leading-[1.12] tracking-[-0.02em] text-ink md:text-h3">
            Better food for your dog, at pouch prices.
          </h2>
          <p className="mt-5 text-large text-pretty text-ink-soft">
            Tell it the species and the weight. It writes batch recipes from
            ordinary supermarket ingredients, with portions by body weight.
          </p>
          <p className="mt-5 text-regular text-pretty text-ink-soft">
            The part that matters is what it refuses to do. Pet nutrition is
            where a confident-sounding mistake actually hurts something, so the
            toxic list is enforced as a rule rather than left to the model's
            judgement.
          </p>
          <Link
            href="/signup"
            className="mt-8 inline-block text-regular font-medium text-accent hover:underline underline-offset-4"
          >
            Try it on your dog&nbsp;›
          </Link>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Cookbooks                                                                  */
/* -------------------------------------------------------------------------- */

export function Cookbooks() {
  const books = [
    { title: "Air Fryer Weeknights", n: "40 recipes", color: "#1d7a4c" },
    { title: "One Pot, Six People", n: "36 recipes", color: "#2f5d8a" },
    { title: "The Leftovers Book", n: "48 recipes", color: "#8a4a2f" },
  ];

  return (
    <section className="band bg-surface-muted">
      <div className="shell">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            eyebrow="Cookbooks"
            title="The good ones become books."
            body="Recipes file themselves into collections by category as they're generated. Curated ones go on sale as one-off purchases — no subscription needed to buy one."
          />
        </div>

        <ul className="mt-14 grid gap-8 sm:grid-cols-3">
          {books.map((book) => (
            <li key={book.title}>
              <div
                className="flex aspect-[3/4] flex-col justify-end rounded-image p-6 shadow-card"
                style={{ backgroundColor: book.color }}
              >
                <h3 className="text-h5 font-semibold leading-tight tracking-tight text-white">
                  {book.title}
                </h3>
                <p className="mt-2 text-small text-white/70">{book.n}</p>
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-small text-ink-faint">
          Covers shown are placeholders for the collections in the app.
        </p>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Closing CTA                                                                */
/* -------------------------------------------------------------------------- */

export function ClosingCta() {
  return (
    <section className="band bg-white">
      <div className="shell">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-[2rem] font-semibold leading-[1.1] tracking-[-0.022em] text-ink md:text-h2">
            Open the fridge. We'll take it from there.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-large text-pretty text-ink-soft">
            Three recipes a day, free, no card. Upgrade when you find yourself
            using it every night.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/signup" className="btn-primary w-full sm:w-auto">
              Start free
            </Link>
            <Link href="/pricing" className="btn-secondary w-full sm:w-auto">
              See pricing
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
