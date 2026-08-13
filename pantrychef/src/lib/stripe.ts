import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;

/**
 * Stripe is optional at build time so `next build` works without secrets in
 * CI. Anything that actually talks to Stripe calls requireStripe() and fails
 * loudly at request time instead.
 */
export const stripe = key
  ? new Stripe(key, { apiVersion: "2025-02-24.acacia", typescript: true })
  : null;

export function requireStripe(): Stripe {
  if (!stripe) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add it to .env.local — see README.md.",
    );
  }
  return stripe;
}

export function stripeConfigured(): boolean {
  return Boolean(key);
}

/** Absolute origin for Stripe redirect URLs. */
export function siteUrl(path = ""): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
  return `${base}${path}`;
}
