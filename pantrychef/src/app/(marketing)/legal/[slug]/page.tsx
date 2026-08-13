import type { Metadata } from "next";
import { notFound } from "next/navigation";

const DOCS: Record<string, { title: string; body: string[] }> = {
  privacy: {
    title: "Privacy",
    body: [
      "This is placeholder text. Replace it before you take real payments.",
      "PantryChef stores the account details you give us (name, email, password hash) and the pantry contents you enter. We use them to match recipes and nothing else.",
      "We do not sell your data, and we do not use your pantry or cooking history to train machine learning models.",
      "Payment details are handled entirely by Stripe. We never see or store a card number.",
      "You can delete your account and everything attached to it from the billing page at any time.",
    ],
  },
  terms: {
    title: "Terms",
    body: [
      "This is placeholder text. Replace it before you take real payments.",
      "PantryChef is provided as-is. Recipe suggestions are suggestions, and you are responsible for checking that food is safe to eat and suitable for any allergies in your household.",
      "Subscriptions renew automatically until cancelled. You can cancel at any time from the billing page and keep access until the end of the period you have paid for.",
      "We may change these terms, and we will tell you by email before any change that affects what you pay.",
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(DOCS).map((slug) => ({ slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const doc = DOCS[params.slug];
  return doc ? { title: doc.title } : { title: "Not found" };
}

export default function LegalPage({ params }: { params: { slug: string } }) {
  const doc = DOCS[params.slug];
  if (!doc) notFound();

  return (
    <section className="band">
      <div className="shell">
        <div className="mx-auto max-w-prose">
          <h1 className="text-h2 font-semibold tracking-tight text-ink">{doc.title}</h1>
          <div className="prose-pc mt-10">
            {doc.body.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
