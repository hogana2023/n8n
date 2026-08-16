import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { ROOT } from '../src/config.js';
import { runRouting } from '../bin/aog-eval.mjs';

/**
 * The eval runner decides whether the pipeline ships. A scorer that reports green no matter
 * what is worse than no scorer, so it gets tested too: once against a stub that answers
 * every fixture correctly, once against a stub that pushes a solicitation into Noise.
 *
 * The model is stubbed at the transport, so the real prompt building, JSON parsing,
 * single-class resolution, three-pass stability check and threshold arithmetic all run.
 */

const routing = JSON.parse(readFileSync(join(ROOT, 'test', 'fixtures', 'routing.json'), 'utf8'));

const CATEGORIES = [
	'New Opportunity',
	'Opportunity Update',
	'Bid Outcome',
	'Active Project',
	'Client & Network',
	'Internal / Team',
	'Compliance & Docs',
	'Low Priority / Noise',
];

const bodyOf = (email) => email.body ?? email.messages?.[0]?.body ?? '';

/** Stubs fetch so the classifier "answers" via a fixture lookup. */
function stubModel(decide) {
	const answers = routing.cases.map((c) => ({
		needle: bodyOf(c.email).slice(0, 40),
		expect: c.expect,
	}));

	globalThis.fetch = async (_url, init) => {
		const user = JSON.parse(init.body).messages[0].content;
		const hit = answers.find((a) => a.needle && user.includes(a.needle));
		const chosen = decide(hit?.expect ?? 'Unclassified', user);

		const out = Object.fromEntries(CATEGORIES.map((c) => [c, c === chosen]));
		out.fallback = chosen === 'Unclassified';

		return { ok: true, json: async () => ({ content: [{ type: 'text', text: JSON.stringify(out) }] }) };
	};
}

const metricNamed = (suite, fragment) => suite.metrics.find((m) => m.label.includes(fragment));

describe('eval runner', () => {
	let realFetch;
	let realKey;

	beforeEach(() => {
		realFetch = globalThis.fetch;
		realKey = process.env.ANTHROPIC_API_KEY;
		process.env.ANTHROPIC_API_KEY = 'stub-key';
		delete process.env.AOG_LLM_CACHE;
	});

	afterEach(() => {
		globalThis.fetch = realFetch;
		if (realKey === undefined) delete process.env.ANTHROPIC_API_KEY;
		else process.env.ANTHROPIC_API_KEY = realKey;
	});

	it('a perfect classifier clears every routing bar', async () => {
		stubModel((expected) => expected);
		const suite = await runRouting();

		assert.equal(suite.results.length, 14);
		assert.ok(suite.results.every((r) => r.pass));
		assert.ok(suite.metrics.every((m) => m.pass));
		assert.equal(metricNamed(suite, 'Overall accuracy').value, 1);
	});

	it('RED LINE: a solicitation pushed into Noise fails, even with the aggregate still over its bar', async () => {
		// Exactly the case the spec calls a ship blocker: one failure blocks release no
		// matter what the aggregate looks like.
		stubModel((expected, user) =>
			user.includes('Sealed bids due') ? 'Low Priority / Noise' : expected,
		);

		const suite = await runRouting();

		assert.equal(metricNamed(suite, 'leaked to Noise').value, 1);
		assert.equal(metricNamed(suite, 'leaked to Noise').pass, false);
		assert.equal(metricNamed(suite, 'Recall, New Opportunity').pass, false);

		// The aggregate survives. The red line is what stops it.
		assert.ok(metricNamed(suite, 'Overall accuracy').value > 0.92);
	});

	it('a case that disagrees with itself across passes is caught as flaky, not averaged', async () => {
		let call = 0;
		stubModel((expected) => {
			// CLS-01 answers correctly twice and wrongly once.
			if (expected === 'New Opportunity') return ++call === 2 ? 'Opportunity Update' : expected;
			return expected;
		});

		const suite = await runRouting();
		const flaky = suite.results.filter((r) => r.stable === false);

		assert.ok(flaky.length > 0, 'drift went unnoticed');
		assert.ok(flaky.every((r) => r.pass === false), 'a flaky case must not count as a pass');
	});

	it('a model that hedges on two bins still yields one bin', async () => {
		globalThis.fetch = async () => ({
			ok: true,
			json: async () => ({
				content: [
					{ type: 'text', text: JSON.stringify({ 'New Opportunity': true, 'Opportunity Update': true }) },
				],
			}),
		});

		const suite = await runRouting();
		assert.ok(suite.results.every((r) => typeof r.got === 'string' && r.got.length > 0));
	});

	it('a fenced JSON reply is parsed rather than failing the run', async () => {
		globalThis.fetch = async () => ({
			ok: true,
			json: async () => ({
				content: [
					{ type: 'text', text: '```json\n{"Low Priority / Noise": true}\n```' },
				],
			}),
		});

		const suite = await runRouting();
		assert.ok(suite.results.some((r) => r.got === 'Low Priority / Noise'));
	});

	it('thresholds match the spec table', () => {
		const bars = Object.fromEntries(
			[
				['Overall accuracy', 0.92],
				['Recall, New Opportunity', 0.98],
				['Recall, Opportunity Update', 0.95],
				['Recall, Bid Outcome', 0.95],
			],
		);

		stubModel((expected) => expected);
		return runRouting().then((suite) => {
			for (const [label, bar] of Object.entries(bars)) {
				assert.equal(metricNamed(suite, label).bar, bar, `${label} bar drifted`);
			}
			assert.equal(metricNamed(suite, 'leaked to Noise').bar, 0);
		});
	});
});
