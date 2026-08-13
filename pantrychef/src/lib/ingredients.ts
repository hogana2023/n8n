/**
 * Turning what someone types ("2 ripe Roma tomatoes") into a key a recipe can
 * be matched on ("tomato"). Deliberately a small, readable rule set rather than
 * an NLP model — it runs on every keystroke in the pantry editor.
 */

/** Quantities, units and prep words that carry no identity. */
const NOISE = new Set([
  "a", "an", "the", "of", "some", "fresh", "freshly", "ripe", "raw", "cooked",
  "chopped", "diced", "sliced", "minced", "grated", "shredded", "crushed",
  "large", "small", "medium", "extra", "whole", "half", "boneless", "skinless",
  "organic", "free", "range", "tinned", "canned", "frozen", "dried", "ground",
  "g", "kg", "ml", "l", "oz", "lb", "lbs", "cup", "cups", "tsp", "tbsp",
  "teaspoon", "teaspoons", "tablespoon", "tablespoons", "clove", "cloves",
  "pinch", "handful", "bunch", "can", "cans", "tin", "jar", "packet", "pack",
]);

/**
 * Words that are genuinely different ingredients despite sharing a stem, plus
 * common synonyms collapsed onto one key. Order matters: longest match wins.
 */
const SYNONYMS: Record<string, string> = {
  "spring onion": "spring-onion",
  "green onion": "spring-onion",
  scallion: "spring-onion",
  "bell pepper": "pepper",
  capsicum: "pepper",
  "chilli pepper": "chilli",
  "chili pepper": "chilli",
  chile: "chilli",
  chili: "chilli",
  aubergine: "aubergine",
  eggplant: "aubergine",
  courgette: "courgette",
  zucchini: "courgette",
  coriander: "coriander",
  cilantro: "coriander",
  chickpeas: "chickpea",
  garbanzo: "chickpea",
  "double cream": "cream",
  "heavy cream": "cream",
  "spaghetti": "pasta",
  "penne": "pasta",
  "fusilli": "pasta",
  "tagliatelle": "pasta",
  "linguine": "pasta",
  "streaky bacon": "bacon",
  "chicken breast": "chicken",
  "chicken thigh": "chicken",
  "chicken thighs": "chicken",
  "tinned tomatoes": "tomato",
  "chopped tomatoes": "tomato",
  "passata": "tomato",
  "parmesan cheese": "parmesan",
  "parmigiano": "parmesan",
  "cheddar cheese": "cheddar",
  "greek yoghurt": "yoghurt",
  "greek yogurt": "yoghurt",
  yogurt: "yoghurt",
  "soy sauce": "soy-sauce",
  "olive oil": "olive-oil",
  "peanut butter": "peanut-butter",
  "stock cube": "stock",
  "vegetable stock": "stock",
  "chicken stock": "stock",
};

/** Irregular plurals that the -s/-es rules would mangle. */
const IRREGULAR: Record<string, string> = {
  leaves: "leaf",
  loaves: "loaf",
  potatoes: "potato",
  tomatoes: "tomato",
  chillies: "chilli",
  anchovies: "anchovy",
  berries: "berry",
  cherries: "cherry",
  peas: "pea",
  lentils: "lentil",
  oats: "oat",
  greens: "greens",
  hummus: "hummus",
  couscous: "couscous",
  asparagus: "asparagus",
  molasses: "molasses",
};

function singularise(word: string): string {
  if (IRREGULAR[word]) return IRREGULAR[word];
  if (word.length <= 3) return word;
  // "-ss" words (grass, glass) are already singular.
  if (word.endsWith("ss")) return word;
  if (word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.endsWith("oes") || word.endsWith("hes") || word.endsWith("xes")) {
    return word.slice(0, -2);
  }
  if (word.endsWith("s")) return word.slice(0, -1);
  return word;
}

/**
 * Normalise a free-text ingredient into a stable matching key.
 * Returns an empty string when nothing meaningful is left.
 */
export function toSlug(input: string): string {
  const cleaned = input
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ") // drop parenthetical asides
    .replace(/[^a-z\s-]/g, " ") // drop digits, fractions, punctuation
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "";

  // Multi-word synonyms first, so "spring onion" never becomes "onion".
  for (const [phrase, slug] of Object.entries(SYNONYMS).sort(
    (a, b) => b[0].length - a[0].length,
  )) {
    if (cleaned.includes(phrase)) return slug;
  }

  const words = cleaned
    .split(" ")
    .filter((w) => w && !NOISE.has(w))
    .map(singularise);

  if (!words.length) return "";

  // Keep at most two words: "red onion" stays distinct, longer strings collapse.
  return words.slice(-2).join("-");
}

/** Rough shelf grouping, used to bucket the pantry UI. */
const CATEGORY_HINTS: Array<[string, RegExp]> = [
  ["produce", /tomato|onion|garlic|pepper|carrot|potato|lettuce|spinach|courgette|aubergine|mushroom|lemon|lime|apple|banana|herb|basil|coriander|parsley|chilli|cucumber|broccoli|cabbage|leek|celery|avocado/],
  ["protein", /chicken|beef|pork|lamb|bacon|sausage|fish|salmon|tuna|prawn|shrimp|tofu|egg|turkey|anchovy|chickpea|lentil|bean/],
  ["dairy", /milk|cheese|butter|cream|yoghurt|parmesan|cheddar|mozzarella|feta|halloumi/],
  ["grain", /rice|pasta|bread|flour|oat|noodle|couscous|quinoa|tortilla|polenta/],
  ["pantry", /oil|vinegar|soy-sauce|stock|sugar|salt|spice|cumin|paprika|curry|honey|mustard|peanut-butter|tomato-puree|coconut-milk/],
];

export function categoryFor(slug: string): string {
  for (const [category, pattern] of CATEGORY_HINTS) {
    if (pattern.test(slug)) return category;
  }
  return "other";
}

/** Title-case a slug back into something printable: "spring-onion" → "Spring onion". */
export function slugToLabel(slug: string): string {
  const words = slug.split("-");
  return words.join(" ").replace(/^./, (c) => c.toUpperCase());
}
