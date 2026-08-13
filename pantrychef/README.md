# PantryChef

A self-hostable rebuild of PantryChef: a marketing site, a blog, user accounts,
and a working recipe-matching app, with Stripe subscriptions gating the paid
tier.

Built with Next.js 14 (App Router), Postgres via Prisma, Auth.js, MDX, and a
component layer vendored from the Relume React library.

---

## Quick start

```bash
cp .env.example .env.local     # then fill in DATABASE_URL and NEXTAUTH_SECRET
npm install
npx prisma db push             # create the tables
npm run db:seed                # load the 8 starter recipes
npm run dev                    # http://localhost:3000
```

The only two variables you need to get the app running are `DATABASE_URL` and
`NEXTAUTH_SECRET`. Stripe and Google OAuth are both optional and degrade
gracefully when unset: checkout returns a clear "payments aren't configured"
message rather than crashing, and the Google button simply doesn't render.

Generate a secret with:

```bash
openssl rand -base64 32
```

---

## What's in it

### Marketing site
- `/` — hero with a **live, working demo**: toggle ingredients and the recipe
  matches re-rank in the browser, no account needed.
- `/pricing` — three tiers, monthly/yearly toggle, full comparison table.
- `/legal/privacy`, `/legal/terms` — placeholder copy. **Replace these before
  taking real payments.**

### Blog
Filesystem-based, no CMS. Drop an `.mdx` file in `content/blog/` and it appears,
with reading time computed from word count and pages statically generated at
build.

Front matter:

```yaml
---
title: "Your title"
description: "One-line summary for cards and meta tags"
date: "2026-07-28"
category: "Cooking"
image: "https://…"
author:
  name: "Name"
  role: "Role"
  avatar: "https://…"
---
```

Note: the parent n8n repo's `.gitignore` ignores `*.mdx` globally. This app's
own `.gitignore` re-includes them, so posts stay tracked.

### User section
- Email + password via Auth.js credentials, bcrypt at cost 12.
- Google OAuth wired but inactive until you add credentials.
- `/app` — tonight's matches, use-first expiry rail, "buy one thing" suggestions.
- `/app/pantry` — add/remove ingredients, optional use-by dates, optimistic UI.
- `/app/recipes` — full ranked library, filterable to cook-right-now.
- `/app/billing` — plan state and a link into Stripe's hosted portal.

Everything under `/app` is guarded twice: by middleware, and again server-side
in the layout.

### Recipe matching
Deliberately simple arithmetic rather than a model, because a suggestion you
can't explain is one users won't trust. See `src/lib/recipes.ts`:

1. Drop staples (salt, oil, pepper) from the recipe's requirements.
2. Coverage = what you have / what's needed.
3. Penalty of 6 points per missing ingredient past the first, so "one quick
   stop" recipes outrank "a whole shop" ones at equal coverage.
4. Sort: cookable-now first, then score, then cooking time.

Free-text normalisation lives in `src/lib/ingredients.ts` — a synonym table and
singularisation rules that map "2 ripe Roma tomatoes", "chopped tomatoes" and
"passata" onto one key, while keeping "spring onion" distinct from "onion".

---

## Stripe

Payments work end to end once four variables are set. Until then the app runs
fine and checkout is disabled with a visible notice.

**1. Create the prices.** In the Stripe dashboard create two products (Plus,
Family) with two recurring prices each, monthly and yearly. Copy the four
`price_…` ids into `.env.local`.

**2. Set the keys.**

```
STRIPE_SECRET_KEY=sk_test_…
STRIPE_WEBHOOK_SECRET=whsec_…
STRIPE_PRICE_PLUS_MONTHLY=price_…
STRIPE_PRICE_PLUS_YEARLY=price_…
STRIPE_PRICE_FAMILY_MONTHLY=price_…
STRIPE_PRICE_FAMILY_YEARLY=price_…
```

**3. Forward webhooks locally.**

```bash
npm run stripe:listen
```

Test with card `4242 4242 4242 4242`, any future expiry, any CVC.

### How entitlement works
The webhook at `/api/stripe/webhook` is the single source of truth. It verifies
the signature against the raw body, then writes `plan` onto the user record.

Only `active` and `trialing` subscriptions grant access. `past_due` deliberately
does not — Stripe keeps retrying, and the user sits on free until it clears.
Cancellation flows through `customer.subscription.deleted` and drops them back
to free without deleting any data.

Gating is enforced server-side. A premium recipe redirects a free user to
billing even if they type the URL directly; hiding the link would not be enough.

---

## Deploying

It's a standard Next.js app with a Postgres dependency, so anything that runs
Node 18+ works: your own VPS with Docker, Railway, Fly, Render, or Vercel.

Whatever you pick:

1. Set every variable from `.env.example` in the host's environment.
2. Set `NEXT_PUBLIC_SITE_URL` and `NEXTAUTH_URL` to the real public origin, no
   trailing slash. Stripe redirects break silently if these are wrong.
3. Run `npx prisma migrate deploy` (or `db push`) against the production
   database, then `npm run db:seed` once.
4. Point a Stripe webhook endpoint at `https://yourdomain/api/stripe/webhook`
   and put *that* endpoint's signing secret in `STRIPE_WEBHOOK_SECRET`. It is
   different from the CLI one.

`npm run build` runs `prisma generate` first, so a clean clone builds without a
database connection.

---

## Design notes

The look is Apple's, applied over Relume's component library.

Relume components are vendored shadcn-style into `src/components/ui/` — you own
the files, there's no `@relume_io/relume-ui` runtime dependency. They ship with
sharp 0px corners, hard borders and a 16px type base, none of which is Apple.
The overrides live in two places:

- **`tailwind.config.js`** — the type ramp (larger, tighter tracking, negative
  letter-spacing), pill button radii, Apple's actual system greys (`#1d1d1f`,
  `#f5f5f7`, `#0071e3`) rather than generic Tailwind slate, and soft wide
  shadows instead of drop shadows.
- **`src/components/ui/button.tsx`** — variants restyled to filled pills with a
  press-scale, replacing Relume's bordered dark rectangles.

Sections in `src/components/site/` were composed against Relume's structures
(Navbar 1, Header 147, Layout 534/639, Pricing 43, FAQ 1, Footer 1, Blog 40,
Sign Up 8 / Log In 8, Application Shell 8) and rebuilt to carry the Apple
rhythm: generous vertical bands, centered display type, translucent blurred
nav, and a single soft colour wash rather than hard-edged coloured sections.

### A note on the typeface
The font stack is `-apple-system, SF Pro Display, Inter, …`. On Apple hardware
this renders in SF Pro, which is what makes the design read as Apple, and it
costs no font request. On Windows and Android it falls back to Segoe UI and
Roboto, which are close on metrics but visibly not the same.

If you want it consistent everywhere, self-host Inter and put it first in
`fontFamily.sans` in `tailwind.config.js`. Doing that via `next/font` keeps it
a local request with no layout shift.

---

## Verified

Built and exercised in a browser against a real Postgres instance:

- All 22 routes build; production build clean, typecheck clean.
- Signup → session → `/app` works; pantry add/remove persists.
- With 6 ingredients stocked, matching returned 7 ranked recipes and correctly
  reported "1 meal you can cook right now".
- The premium recipe redirected a free user to `/app/billing` when hit directly.
- The homepage demo re-ranked live on ingredient toggle (1 → 2 ready).

**Not verified:** a live Stripe transaction. That needs real API keys, which
aren't in this repo. The code paths are complete but the money has not moved.
Run `npm run stripe:listen` with test keys and put a card through before you
trust it in production.
