import type { Metadata } from "next";
import Link from "next/link";

import { Hero } from "@/components/site/hero";
import {
  ClosingCta,
  Features,
  HowItWorks,
  SectionHeading,
  Stats,
  Testimonials,
} from "@/components/site/sections";
import { Faq } from "@/components/site/faq";
import { PricingTable } from "@/components/site/pricing-table";
import { getAllPosts, formatDate } from "@/lib/blog";

export const metadata: Metadata = {
  title: "PantryChef — Dinner, from what you already have",
  description:
    "Tell PantryChef what's in your kitchen. It finds the meals you can cook right now, tonight, without a shopping trip.",
};

export default function HomePage() {
  const posts = getAllPosts().slice(0, 3);

  return (
    <>
      <Hero />
      <HowItWorks />
      <Features />
      <Stats />
      <Testimonials />

      <section className="band bg-surface-muted">
        <div className="shell">
          <SectionHeading
            eyebrow="Pricing"
            title="Free until your kitchen outgrows it."
            body="Every plan matches recipes against your whole pantry. Paid plans lift the limits and open the full library."
          />
          <div className="mt-4">
            <PricingTable compact />
          </div>
        </div>
      </section>

      {posts.length > 0 && (
        <section className="band bg-white">
          <div className="shell">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <SectionHeading
                align="left"
                eyebrow="Journal"
                title="Notes from the kitchen"
                className="max-w-xl"
              />
              <Link
                href="/blog"
                className="text-small font-medium text-accent hover:underline underline-offset-4"
              >
                All articles ›
              </Link>
            </div>

            <div className="mt-12 grid gap-8 md:grid-cols-3">
              {posts.map((post) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="group flex flex-col"
                >
                  <div
                    className="aspect-[3/2] w-full rounded-image bg-surface-muted bg-cover bg-center transition-transform duration-500 ease-apple group-hover:scale-[1.02]"
                    style={
                      post.image ? { backgroundImage: `url(${post.image})` } : undefined
                    }
                  />
                  <p className="mt-5 text-tiny font-medium uppercase tracking-wide text-herb">
                    {post.category}
                  </p>
                  <h3 className="mt-2 text-h6 font-semibold tracking-tight text-ink group-hover:text-accent">
                    {post.title}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-small text-pretty text-ink-soft">
                    {post.description}
                  </p>
                  <p className="mt-3 text-tiny text-ink-faint">
                    {formatDate(post.date)} · {post.readingMinutes} min read
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <Faq />
      <ClosingCta />
    </>
  );
}
