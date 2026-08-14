import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { SaveToggle } from "@/components/app/save-toggle";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

type Ingredient = { item: string; amount: string; have: boolean };
type Nutrition = { calories: number; protein: number; carbs: number; fat: number };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { title: "Recipe" };

  const recipe = await prisma.recipe.findFirst({
    where: { id: params.id, userId: session.user.id },
    select: { title: true },
  });
  return { title: recipe?.title ?? "Recipe" };
}

export default async function RecipeDetailPage({ params }: Params) {
  const session = await getServerSession(authOptions);

  // Scoped to the owner — recipes are per-user, so another account's id is a 404.
  const recipe = await prisma.recipe.findFirst({
    where: { id: params.id, userId: session!.user.id },
  });
  if (!recipe) notFound();

  const ingredients = (recipe.ingredients as unknown as Ingredient[]) ?? [];
  const nutrition = recipe.nutrition as unknown as Nutrition | null;
  const missing = ingredients.filter((i) => !i.have);

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/app/recipes"
        className="text-small text-ink-faint transition-colors hover:text-ink"
      >
        ‹ Recipes
      </Link>

      <header className="mt-6">
        <div className="flex flex-wrap items-center gap-2 text-tiny text-ink-faint">
          <span>{recipe.minutes} min</span>
          <span>·</span>
          <span>serves {recipe.servings}</span>
          <span>·</span>
          <span>{recipe.difficulty}</span>
          {recipe.appliance && (
            <>
              <span>·</span>
              <span>{recipe.appliance.replace("-", " ")}</span>
            </>
          )}
        </div>

        <h1 className="mt-3 text-h3 font-semibold tracking-tight text-ink">
          {recipe.title}
        </h1>
        <p className="mt-3 text-large text-pretty text-ink-soft">{recipe.summary}</p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <SaveToggle id={recipe.id} saved={recipe.saved} />
          {recipe.dietary.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-herb-soft px-3 py-1 text-tiny text-herb"
            >
              {tag}
            </span>
          ))}
        </div>
      </header>

      {recipe.kind === "PET" && (
        <p className="mt-8 rounded-form bg-[#fff4e5] px-4 py-3 text-small text-[#8a5a00]">
          Home-cooked pet food is not nutritionally complete on its own. Treat
          this as a topper, or confirm the supplement plan with your vet before
          it becomes a staple diet.
        </p>
      )}

      <div className="mt-12 grid gap-12 md:grid-cols-[1fr_1.4fr]">
        <section>
          <h2 className="text-h6 font-semibold tracking-tight text-ink">Ingredients</h2>
          <ul className="mt-4 space-y-2.5">
            {ingredients.map((ingredient, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 grid size-5 shrink-0 place-items-center rounded-md text-[11px] font-bold text-white",
                    ingredient.have ? "bg-herb" : "bg-hairline",
                  )}
                >
                  {ingredient.have ? "✓" : ""}
                </span>
                <span
                  className={cn(
                    "text-regular",
                    ingredient.have ? "text-ink-soft" : "text-ink",
                  )}
                >
                  {ingredient.amount} {ingredient.item}
                </span>
              </li>
            ))}
          </ul>

          {missing.length > 0 && (
            <div className="mt-6 rounded-form bg-surface-muted px-4 py-3">
              <p className="text-small text-ink-soft">
                You need to buy: {missing.map((m) => m.item).join(", ")}.
              </p>
            </div>
          )}

          {nutrition && (
            <div className="mt-8">
              <h2 className="text-h6 font-semibold tracking-tight text-ink">
                Per serving
              </h2>
              <dl className="mt-3 grid grid-cols-2 gap-3">
                {[
                  ["Calories", `${nutrition.calories}`],
                  ["Protein", `${nutrition.protein}g`],
                  ["Carbs", `${nutrition.carbs}g`],
                  ["Fat", `${nutrition.fat}g`],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-white p-3 shadow-sm">
                    <dt className="text-tiny text-ink-faint">{label}</dt>
                    <dd className="mt-0.5 text-medium font-semibold tabular-nums text-ink">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2 text-tiny text-ink-faint">Estimated, not measured.</p>
            </div>
          )}
        </section>

        <section>
          <h2 className="text-h6 font-semibold tracking-tight text-ink">Method</h2>
          <ol className="mt-4 space-y-6">
            {recipe.steps.map((step, i) => (
              <li key={i} className="flex gap-4">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-ink text-tiny font-semibold text-white">
                  {i + 1}
                </span>
                <p className="text-regular text-pretty text-ink-soft">{step}</p>
              </li>
            ))}
          </ol>

          {recipe.tips.length > 0 && (
            <div className="mt-10 rounded-card bg-surface-muted p-6">
              <h3 className="text-small font-semibold text-ink">Worth knowing</h3>
              <ul className="mt-3 space-y-2.5">
                {recipe.tips.map((tip, i) => (
                  <li key={i} className="flex gap-3">
                    <span aria-hidden className="mt-[0.45rem] size-1.5 shrink-0 rounded-full bg-herb" />
                    <span className="text-small text-pretty text-ink-soft">{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      <p className="mt-14 border-t border-hairline pt-6 text-tiny text-ink-faint">
        Written by {recipe.model}. Check the ingredients against your own
        requirements before cooking.
      </p>
    </div>
  );
}
