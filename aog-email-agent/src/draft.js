import { renderInput } from './email.js';
import { callModel } from './llm.js';
import { lintDraft } from './draftLint.js';
import { prompts, settings } from './config.js';

/**
 * Reply drafting. Suite 5.
 *
 * Fires only when response_needed is true and the routed category is on the allow list.
 * DRV-02 is the case that matters here: a vendor sale blast produces no draft at all, and
 * "no draft" has to be a decision the pipeline makes before it spends a token, not
 * something a model talks itself out of.
 *
 * Every generated draft goes through lintDraft(). A draft that fails gets exactly one
 * regeneration with the violations fed back, then it is handed to a human unwritten. The
 * spec's bar is 1.00 on the lint, so shipping a failing draft is never an option.
 */

export function shouldDraft({ category, extracted }) {
	const cfg = settings.drafts;

	if (cfg.neverCreateFor.includes(category)) {
		return { draft: false, reason: `${category} is on the never-draft list` };
	}
	if (!extracted?.response_needed) {
		return { draft: false, reason: 'response_needed is false' };
	}
	if (!cfg.createFor.includes(category)) {
		return { draft: false, reason: `${category} is not on the auto-draft list` };
	}
	return { draft: true, reason: 'response needed and category is on the auto-draft list' };
}

function buildUserPrompt(input, extracted, retryViolations) {
	const facts = [
		`due date: ${extracted.due_date ?? 'none stated'}`,
		`project: ${extracted.project_name ?? 'not named'}`,
		`client: ${extracted.client_name ?? 'not named'}`,
		`they are asking for: ${extracted.requested_items?.length ? extracted.requested_items.join(', ') : 'nothing specific'}`,
		`stage: ${extracted.project_stage ?? 'unknown'}`,
	].join('\n');

	const parts = [
		'EMAIL TO REPLY TO:',
		'',
		renderInput(input),
		'',
		'FACTS ALREADY EXTRACTED (this is everything you know):',
		'',
		facts,
		'',
		`Sign off as ${settings.mailbox.signOff}.`,
	];

	if (retryViolations?.length) {
		parts.push(
			'',
			'Your previous draft was rejected. Fix these and rewrite:',
			...retryViolations.map((v) => `- ${v.detail}`),
		);
	}

	return parts.join('\n');
}

/**
 * @param {object} args
 * @param {object} args.input      email or thread
 * @param {string} args.category
 * @param {object} args.extracted
 * @param {object} [opts] {pass, model}
 * @returns {Promise<{drafted: boolean, reason: string, body: string|null, lint: object|null, attempts: number}>}
 */
export async function generateDraft({ input, category, extracted }, opts = {}) {
	const gate = shouldDraft({ category, extracted });
	if (!gate.draft) {
		return { drafted: false, reason: gate.reason, body: null, lint: null, attempts: 0 };
	}

	const system = prompts.draft;
	const sourceText = renderInput(input);
	let violations = null;
	let last = null;

	for (let attempt = 1; attempt <= 2; attempt++) {
		const body = await callModel({
			system,
			user: buildUserPrompt(input, extracted, violations),
			model: opts.model ?? settings.llm.draftModel,
			temperature: settings.llm.temperature,
			pass: (opts.pass ?? 0) * 10 + attempt,
		});

		const lint = lintDraft(body, { sourceText, maxWords: settings.drafts.maxWords });
		last = { body, lint, attempts: attempt };

		if (lint.pass) {
			return { drafted: true, reason: gate.reason, body, lint, attempts: attempt };
		}
		violations = lint.violations;
	}

	// Two failed attempts. Nothing goes in the drafts folder.
	return {
		drafted: false,
		reason: `lint failed twice: ${last.lint.violations.map((v) => v.rule).join(', ')}`,
		body: null,
		rejected_body: last.body,
		lint: last.lint,
		attempts: last.attempts,
	};
}
