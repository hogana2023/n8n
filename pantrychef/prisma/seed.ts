/**
 * Seeds the curated cookbooks that ship with the app.
 *
 * These recipes have no `userId` — they belong to a cookbook, not a person.
 * Per-user recipes are generated at runtime and never seeded.
 *
 * Idempotent: re-running updates rather than duplicating.
 */
import { PrismaClient, type RecipeKind } from "@prisma/client";

const prisma = new PrismaClient();

type SeedRecipe = {
  key: string;
  kind: RecipeKind;
  title: string;
  summary: string;
  minutes: number;
  servings: number;
  difficulty: string;
  cuisine: string;
  appliance: string | null;
  dietary: string[];
  ingredients: Array<{ item: string; amount: string; have: boolean }>;
  steps: string[];
  tips: string[];
  nutrition: { calories: number; protein: number; carbs: number; fat: number };
};

type SeedCookbook = {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  category: string;
  coverColor: string;
  pricePence: number;
  recipes: SeedRecipe[];
};

const COOKBOOKS: SeedCookbook[] = [
  {
    slug: "air-fryer-weeknights",
    title: "Air Fryer Weeknights",
    subtitle: "Dinner in one basket",
    description:
      "Recipes written for the machine rather than adapted to it. Real basket temperatures, real batch sizes, and an honest note on every one about what needs shaking and what needs space.",
    category: "Appliance",
    coverColor: "#1d7a4c",
    pricePence: 900,
    recipes: [
      {
        key: "af-paprika-thighs",
        kind: "APPLIANCE",
        title: "Paprika chicken thighs with crushed potatoes",
        summary:
          "The whole thing happens in one basket, staged so the potatoes get a head start and finish crisp rather than steamed.",
        minutes: 35,
        servings: 2,
        difficulty: "easy",
        cuisine: "everyday",
        appliance: "air-fryer",
        dietary: ["gluten-free", "dairy-free"],
        ingredients: [
          { item: "bone-in chicken thighs", amount: "4", have: false },
          { item: "small potatoes", amount: "500g", have: false },
          { item: "smoked paprika", amount: "2 tsp", have: false },
          { item: "olive oil", amount: "2 tbsp", have: false },
          { item: "lemon", amount: "1", have: false },
        ],
        steps: [
          "Parboil the potatoes for 8 minutes, drain them, and let the steam come off for a minute before crushing each one flat under the base of a mug.",
          "Toss the potatoes in half the oil and a pinch of salt. Set the basket to 200°C and give them 12 minutes on their own, shaking twice.",
          "Rub the thighs with the paprika, the rest of the oil, and plenty of salt while the potatoes go.",
          "Push the potatoes to one side and lay the thighs skin-up beside them, not on top. Another 18 minutes.",
          "Squeeze the lemon over everything the moment the basket comes out, while it is still hissing.",
        ],
        tips: [
          "Anything overlapping steams instead of crisping. Two batches beats one crowded one.",
          "If your basket is small, do the potatoes first and hold them warm while the thighs cook.",
        ],
        nutrition: { calories: 640, protein: 38, carbs: 44, fat: 34 },
      },
      {
        key: "af-halloumi",
        kind: "APPLIANCE",
        title: "Air fryer halloumi with honey and chilli",
        summary:
          "Eight minutes, one ingredient that does the work, and a glaze that goes on after the heat rather than before.",
        minutes: 12,
        servings: 2,
        difficulty: "easy",
        cuisine: "Greek",
        appliance: "air-fryer",
        dietary: ["vegetarian", "gluten-free"],
        ingredients: [
          { item: "halloumi", amount: "225g block", have: false },
          { item: "honey", amount: "1 tbsp", have: false },
          { item: "dried chilli flakes", amount: "a pinch", have: false },
          { item: "lemon", amount: "half", have: false },
        ],
        steps: [
          "Slice the halloumi into finger-thick pieces and pat every face properly dry. Wet halloumi will not colour.",
          "Basket at 200°C, no oil, single layer, 8 minutes. Turn once at the halfway point.",
          "Warm the honey with the chilli flakes for 20 seconds while it cooks.",
          "Spoon the honey over off the heat and finish with the lemon. Adding honey before the heat only burns it.",
        ],
        tips: [
          "No oil needed — halloumi renders enough of its own.",
          "Eat it immediately. Halloumi turns squeaky and tough as it cools.",
        ],
        nutrition: { calories: 420, protein: 25, carbs: 12, fat: 31 },
      },
    ],
  },
  {
    slug: "the-leftovers-book",
    title: "The Leftovers Book",
    subtitle: "Second meals that don't taste like seconds",
    description:
      "Cooked food is a different problem from raw ingredients. Every recipe here starts from something already in the fridge, and every one says how to bring it back without turning it to rubber.",
    category: "Leftovers",
    coverColor: "#8a4a2f",
    pricePence: 900,
    recipes: [
      {
        key: "lo-avgolemono",
        kind: "LEFTOVERS",
        title: "Chicken and rice soup, avgolemono-style",
        summary:
          "The standard destination for the end of a roast chicken and a box of cold rice. Twenty minutes, and the egg is what makes it.",
        minutes: 20,
        servings: 3,
        difficulty: "medium",
        cuisine: "Greek",
        appliance: null,
        dietary: ["gluten-free", "dairy-free"],
        ingredients: [
          { item: "leftover roast chicken", amount: "300g, stripped", have: false },
          { item: "cooked rice", amount: "250g, cold", have: false },
          { item: "chicken stock", amount: "1 litre", have: false },
          { item: "eggs", amount: "2", have: false },
          { item: "lemon", amount: "1", have: false },
        ],
        steps: [
          "Simmer the stripped carcass in the stock for 15 minutes while you get everything else ready, then lift it out.",
          "Beat the eggs with the lemon juice until completely smooth.",
          "Take the pan off the heat. Ladle a little hot stock into the eggs while whisking hard, then another, then a third. This is the step that decides whether you get soup or scrambled egg.",
          "Pour the tempered eggs back into the pan, still off the heat, stirring as you go. It will thicken slightly and turn opaque.",
          "Add the chicken and the cold rice last, only to warm through.",
        ],
        tips: [
          "Do not let it boil after the egg goes in, and do not reheat it a second time.",
          "Cold rice is correct here — it holds its shape instead of collapsing.",
        ],
        nutrition: { calories: 410, protein: 32, carbs: 38, fat: 14 },
      },
    ],
  },
  {
    slug: "pantrypup-basics",
    title: "PantryPup Basics",
    subtitle: "Home-cooked food for dogs",
    description:
      "Batch recipes from ordinary supermarket ingredients, portioned by body weight. Every recipe states plainly what supplementation it still needs, because home-cooked pet food is not complete on its own.",
    category: "PantryPup",
    coverColor: "#6b3fa0",
    pricePence: 700,
    recipes: [
      {
        key: "pp-turkey-pumpkin",
        kind: "PET",
        title: "Turkey, pumpkin and rice batch",
        summary:
          "A plain, gentle batch that most dogs take to. Makes six daily portions for a 12kg dog.",
        minutes: 45,
        servings: 6,
        difficulty: "easy",
        cuisine: "n/a",
        appliance: null,
        dietary: [],
        ingredients: [
          { item: "turkey mince", amount: "750g", have: false },
          { item: "pumpkin or butternut squash", amount: "400g, diced", have: false },
          { item: "carrot", amount: "2, diced", have: false },
          { item: "white rice", amount: "300g, cooked", have: false },
          { item: "sunflower oil", amount: "1 tbsp", have: false },
        ],
        steps: [
          "No onion, garlic, leek, or chive goes into this. Not for flavour, not in stock, not at all — every allium is toxic to dogs.",
          "Brown the turkey plain in the oil, breaking it up as it goes. Season nothing.",
          "Add the pumpkin and carrot with a splash of water, cover, and simmer 20 minutes until everything is soft enough to mash with a fork.",
          "Fold the cooked rice through and take it off the heat.",
          "Cool completely before portioning into six containers. Refrigerate three, freeze the rest.",
        ],
        tips: [
          "Roughly 250g per portion for a 12kg adult dog, once a day alongside their usual food. Adjust with body condition, not with the bowl being emptied.",
          "This is a topper, not a complete diet. It is short of calcium and several micronutrients — talk to your vet about a supplement before it replaces meals.",
          "Introduce over a week, mixing increasing amounts into their current food.",
        ],
        nutrition: { calories: 320, protein: 28, carbs: 30, fat: 11 },
      },
    ],
  },
];

