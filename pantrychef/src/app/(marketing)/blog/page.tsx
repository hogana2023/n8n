import type { Metadata } from "next";
import Link from "next/link";

import { getAllPosts, getCategories, formatDate } from "@/lib/blog";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Journal",
  description:
    "Practical writing on cooking from what you have, wasting less food, and getting dinner on the table faster.",
};

export default function BlogIndexPage({
  searchParams,
}: {
  searchParams: { category?: string };
}) {
  const posts = getAllPosts();
  const categories = getCategories();
  const active = searchParams.category;

  const visible = active ? posts.filter((p) => p.category === active) : posts;
  const [lead, ...rest] = visible;

  return (
    <>
      <section className="pt-20 md:pt-28">
        <div className="shell">
          <div className="max-w-3xl">
            <p className="text-medium font-medium text-herb">Journal</p>
            <h1 className="mt-4 text-[2.5rem] font-semibold leading-[1.08] tracking-[-0.024em] text-ink md:text-h1">
              Notes from the kitchen
            </h1>
            <p className="mt-6 text-large text-pretty text-ink-soft">
              How to cook from what you have, throw away less, and stop deciding
              dinner at six o'clock.
            </p>
          </div>

          {/* Category filter */}
          <nav className="mt-12 flex flex-wrap gap-2" aria-label="Filter by category">
            <Link
              href="/blog"
              className={cn(
                "rounded-full px-4 py-2 text-small transition-colors duration-200",
                !active
                  ? "bg-ink text-white"
                  : "bg-surface-muted text-ink-soft hover:bg-surface-neutral",
              )}
            >
              All
            </Link>
            {categories.map((category) => (
              <Link
                key={category}
                href={`/blog?category=${encodeURIComponent(category)}`}
                className={cn(
                  "rounded-full px-4 py-2 text-small transition-colors duration-200",
                  active === category
                    ? "bg-ink text-white"
                    : "bg-surface-muted text-ink-soft hover:bg-surface-neutral",
                )}
              >
                {category}
              </Link>
            ))}
          </nav>
        </div>
      </section>

      <section className="band pt-12 md:pt-16">
        <div className="shell">
          {visible.length === 0 && (
            <p className="text-medium text-ink-soft">
              Nothing filed under that yet. <Link href="/blog" className="text-accent hover:underline">See everything</Link>.
            </p>
          )}

          {/* Lead article gets the full width. */}
          {lead && (
            <Link href={`/blog/${lead.slug}`} className="group block">
              <div className="grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-14">
                <div
                  className="aspect-[16/10] w-full overflow-hidden rounded-image bg-surface-muted bg-cover bg-center transition-transform duration-500 ease-apple group-hover:scale-[1.01]"
                  style={lead.image ? { backgroundImage: `url(${lead.image})` } : undefined}
                />
                <div>
                  <p className="text-tiny font-medium uppercase tracking-wide text-herb">
                    {lead.category}
                  </p>
                  <h2 className="mt-3 text-[1.9rem] font-semibold leading-[1.12] tracking-[-0.02em] text-ink group-hover:text-accent md:text-h3">
                    {lead.title}
                  </h2>
                  <p className="mt-4 text-medium text-pretty text-ink-soft">
                    {lead.description}
                  </p>
                  <p className="mt-5 text-small text-ink-faint">
                    {lead.author.name} · {formatDate(lead.date)} ·{" "}
                    {lead.readingMinutes} min read
                  </p>
                </div>
              </div>
            </Link>
          )}

          {rest.length > 0 && (
            <div className="mt-20 grid gap-x-8 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
              {rest.map((post) => (
                <Link key={post.slug} href={`/blog/${post.slug}`} className="group flex flex-col">
                  <div
                    className="aspect-[3/2] w-full overflow-hidden rounded-image bg-surface-muted bg-cover bg-center transition-transform duration-500 ease-apple group-hover:scale-[1.02]"
                    style={post.image ? { backgroundImage: `url(${post.image})` } : undefined}
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
          )}
        </div>
      </section>
    </>
  );
}
