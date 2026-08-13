import fs from "node:fs";
import path from "node:path";

import matter from "gray-matter";

const BLOG_DIR = path.join(process.cwd(), "content", "blog");

export type PostMeta = {
  slug: string;
  title: string;
  description: string;
  date: string;
  readingMinutes: number;
  category: string;
  author: { name: string; role: string; avatar: string };
  image: string;
  featured?: boolean;
};

export type Post = PostMeta & { content: string };

function readPostFile(fileName: string): Post {
  const slug = fileName.replace(/\.mdx?$/, "");
  const raw = fs.readFileSync(path.join(BLOG_DIR, fileName), "utf8");
  const { data, content } = matter(raw);

  // ~200 wpm is the usual comfortable-reading figure; round up so a 30-second
  // read never displays as "0 min".
  const words = content.trim().split(/\s+/).length;
  const readingMinutes = Math.max(1, Math.round(words / 200));

  return {
    slug,
    title: data.title ?? slug,
    description: data.description ?? "",
    date: data.date ? new Date(data.date).toISOString() : new Date().toISOString(),
    category: data.category ?? "Kitchen notes",
    author: data.author ?? { name: "The PantryChef team", role: "Editorial", avatar: "" },
    image: data.image ?? "",
    featured: data.featured ?? false,
    readingMinutes,
    content,
  };
}

export function getAllPosts(): Post[] {
  if (!fs.existsSync(BLOG_DIR)) return [];

  return fs
    .readdirSync(BLOG_DIR)
    .filter((file) => /\.mdx?$/.test(file))
    .map(readPostFile)
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));
}

export function getPostSlugs(): string[] {
  return getAllPosts().map((post) => post.slug);
}

export function getPost(slug: string): Post | null {
  return getAllPosts().find((post) => post.slug === slug) ?? null;
}

export function getCategories(): string[] {
  return [...new Set(getAllPosts().map((post) => post.category))].sort();
}

/** Posts sharing a category, excluding the one being read. */
export function getRelatedPosts(slug: string, take = 3): Post[] {
  const current = getPost(slug);
  if (!current) return [];

  const posts = getAllPosts().filter((post) => post.slug !== slug);
  const sameCategory = posts.filter((post) => post.category === current.category);

  return [...sameCategory, ...posts.filter((p) => p.category !== current.category)].slice(
    0,
    take,
  );
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
