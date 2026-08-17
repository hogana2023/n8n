import { renderInput } from './email.js';
import { callModel, parseJsonResponse } from './llm.js';
import { extractorSchema, prompts, settings } from './config.js';
import { stripModelTier } from './tier.js';

/**
 * Second-pass extraction. Suite 2.
 *
 * Runs after routing, on the same text the classifier saw plus a REFERENCE DATE line so
 * relative dates ("Friday", "2/14") resolve against when the mail arrived rather than
 * against whenever the job happens to run.
 *
 * Red line: "Any real deadline that the extractor records as 'no deadline'." The schema
 * pushes hard on that in both directions. A stated date must be captured. An absent date
 * must stay null with date_in_attachment set, because a null gets a human's attention and
 * an invented date does not.
 */

export function buildExtractorSystemPrompt() {
	return [
		prompts.extractor,
		'',
		'Output a single JSON object matching this schema and nothing else:',
		'',
		JSON.stringify(extractorSchema, null, 2),
	].join('\n');
}

const EMPTY = {
	due_date: null,
	primary_due_date: null,
	other_dates: [],
	date_in_attachment: false,
	project_name: null,
	client_name: null,
	bid_reference: null,
	project_stage: null,
	requested_items: [],
	response_needed: false,
	intro_opportunity: false,
	intro_target: null,
	action_summary: '',
};

/** Fill gaps and keep primary_due_date in step with due_date. */
export function normalizeExtraction(raw) {
	const { clean, removed } = stripModelTier(raw ?? {});
	const out = { ...EMPTY, ...clean };

	out.other_dates = Array.isArray(out.other_dates) ? out.other_dates : [];
	out.requested_items = Array.isArray(out.requested_items) ? out.requested_items : [];

	if (out.due_date && !out.primary_due_date) out.primary_due_date = out.due_date;
	if (out.primary_due_date && !out.due_date) out.due_date = out.primary_due_date;

	if (!out.intro_opportunity) out.intro_target = null;

	return { extracted: out, droppedFields: removed };
}

/**
 * @param {object} input email or thread fixture, needs receivedAt for date resolution
 * @param {object} [opts] {pass, model, category}
 */
export async function extract(input, opts = {}) {
	const system = buildExtractorSystemPrompt();
	const user = [
		opts.category ? `ROUTED AS: ${opts.category}` : null,
		renderInput(input, { withReferenceDate: true }),
	]
		.filter(Boolean)
		.join('\n\n');

	const text = await callModel({
		system,
		user,
		model: opts.model ?? settings.llm.extractorModel,
		effort: settings.llm.effort.extractor,
		pass: opts.pass ?? 0,
	});

	const { extracted, droppedFields } = normalizeExtraction(parseJsonResponse(text));

	return { extracted, droppedFields };
}
