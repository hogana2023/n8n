import Link from "next/link";

import { cn } from "@/lib/utils";
import type { RecipeMatch } from "@/lib/recipes";

export function RecipeCard({ match }: { match: RecipeMatch }) {
  const { recipe, score, missing, cookNow, locked } = match;

  return (
    <article
      className={cn(
        "flex flex-col overflow-hidden rounded-card bg-white shadow-card transition-transform duration-300 ease-apple",
        !locked && "hover:-translate-y-1",
      )}
    >
      <div
        className="aspect-[3/2] w-full bg-surface-muted bg-cover bg-center"
        style={recipe.imageUrl ? { backgroundImage: `url(${recipe.imageUrl})` } : undefined}
      />

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-2">
          {cookNow ? (
            <span className="rounded-full bg-herb-soft px-2.5 py-1 text-tiny font-medium text-herb">
              Cook now
            </span>
          ) : (
            <span className="rounded-full bg-surface-muted px-2.5 py-1 text-tiny font-medium text-ink-soft">
              {score}% match
            </span>
          )}
          <span className="text-tiny text-ink-faint">{recipe.minutes} min</span>
          {locked && (
            <span className="ml-auto text-tiny font-medium text-accent">Plus</span>
          )}
        </div>

        <h3 className="mt-3 text-medium font-semibold tracking-tight text-ink">
          {recipe.title}
        </h3>
        <p className="mt-1.5 line-clamp-2 flex-1 text-small text-pretty text-ink-soft">
          {recipe.summary}
        </p>

        {missing.length > 0 && (
          <p className="mt-3 text-tiny text-ink-faint">
            Missing: {missing.map((m) => m.label).join(", ")}
          </p>
        )}

        {locked ? (
          <Link
            href="/app/billing"
            className="mt-4 text-small font-medium text-accent hover:underline"
          >
            Unlock with Plus ›
          </Link>
        ) : (
          <Link
            href={`/app/recipes/${recipe.slug}`}
            className="mt-4 text-small font-medium text-accent hover:underline"
          >
            See the method ›
          </Link>
        )}
      </div>
    </article>
  );
}
