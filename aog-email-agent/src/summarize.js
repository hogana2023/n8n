import { renderThread } from './email.js';
import { callModel } from './llm.js';
import { prompts, settings } from './config.js';

/**
 * Thread summary. Suite 4.
 *
 * Contains-check only, so the value here is in what the summary is forbidden to invent.
 * SUM-02 is the real test: a thread that reversed itself has to report where it landed,
 * not an average. The prompt says that outright rather than hoping the model infers it
 * from message order.
 */

export async function summarizeThread(thread, opts = {}) {
	const text = await callModel({
		system: prompts.summary,
		user: renderThread(thread),
		model: opts.model ?? settings.llm.summaryModel,
		temperature: settings.llm.temperature,
		maxTokens: 512,
		pass: opts.pass ?? 0,
	});

	return { summary: text.trim(), wordCount: (text.match(/[A-Za-z][A-Za-z'-]*/g) ?? []).length };
}

/**
 * The Suite 4 checker. `contains` are required facts, `absent` are banned ones.
 * Both are matched loosely on purpose, since the spec says free wording is fine.
 */
export function checkSummary(summary, { contains = [], absent = [], maxWords = null } = {}) {
	const haystack = summary.toLowerCase().replace(/\s+/g, ' ');
	const failures = [];

	for (const needle of contains) {
		if (!haystack.includes(String(needle).toLowerCase())) {
			failures.push({ rule: 'missing_fact', detail: `summary does not mention "${needle}"` });
		}
	}

	for (const needle of absent) {
		if (haystack.includes(String(needle).toLowerCase())) {
			failures.push({ rule: 'banned_fact', detail: `summary mentions "${needle}"` });
		}
	}

	const wordCount = (summary.match(/[A-Za-z][A-Za-z'-]*/g) ?? []).length;
	if (maxWords && wordCount > maxWords) {
		failures.push({ rule: 'too_long', detail: `${wordCount} words, limit ${maxWords}` });
	}

	return { pass: failures.length === 0, failures, wordCount };
}
