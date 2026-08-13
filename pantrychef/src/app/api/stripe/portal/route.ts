import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireStripe, siteUrl, stripeConfigured } from "@/lib/stripe";

/** Opens Stripe's hosted billing portal so cancellation never needs our own UI. */
export async function POST() {
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

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { stripeCustomerId: true },
  });

  if (!user?.stripeCustomerId) {
    return NextResponse.json(
      { error: "You don't have a billing account yet." },
      { status: 400 },
    );
  }

  const portal = await requireStripe().billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: siteUrl("/app/billing"),
  });

  return NextResponse.json({ url: portal.url });
}
