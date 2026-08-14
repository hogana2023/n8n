import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

/**
 * Every call into Claude that PantryChef makes.
 *
 * Two things are deliberate here:
 *  - Structured outputs rather than "reply with JSON" prompting, so a recipe
 *    either validates against the schema or fails loudly.
 *  - Server-side fallbacks, so a safety-classifier decline on one model is
 *    retried rather than surfacing to someone who just wanted dinner.
 */

const MODEL = "claude-opus-5";

const apiKey = process.env.ANTHROPIC_API_KEY;

export const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

export function aiConfigured(): boolean {
  return Boolean(apiKey);
}

function requireClient(): Anthropic {
  if (!anthropic) {
    throw new AiError(
      "Recipe generation isn't configured on this deployment. Set ANTHROPIC_API_KEY.",
      "NOT_CONFIGURED",
    );
  }
  return anthropic;
}

export class AiError extends Error {
  code: "NOT_CONFIGURED" | "REFUSED" | "INVALID_OUTPUT" | "UPSTREAM";
  constructor(message: string, code: AiError["code"]) {
    super(message);
    this.name = "AiError";
    this.code = code;
  }
}

/* -------------------------------------------------------------------------- */
/* Schemas                                                                    */
/* -------------------------------------------------------------------------- */

const ingredientSchema = z.object({
  item: z.string(),
  amount: z.string(),
  /** True when the cook already has it, per the pantry we passed in. */
  have: z.boolean(),
});

