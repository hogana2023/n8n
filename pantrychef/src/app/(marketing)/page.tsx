import type { Metadata } from "next";
import Link from "next/link";

import { Hero } from "@/components/site/hero";
import {
  ClosingCta,
  Cookbooks,
  Modes,
  PantryPup,
  PhotoFlow,
  SectionHeading,
} from "@/components/site/sections";
import { Faq } from "@/components/site/faq";
import { getAllPosts, formatDate } from "@/lib/blog";

export const metadata: Metadata = {
  title: "PantryChef — AI recipes from what's already in your kitchen",
  description:
    "Tell PantryChef what you have, or photograph your fridge. It writes recipes around it, in your cuisines and inside your dietary requirements. Leftovers, air fryer, and pet food too.",
};

export default function HomePage() {
  const posts = getAllPosts().slice(0, 2);

  return (
    <>
      <Hero />
      <Modes />
      <PhotoFlow />
      <PantryPup />
      <Cookbooks />

      {posts.length > 0 && (
        <section className="band bg-white">
          <div className="shell">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <SectionHeading eyebrow="Journal" title="Notes from the kitchen" />
              <Link
                href="/blog"
                className="text-small font-medium text-accent hover:underline underline-offset-4"
              >
                All articles ›
              </Link>
            </div>

            <div className="mt-12 grid gap-10 md:grid-cols-2">
              {posts.map((post) => (
                <Link key={post.slug} href={`/blog/${post.slug}`} className="group">
                  <p className="text-tiny font-medium uppercase tracking-wide text-herb">
                    {post.category}
                  </p>
                  <h3 className="mt-2 text-h5 font-semibold tracking-tight text-ink group-hover:text-accent">
                    {post.title}
                  </h3>
                  <p className="mt-2 text-regular text-pretty text-ink-soft">
                    {post.description}
                  </p>
                  <p className="mt-3 text-small text-ink-faint">
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
