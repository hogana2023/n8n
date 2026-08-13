import Link from "next/link";

import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Shared building blocks                                                     */
/* -------------------------------------------------------------------------- */

export function SectionHeading({
  eyebrow,
  title,
  body,
  align = "center",
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  body?: React.ReactNode;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "max-w-3xl",
        align === "center" && "mx-auto text-center",
        className,
      )}
    >
      {eyebrow && (
        <p className="text-medium font-medium text-herb">{eyebrow}</p>
      )}
      <h2 className="mt-3 text-[2rem] font-semibold leading-[1.1] tracking-[-0.022em] text-ink md:text-h2">
        {title}
      </h2>
      {body && (
        <p className="mt-5 text-large text-pretty text-ink-soft">{body}</p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* How it works                                                               */
/* -------------------------------------------------------------------------- */

const STEPS = [
  {
    n: "01",
    title: "Stock your pantry once",
    body: "Type what you have, or scan a receipt. PantryChef understands 'a couple of ripe tomatoes' the same way it understands 'tomato'.",
  },
  {
    n: "02",
    title: "See what's cookable tonight",
    body: "Every recipe is ranked by how much of it you already own. The ones needing nothing extra sit at the top.",
  },
  {
    n: "03",
    title: "Cook, and the pantry updates",
    body: "Mark a meal cooked and the ingredients come off your shelf. Tomorrow's suggestions already know.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="band bg-surface-muted">
      <div className="shell">
        <SectionHeading
          eyebrow="How it works"
          title="Three steps. Then it just runs."
          body="No meal planning spreadsheet. No 40-minute Sunday ritual. You tell it what you have once, and it keeps up from there."
        />

        <ol className="mt-16 grid gap-6 md:grid-cols-3">
          {STEPS.map((step) => (
            <li
              key={step.n}
              className="rounded-card bg-white p-8 shadow-card transition-transform duration-300 ease-apple hover:-translate-y-1"
            >
              <span className="text-small font-semibold tabular-nums text-herb">
                {step.n}
              </span>
              <h3 className="mt-4 text-h5 font-semibold tracking-tight text-ink">
                {step.title}
              </h3>
              <p className="mt-3 text-regular text-pretty text-ink-soft">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Feature bands — alternating, full-bleed, Apple product-page rhythm         */
/* -------------------------------------------------------------------------- */

function FeatureBand({
  eyebrow,
  title,
  body,
  bullets,
  visual,
  flip = false,
  tone = "light",
}: {
  eyebrow: string;
  title: string;
  body: string;
  bullets?: string[];
  visual: React.ReactNode;
  flip?: boolean;
  tone?: "light" | "dark";
}) {
  return (
    <section
      className={cn(
        "band",
        tone === "dark" ? "bg-ink text-white" : "bg-white text-ink",
      )}
    >
      <div className="shell grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <div className={cn(flip && "lg:order-2")}>
          <p
            className={cn(
              "text-medium font-medium",
              tone === "dark" ? "text-herb-soft" : "text-herb",
            )}
          >
            {eyebrow}
          </p>
          <h2
            className={cn(
              "mt-3 text-[1.9rem] font-semibold leading-[1.12] tracking-[-0.02em] md:text-h3",
              tone === "dark" ? "text-white" : "text-ink",
            )}
          >
            {title}
          </h2>
          <p
            className={cn(
              "mt-5 text-large text-pretty",
              tone === "dark" ? "text-white/70" : "text-ink-soft",
            )}
          >
            {body}
          </p>

          {bullets && (
            <ul className="mt-8 space-y-4">
              {bullets.map((bullet) => (
                <li key={bullet} className="flex gap-3">
                  <span
                    aria-hidden
                    className={cn(
                      "mt-[0.45rem] size-1.5 shrink-0 rounded-full",
                      tone === "dark" ? "bg-herb-soft" : "bg-herb",
                    )}
                  />
                  <span
                    className={cn(
                      "text-regular",
                      tone === "dark" ? "text-white/75" : "text-ink-soft",
                    )}
                  >
                    {bullet}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={cn(flip && "lg:order-1")}>{visual}</div>
      </div>
    </section>
  );
}

/* --- Visuals: CSS-drawn so the page ships no marketing screenshots -------- */

function WasteVisual() {
  const bars = [
    { label: "Before", value: 100, tone: "bg-hairline" },
    { label: "Month 1", value: 64, tone: "bg-herb/50" },
    { label: "Month 3", value: 31, tone: "bg-herb" },
  ];
  return (
    <div className="rounded-card bg-surface-muted p-8 shadow-card">
      <p className="text-small font-medium text-ink-soft">Food thrown away</p>
      <div className="mt-8 space-y-6">
        {bars.map((bar) => (
          <div key={bar.label}>
            <div className="flex items-baseline justify-between">
              <span className="text-small text-ink-soft">{bar.label}</span>
              <span className="text-small font-semibold tabular-nums text-ink">
                {bar.value}%
              </span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white">
              <div
                className={cn("h-full rounded-full", bar.tone)}
                style={{ width: `${bar.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-8 text-tiny text-ink-faint">
        Averages across households tracking 20+ items for 90 days.
      </p>
    </div>
  );
}

function ExpiryVisual() {
  const items = [
    { name: "Spinach", days: 1, tone: "text-[#d1453b]" },
    { name: "Chicken thighs", days: 2, tone: "text-[#c77700]" },
    { name: "Greek yoghurt", days: 5, tone: "text-ink-soft" },
    { name: "Cheddar", days: 12, tone: "text-ink-faint" },
  ];
  return (
    <div className="rounded-card bg-white/5 p-8 ring-1 ring-white/10">
      <p className="text-small font-medium text-white/60">Use these first</p>
      <ul className="mt-6 divide-y divide-white/10">
        {items.map((item) => (
          <li key={item.name} className="flex items-center justify-between py-4">
            <span className="text-regular text-white">{item.name}</span>
            <span className={cn("text-small tabular-nums", item.tone)}>
              {item.days} day{item.days === 1 ? "" : "s"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ListVisual() {
  const rows = [
    { name: "Double cream", state: "buy" },
    { name: "Onions", state: "have" },
    { name: "Smoked paprika", state: "have" },
    { name: "Chicken stock", state: "buy" },
    { name: "Garlic", state: "have" },
  ];
  return (
    <div className="rounded-card bg-surface-muted p-8 shadow-card">
      <div className="flex items-baseline justify-between">
        <p className="text-small font-medium text-ink-soft">Shopping list</p>
        <p className="text-tiny text-herb">3 already in your pantry</p>
      </div>
      <ul className="mt-6 space-y-2.5">
        {rows.map((row) => (
          <li
            key={row.name}
            className="flex items-center gap-3 rounded-xl bg-white px-4 py-3"
          >
            <span
              aria-hidden
              className={cn(
                "grid size-5 shrink-0 place-items-center rounded-md text-[11px] font-bold text-white",
                row.state === "have" ? "bg-herb" : "bg-hairline",
              )}
            >
              {row.state === "have" ? "✓" : ""}
            </span>
            <span
              className={cn(
                "text-regular",
                row.state === "have"
                  ? "text-ink-faint line-through decoration-hairline"
                  : "text-ink",
              )}
            >
              {row.name}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Features() {
  return (
    <div id="features">
      <FeatureBand
        eyebrow="Waste less"
        title="The average household bins £700 of food a year."
        body="PantryChef's whole job is to make that number smaller. It knows what you bought, what's near its date, and what those things add up to."
        bullets={[
          "Expiry tracking that nudges before, not after",
          "Recipes weighted toward what's about to turn",
          "A weekly summary of what you actually saved",
        ]}
        visual={<WasteVisual />}
      />

      <FeatureBand
        eyebrow="Never guess again"
        title="It tells you what to use tonight."
        body="Open the app and the first thing you see is the ingredient closest to its date, and the three meals that would use it up."
        bullets={[
          "Sorted by urgency, not alphabet",
          "One tap to see what it turns into",
          "Silence the ones you don't care about",
        ]}
        visual={<ExpiryVisual />}
        flip
        tone="dark"
      />

      <FeatureBand
        eyebrow="Shop for the gap"
        title="A list of what you're missing. Nothing else."
        body="Pick a week of meals and PantryChef subtracts your pantry from the ingredients. What's left is the list, and it is always shorter than you expect."
        bullets={[
          "Auto-ticks what you already own",
          "Groups by aisle, not by recipe",
          "Shares to anyone in the household",
        ]}
        visual={<ListVisual />}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Stats                                                                      */
/* -------------------------------------------------------------------------- */

export function Stats() {
  const stats = [
    { value: "1,400+", label: "chef-tested recipes" },
    { value: "31%", label: "less food binned, on average" },
    { value: "4 min", label: "median time to decide dinner" },
    { value: "£58", label: "saved per month, typical household" },
  ];

  return (
    <section className="band bg-surface-muted">
      <div className="shell">
        <SectionHeading
          eyebrow="The difference"
          title="Small change in habit. Large change in bin."
        />
        <dl className="mt-14 grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-6">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <dt className="sr-only">{stat.label}</dt>
              <dd>
                <span className="block text-[2.25rem] font-semibold tracking-[-0.02em] text-ink md:text-h3">
                  {stat.value}
                </span>
                <span className="mt-2 block text-small text-pretty text-ink-soft">
                  {stat.label}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Testimonials                                                               */
/* -------------------------------------------------------------------------- */

const QUOTES = [
  {
    quote:
      "I stopped doing a big shop. I now buy four things on a Tuesday and the app tells me that's a week of dinners.",
    name: "Priya Raman",
    role: "Household of four, Leeds",
  },
  {
    quote:
      "The expiry list is the whole product for me. I haven't thrown out a bag of spinach since March.",
    name: "Tom Okafor",
    role: "Cooks for one, Bristol",
  },
  {
    quote:
      "It's the only recipe app that starts from my kitchen instead of somebody else's shopping list.",
    name: "Elena Vasquez",
    role: "Household of two, Glasgow",
  },
];

export function Testimonials() {
  return (
    <section className="band bg-white">
      <div className="shell">
        <SectionHeading
          eyebrow="From the kitchen"
          title="People stopped planning and started cooking."
        />
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {QUOTES.map((item) => (
            <figure
              key={item.name}
              className="flex flex-col rounded-card bg-surface-muted p-8"
            >
              <blockquote className="flex-1 text-medium text-pretty text-ink">
                “{item.quote}”
              </blockquote>
              <figcaption className="mt-6 border-t border-hairline pt-5">
                <span className="block text-small font-semibold text-ink">
                  {item.name}
                </span>
                <span className="mt-0.5 block text-small text-ink-faint">
                  {item.role}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Closing CTA                                                                */
/* -------------------------------------------------------------------------- */

export function ClosingCta() {
  return (
    <section className="band bg-ink">
      <div className="shell text-center">
        <h2 className="mx-auto max-w-3xl text-[2rem] font-semibold leading-[1.1] tracking-[-0.022em] text-white md:text-h2">
          Open your fridge. We'll take it from there.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-large text-pretty text-white/70">
          Free for your first 15 ingredients, forever. Upgrade only when your
          pantry outgrows it.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/signup" className="btn-primary w-full sm:w-auto">
            Start free
          </Link>
          <Link
            href="/pricing"
            className="btn-pill w-full border border-white/25 text-white hover:bg-white/10 sm:w-auto"
          >
            Compare plans
          </Link>
        </div>
      </div>
    </section>
  );
}
