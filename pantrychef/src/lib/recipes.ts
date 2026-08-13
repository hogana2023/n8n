import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isPaid } from "@/lib/plans";
import type { PlanId } from "@/lib/plans";

export type RecipeWithIngredients = Prisma.RecipeGetPayload<{
  include: { ingredients: true };
}>;

export type RecipeMatch = {
  recipe: RecipeWithIngredients;
  /** 0–100. How much of the recipe the user can already cover. */
  score: number;
  have: string[];
  missing: Array<{ slug: string; label: string }>;
  /** True when the recipe needs nothing beyond staples. */
  cookNow: boolean;
  /** True when the body is withheld because the user is on the free plan. */
  locked: boolean;
};

/**
 * Rank recipes against a pantry.
 *
 * Scoring is deliberately simple and explainable — people need to trust why a
 * recipe surfaced. Staples (salt, oil, water) never count against a recipe,
 * and a single missing ingredient is penalised far less than three, so
 * "one quick shop" recipes still rank above "half a trolley" ones.
 */
export function scoreRecipe(
  recipe: RecipeWithIngredients,
  pantrySlugs: Set<string>,
): Omit<RecipeMatch, "locked"> {
  const required = recipe.ingredients.filter((i) => !i.isStaple);

  const have: string[] = [];
  const missing: Array<{ slug: string; label: string }> = [];

  for (const ingredient of required) {
    if (pantrySlugs.has(ingredient.slug)) {
      have.push(ingredient.slug);
    } else {
      missing.push({ slug: ingredient.slug, label: ingredient.label });
    }
  }

  // A recipe with no non-staple ingredients is trivially cookable.
  const coverage = required.length === 0 ? 1 : have.length / required.length;

  // Each missing ingredient past the first costs an extra 6 points, so
  // "missing 1" (94) still beats "missing 2" (~82) at equal coverage.
  const penalty = missing.length > 1 ? (missing.length - 1) * 6 : 0;
  const score = Math.max(0, Math.round(coverage * 100) - penalty);

  return { recipe, score, have, missing, cookNow: missing.length === 0 };
}

/** Rank the whole library against a user's pantry. */
export async function matchRecipesForUser(
  userId: string,
  plan: PlanId,
  options: { limit?: number; onlyCookNow?: boolean } = {},
): Promise<RecipeMatch[]> {
  const { limit = 24, onlyCookNow = false } = options;

  const [pantry, recipes] = await Promise.all([
    prisma.pantryItem.findMany({ where: { userId }, select: { slug: true } }),
    prisma.recipe.findMany({ include: { ingredients: true } }),
  ]);

  const pantrySlugs = new Set(pantry.map((item) => item.slug));
  const paid = isPaid(plan);

  let matches = recipes
    .map((recipe) => ({ ...scoreRecipe(recipe, pantrySlugs), locked: recipe.isPremium && !paid }))
    // A recipe covering nothing at all is noise, not a suggestion.
    .filter((match) => match.score > 0);

  if (onlyCookNow) matches = matches.filter((m) => m.cookNow);

  matches.sort((a, b) => {
    // Cookable-right-now always leads; it is the whole point of the product.
    if (a.cookNow !== b.cookNow) return a.cookNow ? -1 : 1;
    if (b.score !== a.score) return b.score - a.score;
    // Locked recipes sink below equivalent unlocked ones so the free tier
    // still feels usable rather than like a wall of padlocks.
    if (a.locked !== b.locked) return a.locked ? 1 : -1;
    return a.recipe.minutes - b.recipe.minutes;
  });

  return matches.slice(0, limit);
}

/** Ingredients to buy to unlock the most recipes, most valuable first. */
export function shoppingSuggestions(matches: RecipeMatch[], take = 5) {
  const counts = new Map<string, { label: string; unlocks: number }>();

  for (const match of matches) {
    // Only near-misses are actionable; a recipe missing six things is not a
    // shopping suggestion, it is a different meal.
    if (match.missing.length === 0 || match.missing.length > 2) continue;
    for (const item of match.missing) {
      const entry = counts.get(item.slug) ?? { label: item.label, unlocks: 0 };
      entry.unlocks += 1;
      counts.set(item.slug, entry);
    }
  }

  return [...counts.entries()]
    .map(([slug, value]) => ({ slug, ...value }))
    .sort((a, b) => b.unlocks - a.unlocks)
    .slice(0, take);
}