const recipeSchema = z.object({
  title: z.string(),
  summary: z.string(),
  minutes: z.number(),
  servings: z.number(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  cuisine: z.string(),
  appliance: z.string().nullable(),
  dietary: z.array(z.string()),
  ingredients: z.array(ingredientSchema),
  steps: z.array(z.string()),
  tips: z.array(z.string()),
  nutrition: z.object({
    calories: z.number(),
    protein: z.number(),
    carbs: z.number(),
    fat: z.number(),
  }),
});

const recipesSchema = z.object({ recipes: z.array(recipeSchema) });

export type GeneratedRecipe = z.infer<typeof recipeSchema>;

/**
 * The JSON Schema handed to the API. Written by hand rather than derived, so
 * the exact shape the model is constrained to is visible in one place.
 * Structured outputs require `additionalProperties: false` and full `required`.
 */
const RECIPE_JSON_SCHEMA = {
  type: "object",
  properties: {
    recipes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string", description: "Plain, appetising, no marketing adjectives." },
          summary: { type: "string", description: "One or two sentences on what it is and why it works." },
          minutes: { type: "integer", description: "Total time from starting to plating." },
          servings: { type: "integer" },
          difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
          cuisine: { type: "string" },
          appliance: {
            type: ["string", "null"],
            description: "air-fryer, instant-pot, slow-cooker, oven, hob, or null.",
          },
          dietary: {
            type: "array",
            items: { type: "string" },
            description: "Only tags this recipe genuinely satisfies.",
          },
          ingredients: {
            type: "array",
            items: {
              type: "object",
              properties: {
                item: { type: "string" },
                amount: { type: "string" },
                have: { type: "boolean", description: "True only if it appears in the cook's pantry list." },
              },
              required: ["item", "amount", "have"],
              additionalProperties: false,
            },
          },
          steps: { type: "array", items: { type: "string" } },
          tips: { type: "array", items: { type: "string" } },
          nutrition: {
            type: "object",
            properties: {
              calories: { type: "integer" },
              protein: { type: "integer" },
              carbs: { type: "integer" },
              fat: { type: "integer" },
            },
            required: ["calories", "protein", "carbs", "fat"],
            additionalProperties: false,
          },
        },
        required: [
          "title", "summary", "minutes", "servings", "difficulty", "cuisine",
          "appliance", "dietary", "ingredients", "steps", "tips", "nutrition",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["recipes"],
  additionalProperties: false,
} as const;

/* -------------------------------------------------------------------------- */
/* Shared request plumbing                                                    */
/* -------------------------------------------------------------------------- */

type Block = Anthropic.Beta.BetaContentBlockParam;

async function structuredCall<T>(args: {
  system: string;
  content: Block[];
  schema: Record<string, unknown>;
  validate: (raw: unknown) => T;
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
}): Promise<T> {
  const client = requireClient();

  let response;
  try {
    response = await client.beta.messages.create({
      model: MODEL,
      // Thinking is on by default on this model and counts against max_tokens,
      // so the ceiling has to leave room for both reasoning and the recipe.
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        effort: args.effort ?? "medium",
        format: { type: "json_schema", schema: args.schema },
      },
      system: args.system,
      messages: [{ role: "user", content: args.content }],
    } as Anthropic.Beta.MessageCreateParamsNonStreaming);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown upstream error.";
    throw new AiError(`The recipe service failed: ${message}`, "UPSTREAM");
  }

  // Always check stop_reason before touching content — a refusal returns 200
  // with an empty or partial content array.
  if (response.stop_reason === "refusal") {
    throw new AiError(
      "The model declined this request. Try rephrasing what you're asking for.",
      "REFUSED",
    );
  }

  const text = response.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  if (!text.trim()) {
    throw new AiError("The model returned nothing usable.", "INVALID_OUTPUT");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AiError("The model returned malformed JSON.", "INVALID_OUTPUT");
  }

  try {
    return args.validate(parsed);
  } catch {
    throw new AiError("The model's output didn't match the expected shape.", "INVALID_OUTPUT");
  }
}

/* -------------------------------------------------------------------------- */
/* Prompts                                                                    */
/* -------------------------------------------------------------------------- */

export type CookContext = {
  pantry: string[];
  cuisines?: string[];
  dietary?: string[];
  dislikes?: string[];
  appliances?: string[];
  servings?: number;
};

function contextBlock(ctx: CookContext): string {
  const lines: string[] = [];
  lines.push(`Pantry (everything the cook currently has): ${ctx.pantry.join(", ") || "nothing listed"}`);
  if (ctx.cuisines?.length) lines.push(`Cuisines they lean toward: ${ctx.cuisines.join(", ")}`);
  if (ctx.dietary?.length) lines.push(`Dietary requirements (hard constraints): ${ctx.dietary.join(", ")}`);
  if (ctx.dislikes?.length) lines.push(`Will not eat: ${ctx.dislikes.join(", ")}`);
  if (ctx.appliances?.length) lines.push(`Appliances available: ${ctx.appliances.join(", ")}`);
  lines.push(`Serving for: ${ctx.servings ?? 2}`);
  return lines.join("\n");
}

const COOK_SYSTEM = `You develop recipes for PantryChef, for home cooks deciding dinner at six o'clock.

Hard rules:
- Dietary requirements are absolute. A recipe that violates one is a failure, not a near miss. Never suggest a substitution that breaks the requirement, and never mark a recipe with a dietary tag it doesn't actually satisfy.
- Set "have": true only for ingredients that appear in the cook's pantry list. Everything else is false, even salt and oil. The cook uses this to build a shopping list, so a wrong flag sends them home without dinner.
- Prefer recipes that use most of what they already have. A recipe needing eight things they don't own is not useful.
- Timings and quantities must be real. If something needs 40 minutes, say 40.
- Nutrition figures are per serving and approximate; give your honest estimate rather than a round number.

Write the method as a person who has actually cooked it would: what the pan should look like, what to do if it seizes, what can be prepped ahead. Steps are full sentences, not telegraphese. No preamble, no marketing language, no exclamation marks.`;

/* -------------------------------------------------------------------------- */
/* Generators                                                                 */
/* -------------------------------------------------------------------------- */

/** Recipes from what's in the pantry right now. */
export async function generateFromPantry(
  ctx: CookContext,
  count = 3,
): Promise<GeneratedRecipe[]> {
  const result = await structuredCall({
    system: COOK_SYSTEM,
    schema: RECIPE_JSON_SCHEMA,
    validate: (raw) => recipesSchema.parse(raw),
    content: [
      {
        type: "text",
        text: `${contextBlock(ctx)}

Give me ${count} different dinners I could cook tonight. Vary them: don't return three versions of the same dish. At least one should need nothing beyond what's in the pantry.`,
      },
    ],
  });
  return result.recipes;
}

/** Recipes built from cooked leftovers rather than raw ingredients. */
export async function generateFromLeftovers(
  ctx: CookContext,
  leftovers: string,
  count = 3,
): Promise<GeneratedRecipe[]> {
  const result = await structuredCall({
    system: `${COOK_SYSTEM}

This request is about leftovers: food that is already cooked. Do not write recipes that treat them as raw. Reheating rules matter — say how to bring each thing back without drying it out or making it rubbery, and flag anything that shouldn't be reheated twice. The goal is a second meal that doesn't taste like the first one warmed up.`,
    schema: RECIPE_JSON_SCHEMA,
    validate: (raw) => recipesSchema.parse(raw),
    content: [
      {
        type: "text",
        text: `${contextBlock(ctx)}

Leftovers to use up: ${leftovers}

Give me ${count} ways to turn these into a meal that feels new.`,
      },
    ],
  });
  return result.recipes;
}

/** Recipes written for one specific appliance. */
export async function generateForAppliance(
  ctx: CookContext,
  appliance: string,
  count = 3,
): Promise<GeneratedRecipe[]> {
  const result = await structuredCall({
    system: `${COOK_SYSTEM}

Every recipe here must be written for a ${appliance} and must genuinely suit it — not an oven recipe with the appliance name attached. Use its real settings and vocabulary (temperatures, pressure and release type, basket capacity, preheat behaviour). Say explicitly when to shake, turn, vent, or cook in batches, and set "appliance" on every recipe.`,
    schema: RECIPE_JSON_SCHEMA,
    validate: (raw) => recipesSchema.parse(raw),
    content: [
      {
        type: "text",
        text: `${contextBlock(ctx)}

Give me ${count} ${appliance} recipes I can make from this pantry.`,
      },
    ],
  });
  return result.recipes;
}

/**
 * PantryPup. Pet nutrition is the one place where a plausible-sounding
 * mistake is genuinely dangerous, so the constraints are stated as hard rules
 * and the output carries an explicit vet caveat.
 */
export async function generatePetRecipe(
  args: { species: "dog" | "cat"; weightKg: number; notes?: string; pantry: string[] },
  count = 2,
): Promise<GeneratedRecipe[]> {
  const result = await structuredCall({
    system: `You develop home-cooked pet food recipes for PantryPup, part of PantryChef.

Safety rules, without exception:
- Never include anything toxic to the species. For dogs and cats that includes onion, garlic, chives, leek, grapes, raisins, currants, chocolate, cocoa, xylitol, macadamia, alcohol, raw yeast dough, and cooked bones. For cats also avoid anything without sufficient taurine as a sole diet.
- Cats are obligate carnivores. A vegetarian cat recipe is not an option, whatever the owner asks for.
- Home-cooked pet food is not complete without supplementation. Say so plainly in the tips, and state that the owner should confirm the balance with their vet before feeding it as a staple rather than a topper.
- Give portion guidance by body weight in the tips, and say it is a starting point to adjust with the animal's condition.

Write plainly, no marketing. The point is food that is better and cheaper than a supermarket pouch, not a novelty.`,
    schema: RECIPE_JSON_SCHEMA,
    validate: (raw) => recipesSchema.parse(raw),
    content: [
      {
        type: "text",
        text: `Species: ${args.species}
Adult weight: ${args.weightKg}kg
${args.notes ? `Owner notes: ${args.notes}` : ""}
Human ingredients on hand: ${args.pantry.join(", ") || "assume a normal supermarket shop"}

Give me ${count} recipes. Set "servings" to the number of daily portions the batch makes for an animal of this weight, and put the per-portion weight in the tips.`,
      },
    ],
  });
  return result.recipes;
}

/* -------------------------------------------------------------------------- */
/* Vision — read a pantry off a photo                                         */
/* -------------------------------------------------------------------------- */

const detectedSchema = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      confidence: z.enum(["high", "medium", "low"]),
      note: z.string().nullable(),
    }),
  ),
});

