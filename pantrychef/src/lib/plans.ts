import type { Plan } from "@prisma/client";

export type PlanId = "FREE" | "PLUS" | "FAMILY";

export type PlanDefinition = {
  id: PlanId;
  name: string;
  tagline: string;
  monthly: number;
  yearly: number;
  features: string[];
  /** Pantry items trackable at once. Null = unlimited. */
  pantryLimit: number | null;
  /** Recipe generations per day. Null = unlimited. */
  dailyGenerations: number | null;
  photoScan: boolean;
  mealPlans: boolean;
  petFood: boolean;
  highlighted?: boolean;
};

export const PLANS: Record<PlanId, PlanDefinition> = {
  FREE: {
    id: "FREE",
    name: "Taster",
    tagline: "Enough to see whether it changes how you cook.",
    monthly: 0,
    yearly: 0,
    pantryLimit: 20,
    dailyGenerations: 3,
    photoScan: false,
    mealPlans: false,
    petFood: false,
    features: [
      "3 recipe generations a day",
      "Track up to 20 ingredients",
      "Leftovers and appliance modes",
      "Save any recipe you like",
    ],
  },
  PLUS: {
    id: "PLUS",
    name: "Plus",
    tagline: "For the person who actually cooks most nights.",
    monthly: 7,
    yearly: 5,
    pantryLimit: null,
    dailyGenerations: null,
    photoScan: true,
    mealPlans: true,
    petFood: true,
    highlighted: true,
    features: [
      "Unlimited recipe generation",
      "Photograph your fridge instead of typing it",
      "Weekly meal plans and shopping lists",
      "PantryPup pet food recipes",
      "Unlimited pantry, nutrition on every recipe",
    ],
  },
  FAMILY: {
    id: "FAMILY",
    name: "Household",
    tagline: "One kitchen, up to six people, everyone's requirements.",
    monthly: 12,
    yearly: 9,
    pantryLimit: null,
    dailyGenerations: null,
    photoScan: true,
    mealPlans: true,
    petFood: true,
    features: [
      "Everything in Plus",
      "Up to 6 household members",
      "A shared pantry that syncs",
      "Per-person dietary requirements applied at once",
      "20% off every cookbook",
    ],
  },
};

export const PLAN_ORDER: PlanId[] = ["FREE", "PLUS", "FAMILY"];

export function priceIdFor(plan: PlanId, interval: "month" | "year"): string | undefined {
  const key = `STRIPE_PRICE_${plan}_${interval === "month" ? "MONTHLY" : "YEARLY"}`;
  return process.env[key];
}

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

export function planOf(plan: Plan | PlanId | undefined | null): PlanDefinition {
  return PLANS[(plan as PlanId) ?? "FREE"] ?? PLANS.FREE;
}

export function pantryLimitFor(plan: Plan | PlanId | undefined | null): number | null {
  return planOf(plan).pantryLimit;
}

/** Household plans get a standing discount on one-time cookbook purchases. */
export function cookbookDiscountFor(plan: Plan | PlanId | undefined | null): number {
  return plan === "FAMILY" ? 0.2 : 0;
}

export function formatPence(pence: number): string {
  return `£${(pence / 100).toFixed(2).replace(/\.00$/, "")}`;
}
