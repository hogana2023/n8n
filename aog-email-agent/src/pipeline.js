import { classify } from './classify.js';
import { extract } from './extract.js';
import { generateDraft } from './draft.js';
import { lookupTier } from './tier.js';
import { categoryByName } from './config.js';
import { senderOf } from './email.js';

/**
 * The whole inbound path in one function, in the order the n8n workflow runs it.
 *
 *   route -> tier lookup -> extract -> draft -> stage the record
 *
 * The ordering is deliberate. Tier is looked up straight off the from-address and never
 * touches the model. Extraction runs after routing so the category can be handed to it as
 * context. Drafting runs last because it needs both.
 */
export async function processEmail(input, opts = {}) {
	const { category, ambiguous, raw } = await classify(input, opts);
	const bin = categoryByName(category);

	// Content decided the bin. The table decides the tier. Neither overrides the other,
	// which is the PRI-04 split.
	const tier = lookupTier(senderOf(input));

	const { extracted, droppedFields } = await extract(input, { ...opts, category });

	const draft = await generateDraft({ input, category, extracted }, opts);

	return {
		category,
		folder: bin?.folder ?? null,
		ambiguous,
		classifier_raw: raw,
		tier,
		extracted,
		dropped_model_fields: droppedFields,
		draft,
	};
}