export type DetectedItem = z.infer<typeof detectedSchema>["items"][number];

const DETECT_JSON_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "The ingredient, singular and lowercase." },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          note: {
            type: ["string", "null"],
            description: "Only when it changes what the cook would do — e.g. 'looks past its best'.",
          },
        },
        required: ["name", "confidence", "note"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
} as const;

const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export type SupportedMediaType = (typeof MEDIA_TYPES)[number];

export function isSupportedImage(type: string): type is SupportedMediaType {
  return (MEDIA_TYPES as readonly string[]).includes(type);
}

/** Read a fridge or shopping photo and return what's in it. */
export async function detectIngredients(
  base64: string,
  mediaType: SupportedMediaType,
): Promise<DetectedItem[]> {
  const result = await structuredCall({
    system: `You identify food in photographs of fridges, cupboards, and shopping.

List only what you can actually see. A blurry orange blob is not "carrots" — either mark it low confidence or leave it out. Do not infer contents from a container you cannot read, and do not pad the list with staples the cook probably owns.

Use everyday singular names ("chicken thigh", not "poultry, thigh, raw"). Combine duplicates into one entry. If the photo has no food in it, return an empty list rather than guessing.`,
    schema: DETECT_JSON_SCHEMA,
    validate: (raw) => detectedSchema.parse(raw),
    effort: "low",
    content: [
      { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
      { type: "text", text: "What food is in this photo?" },
    ],
  });
  return result.items;
}

/* -------------------------------------------------------------------------- */
/* Meal plans                                                                 */
/* -------------------------------------------------------------------------- */

const mealPlanSchema = z.object({
  title: z.string(),
  days: z.array(
    z.object({
      day: z.string(),
      meals: z.array(z.object({ slot: z.string(), title: z.string(), note: z.string() })),
    }),
  ),
  shopping: z.array(z.object({ item: z.string(), amount: z.string(), have: z.boolean() })),
});

export type GeneratedMealPlan = z.infer<typeof mealPlanSchema>;

const MEAL_PLAN_JSON_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    days: {
      type: "array",
      items: {
        type: "object",
        properties: {
          day: { type: "string" },
          meals: {
            type: "array",
            items: {
              type: "object",
              properties: {
                slot: { type: "string", description: "breakfast, lunch, or dinner" },
                title: { type: "string" },
                note: { type: "string", description: "One line: why it's here, or what it reuses." },
              },
              required: ["slot", "title", "note"],
              additionalProperties: false,
            },
          },
        },
        required: ["day", "meals"],
        additionalProperties: false,
      },
    },
    shopping: {
      type: "array",
      items: {
        type: "object",
        properties: {
          item: { type: "string" },
          amount: { type: "string" },
          have: { type: "boolean" },
        },
        required: ["item", "amount", "have"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "days", "shopping"],
  additionalProperties: false,
} as const;

export async function generateMealPlan(
  ctx: CookContext,
  days = 7,
): Promise<GeneratedMealPlan> {
  return structuredCall({
    system: `${COOK_SYSTEM}

You are writing a ${days}-day dinner plan. Make it survivable, not aspirational: no more than two recipes a week that take over 45 minutes, and design deliberate reuse so an ingredient bought for Monday gets finished by Thursday. The shopping list is what they must buy — mark "have": true for anything already in the pantry so it can be ticked off.`,
    schema: MEAL_PLAN_JSON_SCHEMA,
    validate: (raw) => mealPlanSchema.parse(raw),
    effort: "high",
    content: [
      {
        type: "text",
        text: `${contextBlock(ctx)}

Plan ${days} days of dinners.`,
      },
    ],
  });
}
