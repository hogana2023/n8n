import type { Metadata } from "next";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PLANS, isPaid, type PlanId } from "@/lib/plans";
import { stripeConfigured } from "@/lib/stripe";
import { BillingActions } from "@/components/app/billing-actions";
import { PricingTable } from "@/components/site/pricing-table";

export const metadata: Metadata = { title: "Billing" };
export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: { checkout?: string; locked?: string };
}) {
  const session = await getServerSession(authOptions);
  const plan = session!.user.plan as PlanId;

  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: { stripeCurrentPeriodEnd: true, stripeCustomerId: true },
  });

  const paid = isPaid(plan);

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-8">
        <h1 className="text-h3 font-semibold tracking-tight text-ink">Billing</h1>
        <p className="mt-2 text-regular text-ink-soft">
          Manage your plan, payment method and invoices.
        </p>
      </header>

      {searchParams.checkout === "success" && (
        <p className="mb-6 rounded-form bg-herb-soft px-4 py-3 text-small text-herb">
          Payment received. Your plan is active. If it still says Free below,
          give the webhook a few seconds and refresh.
        </p>
      )}

      {searchParams.locked && (
        <p className="mb-6 rounded-form bg-accent-quiet px-4 py-3 text-small text-ink">
          That recipe is part of the Plus library. Upgrade below to open it.
        </p>
      )}

      {!stripeConfigured() && (
        <p className="mb-6 rounded-form bg-[#fff4e5] px-4 py-3 text-small text-[#8a5a00]">
          Stripe keys aren't set on this deployment, so checkout is disabled.
          See <code className="font-mono">README.md</code> for the four
          environment variables it needs.
        </p>
      )}

      <section className="rounded-card bg-white p-8 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-tiny font-medium uppercase tracking-wide text-ink-faint">
              Current plan
            </p>
            <h2 className="mt-2 text-h4 font-semibold tracking-tight text-ink">
              {PLANS[plan].name}
            </h2>
            <p className="mt-2 text-regular text-ink-soft">{PLANS[plan].tagline}</p>

            {paid && user?.stripeCurrentPeriodEnd && (
              <p className="mt-4 text-small text-ink-faint">
                Renews{" "}
                {user.stripeCurrentPeriodEnd.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
                .
              </p>
            )}
          </div>

          <BillingActions
            hasBillingAccount={Boolean(user?.stripeCustomerId)}
            stripeReady={stripeConfigured()}
          />
        </div>
      </section>

      {!paid && (
        <section className="mt-12">
          <h2 className="text-h5 font-semibold tracking-tight text-ink">
            Upgrade your kitchen
          </h2>
          <div className="mt-6">
            <PricingTable compact />
          </div>
        </section>
      )}
    </div>
  );
}
