import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireStripe, siteUrl, stripeConfigured } from "@/lib/stripe";
import { priceIdFor } from "@/lib/plans";

const schema = z.object({
  plan: z.enum(["PLUS", "FAMILY"]),
  interval: z.enum(["month", "year"]).default("year"),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "You need to be logged in." }, { status: 401 });
  }

  if (!stripeConfigured()) {
    return NextResponse.json(
      { error: "Payments aren't configured on this deployment yet." },
      { status: 503 },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Pick a valid plan." }, { status: 400 });
  }

  const { plan, interval } = parsed.data;
  const priceId = priceIdFor(plan, interval);
  if (!priceId) {
    return NextResponse.json(
      { error: `No Stripe price configured for ${plan} / ${interval}.` },
      { status: 500 },
    );
  }

  const stripe = requireStripe();

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, stripeCustomerId: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  // Reuse the customer so a second subscription doesn't fork the billing history.
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name ?? undefined,
      metadata: { userId: user.id },
    });
    customerId = customer.id;
    await prisma.user.update({
      where: { id: user.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    success_url: siteUrl("/app/billing?checkout=success"),
    cancel_url: siteUrl("/pricing?checkout=cancelled"),
    // The webhook reads these to attribute the subscription without a lookup.
    subscription_data: { metadata: { userId: user.id, plan } },
    metadata: { userId: user.id, plan },
  });

  if (!checkout.url) {
    return NextResponse.json({ error: "Stripe did not return a URL." }, { status: 502 });
  }

  return NextResponse.json({ url: checkout.url });
}
