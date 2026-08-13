"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SectionHeading } from "@/components/site/sections";

const QUESTIONS = [
  {
    q: "Do I have to enter everything in my kitchen?",
    a: "No. Start with the ten things you actually cook with and PantryChef is already useful. Most people add the rest over a couple of weeks, whenever they unpack a shop.",
  },
  {
    q: "What happens when the free plan's 15 items run out?",
    a: "Nothing breaks. You keep every feature and every recipe match on the free plan — you just can't track more than 15 items at once. Remove one to add another, or move to Plus for unlimited.",
  },
  {
    q: "Can it handle allergies and diets?",
    a: "Yes. Set them once and anything containing an excluded ingredient never appears, including in weekly plans and shopping lists. Family plans hold a separate profile per person.",
  },
  {
    q: "Does it work if I don't measure anything?",
    a: "That's the assumption it's built on. Quantities are optional everywhere. 'Some rice' is a valid pantry entry and matches every recipe that wants rice.",
  },
  {
    q: "Can I cancel whenever I want?",
    a: "Any time, from the billing page, in two clicks. You keep paid features until the end of the period you've already paid for, then drop to free. Nothing is deleted.",
  },
  {
    q: "Is my data used to train anything?",
    a: "No. Your pantry and cooking history are yours. We don't sell them, and we don't feed them to third-party models.",
  },
];

export function Faq() {
  return (
    <section className="band bg-white">
      <div className="shell">
        <SectionHeading eyebrow="Questions" title="Before you start" />

        <div className="mx-auto mt-14 max-w-3xl">
          <Accordion type="multiple" className="divide-y divide-hairline border-y border-hairline">
            {QUESTIONS.map((item, i) => (
              <AccordionItem key={item.q} value={`item-${i}`} className="border-none">
                <AccordionTrigger className="py-6 text-left text-medium font-semibold tracking-tight text-ink hover:no-underline md:text-h6">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="pb-6 pr-8 text-regular text-pretty text-ink-soft">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
