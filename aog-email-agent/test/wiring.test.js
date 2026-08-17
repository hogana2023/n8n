import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
	categories,
	explicitCategories,
	extractorSchema,
	fallbackCategory,
	prompts,
	settings,
} from '../src/config.js';
import { buildClassifierSystemPrompt, resolveCategory } from '../src/classify.js';
import { normalizeExtraction } from '../src/extract.js';
import { renderInput, stripQuoted } from '../src/email.js';

/**
 * Structural checks on the configuration itself. None of these need a model, and each one
 * closes a way the pipeline could quietly stop honouring a red line after an edit.
 */
describe('wiring and red lines', () => {
	it('there are exactly nine bins and exactly one of them is the fallback', () => {
		assert.equal(categories.length, 9);
		assert.equal(explicitCategories.length, 8);
		assert.equal(categories.filter((c) => c.fallback).length, 1);
		assert.equal(fallbackCategory.category, 'Unclassified');
	});

	it('every bin has its own Outlook folder', () => {
		const folders = categories.map((c) => c.folder);
		assert.equal(new Set(folders).size, 9);
		assert.ok(folders.every((f) => typeof f === 'string' && f.length > 0));
	});

	it('the classifier prompt names all eight explicit bins', () => {
		const prompt = buildClassifierSystemPrompt();
		for (const category of explicitCategories) {
			assert.ok(prompt.includes(category.category), `prompt is missing ${category.category}`);
		}
	});

	it('RED LINE: the prompt forbids routing a solicitation to Noise', () => {
		const prompt = buildClassifierSystemPrompt().toLowerCase();
		assert.ok(prompt.includes('never route'));
		assert.ok(prompt.includes('low priority / noise'));
		assert.ok(prompt.includes('costs you a bid') || prompt.includes('costs a bid'));
	});

	it('single-class routing is enforced in code, not left to the model', () => {
		// A model that hedges and marks two bins true still yields one bin, chosen by the
		// documented tie-break ladder rather than by object key order.
		const hedged = { 'New Opportunity': true, 'Opportunity Update': true };
		const resolved = resolveCategory(hedged);

		assert.equal(resolved.ambiguous, true);
		assert.equal(resolved.category, 'Opportunity Update', 'ladder puts updates above new work');
	});

	it('no category selected routes to Unclassified, never to nothing', () => {
		const resolved = resolveCategory({ 'New Opportunity': false, fallback: true });
		assert.equal(resolved.category, 'Unclassified');
		assert.equal(resolveCategory({}).category, 'Unclassified');
	});

	it('RED LINE: the extractor schema has no tier, priority or urgency field', () => {
		const fields = Object.keys(extractorSchema.properties);
		for (const banned of ['priority_tier', 'tier', 'priority', 'importance', 'urgency']) {
			assert.ok(!fields.includes(banned), `extractor schema exposes ${banned}`);
		}
	});

	it('RED LINE: a missing date normalizes to null, never to a guess', () => {
		const { extracted } = normalizeExtraction({ project_name: 'Somewhere' });
		assert.equal(extracted.due_date, null);
		assert.equal(extracted.primary_due_date, null);
		assert.deepEqual(extracted.other_dates, []);
	});

	it('due_date and primary_due_date stay in step whichever one the model fills', () => {
		assert.equal(normalizeExtraction({ due_date: '2026-02-14T14:00' }).extracted.primary_due_date, '2026-02-14T14:00');
		assert.equal(normalizeExtraction({ primary_due_date: '2026-02-14T14:00' }).extracted.due_date, '2026-02-14T14:00');
	});

	it('an intro target without an intro is dropped', () => {
		const { extracted } = normalizeExtraction({ intro_opportunity: false, intro_target: 'somebody' });
		assert.equal(extracted.intro_target, null);
	});

	it('RED LINE: the approval gate is on', () => {
		assert.equal(settings.integration.approvalGate, 'required');
		for (const [name, target] of Object.entries(settings.integration.targets)) {
			assert.equal(target.enabled, false, `${name} is wired live without a credential review`);
		}
	});

	it('noise and unclassified never get an auto-draft', () => {
		assert.ok(settings.drafts.neverCreateFor.includes('Low Priority / Noise'));
		assert.ok(settings.drafts.neverCreateFor.includes('Unclassified'));
		for (const category of settings.drafts.createFor) {
			assert.ok(!settings.drafts.neverCreateFor.includes(category), `${category} is on both lists`);
		}
	});

	it('drafts are saved, never sent', () => {
		assert.equal(settings.drafts.saveAsDraftOnly, true);
	});

	it('no sampling parameter is configured anywhere', () => {
		// Claude Sonnet 5 and Opus 5 reject temperature, top_p and top_k with a 400, so a
		// stray one is a broken pipeline rather than a tuning mistake. Checked on keys, not
		// on the serialized blob, because the $comment fields discuss these by name.
		const rejected = new Set(['temperature', 'topP', 'top_p', 'topK', 'top_k']);

		const walk = (value, path) => {
			if (!value || typeof value !== 'object') return;
			for (const [key, child] of Object.entries(value)) {
				if (key.startsWith('$comment')) continue;
				assert.ok(!rejected.has(key), `settings still carries ${path}${key}`);
				walk(child, `${path}${key}.`);
			}
		};

		walk(settings, '');
	});

	it('every model call site has an effort level', () => {
		for (const stage of ['classifier', 'extractor', 'summary', 'draft']) {
			assert.ok(
				['low', 'medium', 'high', 'xhigh', 'max'].includes(settings.llm.effort[stage]),
				`${stage} has no valid effort`,
			);
		}
	});

	it('the draft prompt bans prices and em dashes out loud', () => {
		const prompt = prompts.draft.toLowerCase();
		assert.ok(prompt.includes('no prices'));
		assert.ok(prompt.includes('no em dashes'));
		assert.ok(prompt.includes('contractions'));
	});

	it('the summary prompt tells the model to report the final state', () => {
		const prompt = prompts.summary.toLowerCase();
		assert.ok(prompt.includes('final form') || prompt.includes('where the thread landed'));
	});

	it('a thread renders oldest first with every message visible', () => {
		const rendered = renderInput({
			messages: [
				{ from: 'a@x.test', body: 'RFP attached, responses due 3/10.' },
				{ from: 'alex@x.test', body: 'Thanks, reviewing.' },
				{ from: 'a@x.test', body: 'Sounds good, talk soon.' },
			],
		});

		assert.ok(rendered.indexOf('RFP attached') < rendered.indexOf('Sounds good'));
		assert.ok(rendered.includes('message 1 of 3'));
	});

	it('quoted history is trimmed off the live message', () => {
		const body = 'Bid date moved to Friday.\n\nOn Mon, Jan 12, 2026, Dana wrote:\n> original request text';
		assert.equal(stripQuoted(body), 'Bid date moved to Friday.');
	});

	it('the extractor sees a reference date and the classifier does not', () => {
		const email = { from: 'a@x.test', subject: 's', body: 'b', receivedAt: '2026-01-15T09:00' };
		assert.ok(renderInput(email, { withReferenceDate: true }).startsWith('REFERENCE DATE:'));
		assert.ok(!renderInput(email).includes('REFERENCE DATE'));
	});
});
