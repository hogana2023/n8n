import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const readJson = (rel) => JSON.parse(readFileSync(join(root, rel), 'utf8'));
const readText = (rel) => readFileSync(join(root, rel), 'utf8');

export const ROOT = root;

export const settings = readJson('config/settings.json');
export const contacts = readJson('config/contacts.json');

const categoriesFile = readJson('config/categories.json');

/** All nine bins, ordered by the tie-break ladder. */
export const categories = [...categoriesFile.categories].sort((a, b) => a.precedence - b.precedence);

/** The eight bins the classifier picks explicitly. Unclassified is the node's fallback branch. */
export const explicitCategories = categories.filter((c) => !c.fallback);

export const fallbackCategory = categories.find((c) => c.fallback);

export const categoryNames = categories.map((c) => c.category);

const byName = new Map(categories.map((c) => [c.category, c]));
export const categoryByName = (name) => byName.get(name) ?? null;

/** Bins that can carry a live solicitation. Nothing here may ever land in Noise. */
export const solicitationCategories = categories.filter((c) => c.solicitation).map((c) => c.category);

export const prompts = {
	classifier: readText('prompts/classifier.system.txt'),
	extractor: readText('prompts/extractor.system.txt'),
	summary: readText('prompts/summary.system.txt'),
	draft: readText('prompts/draft.system.txt'),
};

export const extractorSchema = readJson('prompts/extractor.schema.json');
