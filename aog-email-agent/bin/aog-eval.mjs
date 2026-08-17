#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { ROOT, settings } from '../src/config.js';
import { classify } from '../src/classify.js';
import { extract } from '../src/extract.js';
import { generateDraft } from '../src/draft.js';
import { summarizeThread, checkSummary } from '../src/summarize.js';
import { lintDraft } from '../src/draftLint.js';
import { AccountError, MissingApiKeyError } from '../src/llm.js';
import { matches } from '../src/matchers.js';

/**
 * Scored runner for the model-backed suites (1, 2, 4, 5).
 *
 * The deterministic suites (3, 6, 7, 8, 9 and the draft lint) live in `npm test` and need
 * nothing but Node. This runner needs a model, so it is separate on purpose: routing being
 * unavailable should never stop the red-line checks from running in CI.
 *
 * Per the spec, every fixture runs three times. A case that does not agree with itself
 * across all three is reported FLAKY and counts as a failure, because a loose prompt is a
 * defect and not a testing artifact.
 *
 *   ANTHROPIC_API_KEY=...  node bin/aog-eval.mjs
 *   AOG_LLM_CACHE=1        node bin/aog-eval.mjs      # replay a recorded run
 *   node bin/aog-eval.mjs --suite routing --passes 1
 */

const PASSES = Number(argValue('--passes') ?? 3);
const ONLY = argValue('--suite');
const VERBOSE = process.argv.includes('--verbose');

function argValue(flag) {
	const index = process.argv.indexOf(flag);
	return index === -1 ? null : process.argv[index + 1];
}

const fixture = (name) => JSON.parse(readFileSync(join(ROOT, 'test', 'fixtures', name), 'utf8'));

const THRESHOLDS = {
	routing_accuracy: 0.92,
	recall_new_opportunity: 0.98,
	recall_opportunity_update: 0.95,
	recall_bid_outcome: 0.95,
	noise_leakage: 0,
	due_date_exact: 0.95,
	draft_lint_pass: 1.0,
	fabricated_commitment: 0,
};

// ---------------------------------------------------------------- suites

export async function runRouting() {
	const { cases } = fixture('routing.json');
	const results = [];

	for (const testCase of cases) {
		const observed = [];
		for (let pass = 0; pass < PASSES; pass++) {
			const { category } = await classify(testCase.email, { pass });
			observed.push(category);
		}

		const stable = new Set(observed).size === 1;
		const pass = stable && observed[0] === testCase.expect;

		results.push({
			id: testCase.id,
			expect: testCase.expect,
			observed,
			got: observed[0],
			stable,
			pass,
		});
	}

	const total = results.length;
	const correct = results.filter((r) => r.pass).length;

	const recallFor = (category) => {
		const relevant = results.filter((r) => r.expect === category);
		if (relevant.length === 0) return 1;
		return relevant.filter((r) => r.pass).length / relevant.length;
	};

	// Red line. Any fixture whose true bin carries a solicitation must never be observed,
	// on any pass, as Noise.
	const leakage = results.filter(
		(r) =>
			['New Opportunity', 'Opportunity Update', 'Bid Outcome'].includes(r.expect) &&
			r.observed.includes('Low Priority / Noise'),
	);

	return {
		name: 'Suite 1: Routing',
		results,
		metrics: [
			metric('Overall accuracy', correct / total, THRESHOLDS.routing_accuracy),
			metric('Recall, New Opportunity', recallFor('New Opportunity'), THRESHOLDS.recall_new_opportunity),
			metric('Recall, Opportunity Update', recallFor('Opportunity Update'), THRESHOLDS.recall_opportunity_update),
			metric('Recall, Bid Outcome', recallFor('Bid Outcome'), THRESHOLDS.recall_bid_outcome),
			metric('RED LINE solicitation leaked to Noise', leakage.length, THRESHOLDS.noise_leakage, 'max'),
		],
	};
}

