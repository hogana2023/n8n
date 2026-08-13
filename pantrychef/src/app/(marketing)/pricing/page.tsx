import type { Metadata } from "next";

import { PricingTable } from "@/components/site/pricing-table";
import { Faq } from "@/components/site/faq";
import { ClosingCta } from "@/components/site/sections";
import { PLANS } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "PantryChef is free for 15 pantry items, forever. Plus and Family lift the limits and open the full chef-developed recipe library.",
};

const COMPARISON: Array<{ label: string; free: string; plus: string; family: string }> = [
  { label: "Pantry items", free: "15", plus: "Unlimited", family: "Unlimited" },
  { label: "Recipe matching", free: "Everyday library", plus: "Full library", family: "Full library" },
  { label: "Expiry reminders", free: "✓", plus: "✓", family: "✓" },
  { label: "Saved recipes", free: "10", plus: "Unlimited", family: "Unlimited" },
  { label: "Weekly meal plans", free: "—", plus: "✓", family: "✓" },
  { label: "Shopping lists", free: "—", plus: "✓", family: "✓" },
  { label: "Nutrition breakdowns", free: "—", plus: "✓", family: "✓" },
  { label: "Household members", free: "1", plus: "1", family: "6" },
  { label: "Shared live pantry", free: "—", plus: "—", family: "✓" },
  { label: "Support", free: "Email", plus: "Email", family: "Priority" },
];

export default function PricingPage() {
  return (
    <>
      <section className="pt-20 md:pt-28">
        <div className="shell">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-medium font-medium text-herb">Pricing</p>
            <h1 className="mt-4 text-[2.5rem] font-semibold leading-[1.08] tracking-[-0.024em] text-ink md:text-h1">
              Pay when it saves you money.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-large text-pretty text-ink-soft">
              Start free and stay free for as long as it suits you. Most people
              upgrade in month two, once the pantry gets past fifteen things.
            </p>
          </div>

          <div className="mt-14">
            <PricingTable />
          </div>
        </div>
      </section>

      {/* Full comparison */}
      <section className="band">
        <div className="shell">
          <h2 className="text-center text-[1.9rem] font-semibold tracking-[-0.02em] text-ink md:text-h3">
            Every difference, side by side
          </h2>

          <div className="mt-12 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-hairline">
                  <th scope="col" className="py-4 pr-4 text-small font-medium text-ink-faint">
                    Feature
                  </th>
                  {(["FREE", "PLUS", "FAMILY"] as const).map((id) => (
                    <th
                      key={id}
                      scope="col"
                      className="px-4 py-4 text-small font-semibold text-ink"
                    >
                      {PLANS[id].name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {COMPARISON.map((row) => (
                  <tr key={row.label}>
                    <th
                      scope="row"
                      className="py-4 pr-4 text-small font-normal text-ink-soft"
                    >
                      {row.label}
                    </th>
                    <td className="px-4 py-4 text-small tabular-nums text-ink">{row.free}</td>
                    <td className="px-4 py-4 text-small tabular-nums text-ink">{row.plus}</td>
                    <td className="px-4 py-4 text-small tabular-nums text-ink">{row.family}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-8 text-center text-tiny text-ink-faint">
            All prices in GBP and include VAT where applicable. Cancel any time
            from your billing page.
          </p>
        </div>
      </section>

      <Faq />
      <ClosingCta />
    </>
  );
}
