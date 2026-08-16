import { renderInput } from './email.js';
import { callModel, parseJsonResponse } from './llm.js';
import { explicitCategories, fallbackCategory, prompts, settings } from './config.js';

/**
 * Routing layer. Suite 1.
 *
 * Mirrors what the n8n Text Classifier node does at runtime: one system message built from
 * the template plus a boolean-per-category JSON schema, single class, with the fallback
 * branch standing in for Unclassified. The node writes its own format instructions through
 * LangChain's StructuredOutputParser. The wording of that block differs slightly from the
 * one below, the JSON shape it asks for does not, which is what the score depends on.
 */

const CATEGORY_LIST = explicitCategories.map((c) => c.category);

function formatInstructions() {
	const shape = [
		...CATEGORY_LIST.map((name) => `  "${name}": boolean`),
		'  "fallback": boolean',
	].join(',\n');

	return [
		'Output a single JSON object and nothing else. It must have exactly these keys:',
		'',
		'{',
		shape,
		'}',
		'',
		'Set exactly one key to true and every other key to false.',
		`Set "fallback" to true when none of the named categories fit. That routes the message to ${fallbackCategory.category}.`,
	].join('\n');
}

export function buildClassifierSystemPrompt() {
	return [
		prompts.classifier.replace('{categories}', CATEGORY_LIST.join(', ')),
		'',
		formatInstructions(),
		'',
		'Categories are mutually exclusive, and only one can be true.',
	].join('\n');
}

/** Turn the model's boolean map into one bin name. */
export function resolveCategory(output) {
	const hits = CATEGORY_LIST.filter((name) => output?.[name] === true);

	if (hits.length === 1) return { category: hits[0], ambiguous: false, hits };

	// Single-class is enforced here, not left to the model. Two trues means the model
	// hedged, and the tie-break ladder in the prompt is the same order as `precedence`,
	// so taking the earliest one is the documented behaviour rather than a coin flip.
	if (hits.length > 1) {
		const ranked = explicitCategories.filter((c) => hits.includes(c.category));
		return { category: ranked[0].category, ambiguous: true, hits };
	}

	return { category: fallbackCategory.category, ambiguous: false, hits };
}

/**
 * @param {object} input an email or a thread fixture
 * @param {object} [opts] {pass, model}
 * @returns {Promise<{category: string, ambiguous: boolean, raw: object}>}
 */
export async function classify(input, opts = {}) {
	const system = buildClassifierSystemPrompt();
	const user = renderInput(input);

	const text = await callModel({
		system,
		user,
		model: opts.model ?? settings.llm.classifierModel,
		temperature: settings.llm.temperature,
		pass: opts.pass ?? 0,
	});

	const raw = parseJsonResponse(text);
	const { category, ambiguous } = resolveCategory(raw);

	return { category, ambiguous, raw };
}