async function main() {
  console.log(`Seeding ${COOKBOOKS.length} cookbooks…`);

  for (const book of COOKBOOKS) {
    const cookbook = await prisma.cookbook.upsert({
      where: { slug: book.slug },
      create: {
        slug: book.slug,
        title: book.title,
        subtitle: book.subtitle,
        description: book.description,
        category: book.category,
        coverColor: book.coverColor,
        pricePence: book.pricePence,
        published: true,
      },
      update: {
        title: book.title,
        subtitle: book.subtitle,
        description: book.description,
        category: book.category,
        coverColor: book.coverColor,
        pricePence: book.pricePence,
        published: true,
      },
    });

    // Replace the entry set so an edit to this file is reflected exactly.
    await prisma.cookbookEntry.deleteMany({ where: { cookbookId: cookbook.id } });

    for (const [index, recipe] of book.recipes.entries()) {
      const { key, ...data } = recipe;

      // Curated recipes are keyed by title within the cookbook, since they
      // have no user to scope them to.
      const existing = await prisma.recipe.findFirst({
        where: { userId: null, title: recipe.title },
        select: { id: true },
      });

      const record = existing
        ? await prisma.recipe.update({ where: { id: existing.id }, data })
        : await prisma.recipe.create({ data: { ...data, userId: null } });

      await prisma.cookbookEntry.create({
        data: { cookbookId: cookbook.id, recipeId: record.id, position: index },
      });
    }

    console.log(`  ${book.title} — ${book.recipes.length} recipes`);
  }

  console.log("Done.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
