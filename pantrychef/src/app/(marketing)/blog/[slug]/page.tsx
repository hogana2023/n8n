import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";

import { getPost, getPostSlugs, getRelatedPosts, formatDate } from "@/lib/blog";

type Params = { params: { slug: string } };

export function generateStaticParams() {
  return getPostSlugs().map((slug) => ({ slug }));
}

export function generateMetadata({ params }: Params): Metadata {
  const post = getPost(params.slug);
  if (!post) return { title: "Not found" };

  return {
    title: post.title,
    description: post.description,
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      publishedTime: post.date,
      images: post.image ? [post.image] : undefined,
    },
  };
}

export default function BlogPostPage({ params }: Params) {
  const post = getPost(params.slug);
  if (!post) notFound();

  const related = getRelatedPosts(post.slug);

  return (
    <>
      <article>
        <header className="pt-16 md:pt-24">
          <div className="shell">
            <Link
              href="/blog"
              className="text-small text-ink-faint transition-colors hover:text-ink"
            >
              ‹ Journal
            </Link>

            <div className="mx-auto mt-8 max-w-prose">
              <p className="text-tiny font-medium uppercase tracking-wide text-herb">
                {post.category}
              </p>
              <h1 className="mt-4 text-[2.25rem] font-semibold leading-[1.1] tracking-[-0.022em] text-ink md:text-h2">
                {post.title}
              </h1>
              <p className="mt-5 text-large text-pretty text-ink-soft">
                {post.description}
              </p>

              <div className="mt-8 flex items-center gap-4 border-t border-hairline pt-8">
                <div
                  aria-hidden
                  className="size-11 shrink-0 rounded-full bg-surface-muted bg-cover bg-center"
                  style={
                    post.author.avatar
                      ? { backgroundImage: `url(${post.author.avatar})` }
                      : undefined
                  }
                />
                <div>
                  <p className="text-small font-semibold text-ink">
                    {post.author.name}
                  </p>
                  <p className="text-small text-ink-faint">
                    {formatDate(post.date)} · {post.readingMinutes} min read
                  </p>
                </div>
              </div>
            </div>
          </div>

          {post.image && (
            <div className="shell mt-12">
              <div
                className="aspect-[16/9] w-full rounded-image bg-surface-muted bg-cover bg-center"
                style={{ backgroundImage: `url(${post.image})` }}
              />
            </div>
          )}
        </header>

        <div className="shell py-16 md:py-20">
          <div className="prose-pc mx-auto max-w-prose">
            <MDXRemote
              source={post.content}
              options={{
                mdxOptions: {
                  remarkPlugins: [remarkGfm],
                  rehypePlugins: [rehypeSlug],
                },
              }}
            />
          </div>
        </div>
      </article>

      {/* Conversion rail at the end of every article. */}
      <section className="border-y border-hairline bg-surface-muted py-16">
        <div className="shell">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
            <div className="flex-1">
              <h2 className="text-h5 font-semibold tracking-tight text-ink">
                Cook this from what you already have
              </h2>
              <p className="mt-2 text-regular text-pretty text-ink-soft">
                PantryChef matches every recipe against your own kitchen. Free
                for your first 15 ingredients.
              </p>
            </div>
            <Link href="/signup" className="btn-primary shrink-0">
              Start free
            </Link>
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="band">
          <div className="shell">
            <h2 className="text-h4 font-semibold tracking-tight text-ink">
              Keep reading
            </h2>
            <div className="mt-10 grid gap-8 md:grid-cols-3">
              {related.map((item) => (
                <Link key={item.slug} href={`/blog/${item.slug}`} className="group">
                  <div
                    className="aspect-[3/2] w-full rounded-image bg-surface-muted bg-cover bg-center transition-transform duration-500 ease-apple group-hover:scale-[1.02]"
                    style={item.image ? { backgroundImage: `url(${item.image})` } : undefined}
                  />
                  <h3 className="mt-4 text-h6 font-semibold tracking-tight text-ink group-hover:text-accent">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-tiny text-ink-faint">
                    {formatDate(item.date)} · {item.readingMinutes} min read
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
