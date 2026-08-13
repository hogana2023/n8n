/**
 * Seeds the recipe library. Idempotent: re-running updates rather than
 * duplicating, so it's safe to run on every deploy.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type SeedIngredient = { slug: string; label: string; amount?: string; isStaple?: boolean };

type SeedRecipe = {
  slug: string;
  title: string;
  summary: string;
  imageUrl: string;
  minutes: number;
  servings: number;
  difficulty: string;
  cuisine: string;
  isPremium?: boolean;
  ingredients: SeedIngredient[];
  steps: string[];
};

const SALT: SeedIngredient = { slug: "salt", label: "Salt", isStaple: true };
const OIL: SeedIngredient = { slug: "olive-oil", label: "Olive oil", isStaple: true };
const PEPPER: SeedIngredient = { slug: "black-pepper", label: "Black pepper", isStaple: true };

const RECIPES: SeedRecipe[] = [
  {
    slug: "ten-minute-tomato-garlic-pasta",
    title: "Ten-minute tomato and garlic pasta",
    summary:
      "The one everyone should know by heart. Good tinned tomatoes, more garlic than feels sensible, and pasta water to bring it together.",
    imageUrl:
      "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=1200&q=80",
    minutes: 10,
    servings: 2,
    difficulty: "easy",
    cuisine: "Italian",
    ingredients: [
      { slug: "pasta", label: "Dried pasta", amount: "200g" },
      { slug: "tomato", label: "Tinned tomatoes", amount: "400g" },
      { slug: "garlic", label: "Garlic", amount: "4 cloves" },
      SALT,
      OIL,
      PEPPER,
    ],
    steps: [
      "Put the pasta on in well-salted boiling water. Everything else finishes in the time it takes to cook.",
      "Slice the garlic thinly and start it in a cold pan with a generous glug of oil. Bring the heat up slowly so it turns golden rather than bitter.",
      "Add the tomatoes, crush them with the back of a spoon, and season. Let it bubble hard for six or seven minutes.",
      "Drain the pasta, keeping a mugful of the water. Toss the pasta through the sauce with a splash of that water until it clings.",
      "Taste, add more salt than you think, and eat immediately.",
    ],
  },
  {
    slug: "spinach-cheddar-folded-omelette",
    title: "Spinach and cheddar folded omelette",
    summary:
      "Eight minutes from fridge to plate, and the most reliable way to use up the last of a bag of spinach.",
    imageUrl:
      "https://images.unsplash.com/photo-1510693206972-df098062cb71?auto=format&fit=crop&w=1200&q=80",
    minutes: 8,
    servings: 1,
    difficulty: "easy",
    cuisine: "everyday",
    ingredients: [
      { slug: "egg", label: "Eggs", amount: "3" },
      { slug: "spinach", label: "Spinach", amount: "2 handfuls" },
      { slug: "cheddar", label: "Cheddar", amount: "40g" },
      { slug: "butter", label: "Butter", amount: "a knob" },
      SALT,
      PEPPER,
    ],
    steps: [
      "Wilt the spinach in a dry pan for a minute, then tip it out and squeeze out the water. Wet spinach ruins the whole thing.",
      "Beat the eggs with salt and pepper until completely uniform, with no streaks of white left.",
      "Melt the butter in a non-stick pan over medium heat. Pour in the eggs and stir gently for twenty seconds, then leave them alone.",
      "When the top is still slightly loose, scatter over the spinach and cheese.",
      "Fold in thirds, slide onto a plate, and let the residual heat finish the middle.",
    ],
  },
  {
    slug: "weeknight-chicken-traybake",
    title: "Weeknight chicken traybake",
    summary:
      "One tray, one temperature, no attention required. The lemon is what makes it taste like more effort than it was.",
    imageUrl:
      "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?auto=format&fit=crop&w=1200&q=80",
    minutes: 45,
    servings: 4,
    difficulty: "easy",
    cuisine: "everyday",
    ingredients: [
      { slug: "chicken", label: "Chicken thighs", amount: "8, bone-in" },
      { slug: "potato", label: "Potatoes", amount: "600g" },
      { slug: "onion", label: "Red onions", amount: "2" },
      { slug: "lemon", label: "Lemon", amount: "1" },
      { slug: "garlic", label: "Garlic", amount: "1 bulb" },
      SALT,
      OIL,
      PEPPER,
    ],
    steps: [
      "Heat the oven to 200°C fan. Cut the potatoes into chunks a bit smaller than the chicken pieces so they finish together.",
      "Toss everything except the lemon in a large tray with plenty of oil, salt and pepper. Keep it in one layer, and use two trays if it looks crowded.",
      "Sit the chicken skin-side up on top. Anything buried under the chicken steams instead of roasting.",
      "Roast for 40 to 45 minutes, until the skin is properly dark and the potatoes have crisp edges.",
      "Squeeze the lemon over the whole tray the moment it comes out, and scrape up the sticky bits.",
    ],
  },
  {
    slug: "chickpea-yoghurt-bowl",
    title: "Chickpea and yoghurt bowl",
    summary:
      "Store cupboard dinner that eats like you planned it. Fifteen minutes, mostly waiting.",
    imageUrl:
      "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=1200&q=80",
    minutes: 15,
    servings: 2,
    difficulty: "easy",
    cuisine: "Middle Eastern",
    ingredients: [
      { slug: "chickpea", label: "Chickpeas", amount: "1 tin" },
      { slug: "yoghurt", label: "Natural yoghurt", amount: "200g" },
      { slug: "garlic", label: "Garlic", amount: "1 clove" },
      { slug: "lemon", label: "Lemon", amount: "half" },
      { slug: "cumin", label: "Ground cumin", amount: "1 tsp" },
      { slug: "spinach", label: "Spinach", amount: "a handful" },
      SALT,
      OIL,
    ],
    steps: [
      "Grate the garlic into the yoghurt with a good pinch of salt and a squeeze of lemon. Leave it to sit while you do everything else.",
      "Drain the chickpeas and dry them properly on a tea towel. Damp chickpeas will not crisp.",
      "Fry them in a hot pan with oil and the cumin for six or seven minutes, until some have split and browned.",
      "Wilt the spinach through at the very end, off the heat.",
      "Spread the yoghurt on the plate, pile the chickpeas on top, and finish with the pan oil.",
    ],
  },
  {
    slug: "egg-fried-rice",
    title: "Egg fried rice",
    summary:
      "The correct destination for yesterday's rice. Cold rice is not a compromise here, it is the requirement.",
    imageUrl:
      "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=1200&q=80",
    minutes: 12,
    servings: 2,
    difficulty: "easy",
    cuisine: "Chinese",
    ingredients: [
      { slug: "rice", label: "Cooked, cold rice", amount: "400g" },
      { slug: "egg", label: "Eggs", amount: "3" },
      { slug: "spring-onion", label: "Spring onions", amount: "4" },
      { slug: "garlic", label: "Garlic", amount: "2 cloves" },
      { slug: "soy-sauce", label: "Soy sauce", amount: "2 tbsp" },
      OIL,
    ],
    steps: [
      "Break the cold rice up with your fingers so there are no clumps left. This is the whole technique.",
      "Get the pan as hot as it goes. Scramble the eggs quickly in oil, then tip them out while still slightly wet.",
      "Fry the garlic and the white parts of the spring onion for thirty seconds.",
      "Add the rice and leave it alone in contact with the pan for a minute at a time, so it toasts rather than steams.",
      "Return the eggs, add the soy, and finish with the green tops off the heat.",
    ],
  },
  {
    slug: "brown-butter-sage-gnocchi",
    title: "Brown butter and sage gnocchi",
    summary:
      "Four ingredients and a pan hot enough to matter. The kind of thing that reads as a restaurant dish and takes twelve minutes.",
    imageUrl:
      "https://images.unsplash.com/photo-1587740908075-9e245070dfaa?auto=format&fit=crop&w=1200&q=80",
    minutes: 12,
    servings: 2,
    difficulty: "medium",
    cuisine: "Italian",
    isPremium: true,
    ingredients: [
      { slug: "gnocchi", label: "Gnocchi", amount: "500g" },
      { slug: "butter", label: "Butter", amount: "80g" },
      { slug: "sage", label: "Sage leaves", amount: "15" },
      { slug: "parmesan", label: "Parmesan", amount: "40g" },
      SALT,
      PEPPER,
    ],
    steps: [
      "Skip the boiling water. Fry the gnocchi straight from the packet in a dry non-stick pan until blistered on two sides.",
      "Push them to one side, add the butter, and let it foam. Watch it closely from here.",
      "When the foam subsides and the solids turn the colour of a hazelnut, throw in the sage. It will crackle hard for about ten seconds.",
      "Toss the gnocchi through immediately, off the heat, so the butter stops cooking.",
      "Grate over the parmesan, add a lot of black pepper, and serve straight from the pan.",
    ],
  },
  {
    slug: "slow-roast-tomato-ragu",
    title: "Slow-roast tomato ragù",
    summary:
      "Two hours of oven time and nine minutes of work. Freezes perfectly, which is the real reason to make it.",
    imageUrl:
      "https://images.unsplash.com/photo-1608897013039-887f21d8c804?auto=format&fit=crop&w=1200&q=80",
    minutes: 130,
    servings: 6,
    difficulty: "easy",
    cuisine: "Italian",
    isPremium: true,
    ingredients: [
      { slug: "tomato", label: "Tinned tomatoes", amount: "2 x 400g" },
      { slug: "onion", label: "Onions", amount: "2" },
      { slug: "carrot", label: "Carrots", amount: "2" },
      { slug: "garlic", label: "Garlic", amount: "6 cloves" },
      { slug: "beef", label: "Beef mince", amount: "500g" },
      { slug: "milk", label: "Whole milk", amount: "200ml" },
      SALT,
      OIL,
      PEPPER,
    ],
    steps: [
      "Heat the oven to 150°C fan. Chop the onion, carrot and garlic as finely as you can be bothered to.",
      "Brown the mince hard in an ovenproof pot, in two batches. Crowding the pan is the difference between browning and boiling.",
      "Add the vegetables and cook down for ten minutes until soft and sweet.",
      "Pour in the milk and let it reduce almost completely. This is what makes the texture, so do not skip it.",
      "Add the tomatoes, season, cover with the lid slightly ajar, and put it in the oven for two hours.",
      "Stir once at the end, taste, and season again. It will need more salt than you expect.",
    ],
  },
  {
    slug: "lemon-garlic-butter-salmon",
    title: "Lemon and garlic butter salmon",
    summary:
      "Fifteen minutes, one pan, and a sauce that makes itself from what is already in the pan.",
    imageUrl:
      "https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=1200&q=80",
    minutes: 15,
    servings: 2,
    difficulty: "medium",
    cuisine: "everyday",
    isPremium: true,
    ingredients: [
      { slug: "salmon", label: "Salmon fillets", amount: "2" },
      { slug: "butter", label: "Butter", amount: "50g" },
      { slug: "garlic", label: "Garlic", amount: "3 cloves" },
      { slug: "lemon", label: "Lemon", amount: "1" },
      { slug: "parsley", label: "Parsley", amount: "a small bunch" },
      SALT,
      OIL,
      PEPPER,
    ],
    steps: [
      "Dry the salmon skin thoroughly and salt it. Wet skin will never crisp.",
      "Lay it skin-side down in a cold non-stick pan with a little oil, then turn the heat to medium. Press down for the first twenty seconds.",
      "Cook without moving it for six or seven minutes, until the flesh has turned opaque most of the way up the side.",
      "Flip for sixty seconds, then add the butter, sliced garlic and a squeeze of lemon. Spoon the foaming butter over the fish.",
      "Rest for two minutes off the heat, then finish with the parsley and the rest of the lemon.",
    ],
  },
];

async function main() {
  console.log(`Seeding ${RECIPES.length} recipes…`);

  for (const recipe of RECIPES) {
    const { ingredients, ...data } = recipe;

    await prisma.recipe.upsert({
      where: { slug: recipe.slug },
      create: {
        ...data,
        isPremium: recipe.isPremium ?? false,
        ingredients: {
          create: ingredients.map((i) => ({
            slug: i.slug,
            label: i.label,
            amount: i.amount ?? null,
            isStaple: i.isStaple ?? false,
          })),
        },
      },
      update: {
        ...data,
        isPremium: recipe.isPremium ?? false,
        // Replace the ingredient set wholesale so an edit to the seed is
        // reflected exactly rather than merged.
        ingredients: {
          deleteMany: {},
          create: ingredients.map((i) => ({
            slug: i.slug,
            label: i.label,
            amount: i.amount ?? null,
            isStaple: i.isStaple ?? false,
          })),
        },
      },
    });
  }

  console.log("Done.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
