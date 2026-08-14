import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { prisma } from "@/lib/prisma";
import { requireStripe } from "@/lib/stripe";
import { planForPriceId } from "@/lib/plans";

// Signature verification needs the exact bytes Stripe signed, so this route
// must never be statically optimised or have its body parsed early.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RELEVANT = new Set<Stripe.Event["type"]>([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
]);

/** Push a subscription's current state onto the user record. */
async function syncSubscription(subscription: Stripe.Subscription) {
  const priceId = subscription.items.data[0]?.price.id ?? null;

  // Only these two states grant access. `past_due` deliberately does not —
  // Stripe keeps retrying, and the user drops to free until it clears.
  const entitled =
    subscription.status === "active" || subscription.status === "trialing";

  const plan = entitled ? planForPriceId(priceId) : "FREE";

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  // Prefer the metadata we set at checkout; fall back to the customer id so a
  // subscription created in the Stripe dashboard still lands on the right user.
  const userId = subscription.metadata?.userId;
  const where = userId ? { id: userId } : { stripeCustomerId: customerId };

  const user = await prisma.user.findFirst({ where });
  if (!user) {
    console.warn("[stripe] no user for subscription", subscription.id);
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      plan,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
  });
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook secret not set." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = requireStripe().webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    // An unverified body is either misconfiguration or someone poking the
    // endpoint; either way it must never reach the handlers below.
    const message = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ error: `Invalid signature: ${message}` }, { status: 400 });
  }

  if (!RELEVANT.has(event.type)) {
    return NextResponse.json({ received: true, ignored: event.type });
  }

  const stripe = requireStripe();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;

        // One-time cookbook purchase — a different flow from subscriptions.
        if (session.mode === "payment" && session.metadata?.kind === "cookbook") {
          const { userId, cookbookId } = session.metadata;
          if (!userId || !cookbookId) {
            console.warn("[stripe] cookbook checkout missing metadata", session.id);
            break;
          }
          // Stripe retries webhooks, so this must be idempotent.
          await prisma.cookbookPurchase.upsert({
            where: { userId_cookbookId: { userId, cookbookId } },
            create: {
              userId,
              cookbookId,
              stripeCheckoutSession: session.id,
              amountPence: session.amount_total ?? 0,
            },
            update: {},
          });
          break;
        }

        if (session.mode !== "subscription" || !session.subscription) break;

        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id;

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        // Checkout metadata is the most reliable link back to our user.
        if (session.metadata?.userId && !subscription.metadata?.userId) {
          subscription.metadata = {
            ...subscription.metadata,
            userId: session.metadata.userId,
          };
        }
        await syncSubscription(subscription);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await syncSubscription(event.data.object);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        console.warn("[stripe] payment failed for customer", invoice.customer);
        // Stripe's dunning emails handle the chase; the subsequent
        // subscription.updated event is what actually revokes access.
        break;
      }
    }
  } catch (err) {
    // Returning 500 makes Stripe retry, which is what we want for a transient
    // database failure.
    console.error("[stripe] handler failed", event.type, err);
    return NextResponse.json({ error: "Handler failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
