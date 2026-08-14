import Link from "next/link";

import { cn } from "@/lib/utils";

export type RecipeRecord = {
  id: string;
  kind: string;
  title: string;
  summary: string;
  minutes: number;
  servings: number;
  difficulty: string;
  cuisine: string;
  appliance: string | null;
  dietary: string[];
  saved?: boolean;
};

const KIND_LABEL: Record<string, string> = {
  PANTRY: "Pantry",
  LEFTOVERS: "Leftovers",
  APPLIANCE: "Appliance",
  PET: "PantryPup",
};

export function RecipeCard({ recipe }: { recipe: RecipeRecord }) {
  return (
    <article className="flex flex-col rounded-card bg-white p-6 shadow-card transition-transform duration-300 ease-apple hover:-translate-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-tiny font-medium",
            recipe.kind === "PET"
              ? "bg-[#f3ecfa] text-[#6b3fa0]"
              : "bg-herb-soft text-herb",
          )}
        >
          {KIND_LABEL[recipe.kind] ?? recipe.kind}
        </span>
        <span className="text-tiny text-ink-faint">
          {recipe.minutes} min · serves {recipe.servings}
        </span>
      </div>

      <h3 className="mt-3.5 text-medium font-semibold tracking-tight text-ink">
        {recipe.title}
      </h3>
      <p className="mt-2 line-clamp-3 flex-1 text-small text-pretty text-ink-soft">
        {recipe.summary}
      </p>

      {recipe.dietary.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-1.5">
          {recipe.dietary.slice(0, 3).map((tag) => (
            <li
              key={tag}
              className="rounded-full bg-surface-muted px-2.5 py-1 text-tiny text-ink-soft"
            >
              {tag}
            </li>
          ))}
        </ul>
      )}

      <Link
        href={`/app/recipes/${recipe.id}`}
        className="mt-5 text-small font-medium text-accent hover:underline underline-offset-4"
      >
        Read the method ›
      </Link>
    </article>
  );
}
