import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireStripe, siteUrl, stripeConfigured } from "@/lib/stripe";
import { cookbookDiscountFor, type PlanId } from "@/lib/plans";

const schema = z.object({ slug: z.string().trim().min(1) });

/** One-time checkout for a cookbook, separate from the subscription flow. */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Log in to buy a cookbook." }, { status: 401 });
  }

  if (!stripeConfigured()) {
    return NextResponse.json(
      { error: "Payments aren't configured on this deployment yet." },
      { status: 503 },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Pick a cookbook." }, { status: 400 });
  }

  const cookbook = await prisma.cookbook.findUnique({
    where: { slug: parsed.data.slug },
  });
  if (!cookbook?.published) {
    return NextResponse.json({ error: "That cookbook isn't available." }, { status: 404 });
  }

  const already = await prisma.cookbookPurchase.findUnique({
    where: { userId_cookbookId: { userId: session.user.id, cookbookId: cookbook.id } },
  });
  if (already) {
    return NextResponse.json(
      { error: "You already own this one.", code: "OWNED" },
      { status: 409 },
    );
  }

  const stripe = requireStripe();

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, stripeCustomerId: true },
  });
  if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name ?? undefined,
      metadata: { userId: user.id },
    });
    customerId = customer.id;
    await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
  }

  const discount = cookbookDiscountFor(session.user.plan as PlanId);
  const amount = Math.round(cookbook.pricePence * (1 - discount));

  const checkout = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    // Priced inline rather than by price id, so the household discount can be
    // applied without maintaining a second Stripe price per cookbook.
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "gbp",
          unit_amount: amount,
          product_data: {
            name: cookbook.title,
            description: cookbook.subtitle,
          },
        },
      },
    ],
    success_url: siteUrl(`/app/cookbooks/${cookbook.slug}?purchase=success`),
    cancel_url: siteUrl(`/app/cookbooks/${cookbook.slug}?purchase=cancelled`),
    metadata: {
      userId: user.id,
      cookbookId: cookbook.id,
      kind: "cookbook",
    },
  });

  if (!checkout.url) {
    return NextResponse.json({ error: "Stripe did not return a URL." }, { status: 502 });
  }

  return NextResponse.json({ url: checkout.url });
}
