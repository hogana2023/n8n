import type { Plan } from "@prisma/client";

export type PlanId = "FREE" | "PLUS" | "FAMILY";

export type PlanDefinition = {
  id: PlanId;
  name: string;
  tagline: string;
  /** Price in whole currency units, per month. */
  monthly: number;
  /** Per month, when billed annually. */
  yearly: number;
  features: string[];
  /** Null means unlimited. */
  pantryLimit: number | null;
  premiumRecipes: boolean;
  highlighted?: boolean;
};

export const PLANS: Record<PlanId, PlanDefinition> = {
  FREE: {
    id: "FREE",
    name: "Taste",
    tagline: "Everything you need to stop wasting food.",
    monthly: 0,
    yearly: 0,
    pantryLimit: 15,
    premiumRecipes: false,
    features: [
      "Track up to 15 pantry items",
      "Unlimited everyday recipe matches",
      "Expiry reminders",
      "Save up to 10 recipes",
    ],
  },
  PLUS: {
    id: "PLUS",
    name: "Plus",
    tagline: "For people who actually cook.",
    monthly: 6,
    yearly: 4,
    pantryLimit: null,
    premiumRecipes: true,
    highlighted: true,
    features: [
      "Unlimited pantry items",
      "The full chef-developed recipe library",
      "Smart weekly meal plans",
      "Shopping lists that skip what you own",
      "Nutrition breakdowns",
    ],
  },
  FAMILY: {
    id: "FAMILY",
    name: "Family",
    tagline: "One kitchen, up to six cooks.",
    monthly: 10,
    yearly: 7,
    pantryLimit: null,
    premiumRecipes: true,
    features: [
      "Everything in Plus",
      "Up to 6 household members",
      "A shared pantry that syncs live",
      "Per-person dietary preferences",
      "Priority support",
    ],
  },
};

export const PLAN_ORDER: PlanId[] = ["FREE", "PLUS", "FAMILY"];

/** Stripe price ids, resolved from env so the same build works in test and live. */
export function priceIdFor(plan: PlanId, interval: "month" | "year"): string | undefined {
  const key = `STRIPE_PRICE_${plan}_${interval === "month" ? "MONTHLY" : "YEARLY"}`;
  return process.env[key];
}

/** Reverse lookup used by the webhook to map a Stripe price back onto a plan. */
export function planForPriceId(priceId: string | null | undefined): PlanId {
  if (!priceId) return "FREE";
  for (const plan of ["PLUS", "FAMILY"] as const) {
    for (const interval of ["month", "year"] as const) {
      if (priceIdFor(plan, interval) === priceId) return plan;
    }
  }
  return "FREE";
}

export function isPaid(plan: Plan | PlanId | undefined | null): boolean {
  return plan === "PLUS" || plan === "FAMILY";
}

export function pantryLimitFor(plan: Plan | PlanId | undefined | null): number | null {
  if (plan === "PLUS" || plan === "FAMILY") return null;
  return PLANS.FREE.pantryLimit;
}