export async function runExtraction() {
	const routing = fixture('routing.json');
	const { cases, referenceDate } = fixture('extraction.json');
	const byId = new Map(routing.cases.map((c) => [c.id, c]));

	const results = [];

	for (const testCase of cases) {
		const input = testCase.email ?? byId.get(testCase.inputFrom)?.email;
		if (!input) throw new Error(`${testCase.id} references unknown fixture ${testCase.inputFrom}`);

		const observed = [];
		for (let pass = 0; pass < PASSES; pass++) {
			const { extracted } = await extract(input, { pass });
			observed.push(extracted);
		}

		const fieldResults = Object.entries(testCase.expect).map(([field, expected]) => ({
			field,
			pass: observed.every((o) => matches(o[field], expected, referenceDate)),
			expected,
			got: observed[0][field],
		}));

		const stable = new Set(observed.map((o) => JSON.stringify(o))).size === 1;

		results.push({
			id: testCase.id,
			fields: fieldResults,
			stable,
			pass: fieldResults.every((f) => f.pass),
		});
	}

	const dateFields = results.flatMap((r) =>
		r.fields.filter((f) => ['due_date', 'primary_due_date', 'other_dates'].includes(f.field)),
	);
	const dateAccuracy = dateFields.length
		? dateFields.filter((f) => f.pass).length / dateFields.length
		: 1;

	// Red line: a stated deadline recorded as null.
	const swallowed = results.flatMap((r) =>
		r.fields.filter((f) => f.field === 'due_date' && f.expected !== null && f.got === null),
	);

	return {
		name: 'Suite 2: Extraction',
		results,
		metrics: [
			metric('Field accuracy', results.filter((r) => r.pass).length / results.length, 0.95),
			metric('Due-date exact match', dateAccuracy, THRESHOLDS.due_date_exact),
			metric('RED LINE real deadline recorded as null', swallowed.length, 0, 'max'),
		],
	};
}

export async function runThreadSummary() {
	const { cases } = fixture('thread-summary.json');
	const results = [];

	for (const testCase of cases) {
		const observed = [];
		for (let pass = 0; pass < PASSES; pass++) {
			const { summary } = await summarizeThread(testCase.thread, { pass });
			observed.push(summary);
		}

		// Every number in the thread, so "any count not in the thread" is checkable rather
		// than aspirational.
		const threadNumbers = new Set(
			testCase.thread.messages.flatMap((m) => m.body.match(/\b\d+\b/g) ?? []),
		);

		const checks = observed.map((summary) => {
			const base = checkSummary(summary, {
				contains: testCase.expect.contains ?? [],
				maxWords: testCase.expect.maxWords ?? null,
			});

			const failures = [...base.failures];

			if (testCase.expect.absentNumbers) {
				for (const number of summary.match(/\b\d+\b/g) ?? []) {
					if (!threadNumbers.has(number)) {
						failures.push({ rule: 'invented_number', detail: `summary states "${number}", the thread never does` });
					}
				}
			}

			for (const banned of testCase.expect.absentAsCurrentPlan ?? []) {
				// The old number may appear as history, never as the plan.
				const pattern = new RegExp(`(?:is|are|now|plan(?:ned)? (?:on|for)|go with|settled on)\\s+${banned}`, 'i');
				if (pattern.test(summary)) {
					failures.push({ rule: 'stale_plan', detail: `summary presents "${banned}" as the current plan` });
				}
			}

			return { summary, pass: failures.length === 0, failures };
		});

		results.push({
			id: testCase.id,
			checks,
			stable: new Set(observed).size === 1,
			pass: checks.every((c) => c.pass),
		});
	}

	return {
		name: 'Suite 4: Thread summary',
		results,
		metrics: [metric('Contains-check pass', results.filter((r) => r.pass).length / results.length, 1.0)],
	};
}

export async function runDraft() {
	const routing = fixture('routing.json');
	const { cases } = fixture('draft.json');
	const byId = new Map(routing.cases.map((c) => [c.id, c]));

	const results = [];

	for (const testCase of cases) {
		const input = testCase.email ?? byId.get(testCase.inputFrom)?.email;
		if (!input) throw new Error(`${testCase.id} references unknown fixture ${testCase.inputFrom}`);

		const observed = [];

		for (let pass = 0; pass < PASSES; pass++) {
			// Extraction feeds the drafter, exactly as it does in the workflow. An override
			// lets DRV-02 pin response_needed without spending a call.
			let extracted;
			if (testCase.extractedOverride && Object.hasOwn(testCase.extractedOverride, 'response_needed')) {
				extracted = { requested_items: [], other_dates: [], ...testCase.extractedOverride };
			} else {
				({ extracted } = await extract(input, { pass, category: testCase.category }));
			}

			const result = await generateDraft(
				{ input, category: testCase.category, extracted },
				{ pass },
			);

			const failures = [];

			if (result.drafted !== testCase.expect.drafted) {
				failures.push({ rule: 'wrong_gate', detail: `drafted=${result.drafted}, expected ${testCase.expect.drafted}` });
			}

			if (result.drafted) {
				const lint = result.lint ?? lintDraft(result.body ?? '');
				if (testCase.expect.lintPass && !lint.pass) {
					failures.push(...lint.violations);
				}

				for (const pattern of testCase.expect.absentPatterns ?? []) {
					if (new RegExp(pattern, 'i').test(result.body ?? '')) {
						failures.push({ rule: 'banned_pattern', detail: `draft matches /${pattern}/` });
					}
				}

				if (testCase.expect.defersPricing) {
					const defers = /(price|pricing|number|quote|cost)/i.test(result.body ?? '') &&
						/(get back|follow up|come back|send|have (?:it|that) to you|shortly|today|tomorrow|by )/i.test(result.body ?? '');
					if (!defers) {
						failures.push({ rule: 'no_deferral', detail: 'draft neither quotes a price nor promises one' });
					}
				}
			}

			observed.push({ pass: failures.length === 0, failures, body: result.body, drafted: result.drafted });
		}

		results.push({
			id: testCase.id,
			observed,
			stable: new Set(observed.map((o) => o.drafted)).size === 1,
			pass: observed.every((o) => o.pass),
		});
	}

	const lintPassRate =
		results.flatMap((r) => r.observed).filter((o) => o.pass).length /
		results.flatMap((r) => r.observed).length;

	const fabrications = results
		.flatMap((r) => r.observed)
		.flatMap((o) => o.failures)
		.filter((f) => f.rule === 'fabricated_price' || f.rule === 'banned_pattern');

	return {
		name: 'Suite 5: Draft reply',
		results,
		metrics: [
			metric('Guardrail lint pass', lintPassRate, THRESHOLDS.draft_lint_pass),
			metric('RED LINE fabricated commitment', fabrications.length, THRESHOLDS.fabricated_commitment, 'max'),
		],
	};
}

// ---------------------------------------------------------------- reporting

export function metric(label, value, bar, direction = 'min') {
	const pass = direction === 'min' ? value >= bar - 1e-9 : value <= bar + 1e-9;
	return { label, value, bar, direction, pass };
}

const pct = (n) => `${(n * 100).toFixed(1)}%`;

export function report(suite) {
	console.log(`\n${suite.name}`);
	console.log('-'.repeat(suite.name.length));

	for (const result of suite.results) {
		const mark = result.pass ? 'PASS' : 'FAIL';
		const flaky = result.stable === false ? '  FLAKY across passes' : '';
		const detail =
			result.got && !result.pass ? `  expected ${result.expect}, got ${result.got}` : '';
		console.log(`  ${mark}  ${result.id}${detail}${flaky}`);

		if (VERBOSE && !result.pass) {
			console.log(`        ${JSON.stringify(result, null, 2).replace(/\n/g, '\n        ')}`);
		}
	}

	console.log('');
	for (const m of suite.metrics) {
		const shown = m.direction === 'max' ? String(m.value) : pct(m.value);
		const bar = m.direction === 'max' ? `<= ${m.bar}` : `>= ${pct(m.bar)}`;
		console.log(`  ${m.pass ? 'PASS' : 'FAIL'}  ${m.label}: ${shown} (bar ${bar})`);
	}

	return suite.metrics.every((m) => m.pass);
}

// ---------------------------------------------------------------- main

const SUITES = {
	routing: runRouting,
	extraction: runExtraction,
	summary: runThreadSummary,
	draft: runDraft,
};

export async function main() {
	const names = ONLY ? [ONLY] : Object.keys(SUITES);

	console.log(`AOG email agent eval`);
	console.log(
		`model: ${settings.llm.classifierModel}  effort: ${settings.llm.effort.classifier}  passes: ${PASSES}`,
	);

	let allPassed = true;

	for (const name of names) {
		const runner = SUITES[name];
		if (!runner) {
			console.error(`unknown suite "${name}". known: ${Object.keys(SUITES).join(', ')}`);
			process.exitCode = 2;
			return;
		}

		const suite = await runner();
		// The spec gates each layer on the one above it. A shaky router makes every number
		// below it meaningless, so stop rather than print noise.
		if (!report(suite)) {
			allPassed = false;
			console.log(`\n${suite.name} is below its bar. Fix it before reading the suites underneath.`);
			break;
		}
	}

	console.log(`\n${allPassed ? 'All measured suites are at or above their bars.' : 'Below bar.'}`);
	process.exitCode = allPassed ? 0 : 1;
}

// Only drive the CLI when invoked directly. Importing this module (the runner's own test
// does) must not run a suite or stamp process.exitCode.
const invokedDirectly =
	process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
	main().catch((error) => {
		if (error instanceof AccountError) {
			console.error(`\nCannot run: ${error.message}`);
			process.exitCode = 4;
			return;
		}
		if (error instanceof MissingApiKeyError) {
			console.error(`\n${error.message}`);
			process.exitCode = 3;
			return;
		}
		console.error(error);
		process.exitCode = 1;
	});
}
