import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { processEmail } from '../src/pipeline.js';

/**
 * End-to-end composition, with the model stubbed at the transport.
 *
 * The unit suites prove each layer. This proves they are wired in the right order, which is
 * where the Suite 3 red line actually lives: a correct lookupTier() is worthless if the
 * extractor's output lands on top of it.
 */

const CLS01 = {
	from: 'purchasing@example-isd.org',
	subject: 'ITB 26-118 Geotechnical Investigation, New Elementary',
	body: 'Sealed bids due 2/14 at 2:00 PM. Plans and specs attached. Pre-bid 2/03.',
	receivedAt: '2026-01-15T09:00',
};

const EXTRACTION = {
	due_date: '2026-02-14T14:00',
	primary_due_date: '2026-02-14T14:00',
	other_dates: [{ label: 'pre-bid', date: '2026-02-03' }],
	date_in_attachment: false,
	project_name: 'New Elementary',
	client_name: 'Example ISD',
	bid_reference: 'ITB 26-118',
	project_stage: 'proposal requested',
	requested_items: ['bid'],
	response_needed: true,
	intro_opportunity: false,
	intro_target: null,
	action_summary: 'Submit a geotech bid for New Elementary by 2026-02-14.',
	// The extractor tries to set a tier. The pipeline must ignore it.
	priority_tier: 'vendor',
	urgency: 'low',
};

const DRAFT = `Hi there,

Got the ITB for the New Elementary geotech. We'll have a bid in before the 2/14 deadline, and I've put the 2/03 pre-bid on my calendar.

One question: are the boring locations in the plan set final?

Alex`;

function stub({ extraction = EXTRACTION, draft = DRAFT } = {}) {
	globalThis.fetch = async (_url, init) => {
		const payload = JSON.parse(init.body);
		const system = payload.system;

		// Matched on the opening line, not on a phrase anywhere in the prompt. The extractor
		// prompt also says "routing layer", so a substring test picks the wrong branch.
		let text;
		if (system.startsWith('You are the routing layer')) {
			text = JSON.stringify({ 'New Opportunity': true, fallback: false });
		} else if (system.startsWith('You pull facts')) {
			text = JSON.stringify(extraction);
		} else if (system.startsWith('You write reply drafts')) {
			text = draft;
		} else {
			throw new Error(`stub does not recognise this system prompt: ${system.slice(0, 60)}`);
		}

		return { ok: true, json: async () => ({ content: [{ type: 'text', text }] }) };
	};
}

describe('inbound pipeline composition', () => {
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

	it('routes, files, extracts and drafts in one pass', async () => {
		stub();
		const result = await processEmail(CLS01);

		assert.equal(result.category, 'New Opportunity');
		assert.equal(result.folder, 'AOG/01 New Opportunity');
		assert.equal(result.extracted.project_name, 'New Elementary');
		assert.equal(result.extracted.due_date, '2026-02-14T14:00');
		assert.equal(result.draft.drafted, true);
		assert.equal(result.draft.lint.pass, true);
	});

	it('RED LINE: the extractor cannot overwrite the tier the table set', async () => {
		stub();
		const result = await processEmail(CLS01);

		// contacts.json puts purchasing@example-isd.org on `client`. The stubbed extractor
		// claimed `vendor`.
		assert.equal(result.tier.priority_tier, 'client');
		assert.equal(result.tier.tier_source, 'lookup');
		assert.equal(result.extracted.priority_tier, undefined);
		assert.equal(result.extracted.urgency, undefined);
		assert.deepEqual(result.dropped_model_fields.sort(), ['priority_tier', 'urgency']);
	});

	it('a draft that invents a price is withheld rather than filed', async () => {
		stub({
			draft: "Hi there,\n\nWe'll do the borings at $2,400 and have the bid in by 2/14.\n\nAlex",
		});

		const result = await processEmail(CLS01);

		assert.equal(result.draft.drafted, false);
		assert.match(result.draft.reason, /lint failed twice/);
		assert.equal(result.draft.body, null);
		assert.ok(result.draft.rejected_body.includes('$2,400'), 'the rejected text is kept for review');
	});

	it('no draft is written when the extractor says nobody is waiting', async () => {
		stub({ extraction: { ...EXTRACTION, response_needed: false } });

		const result = await processEmail(CLS01);

		assert.equal(result.draft.drafted, false);
		assert.equal(result.draft.reason, 'response_needed is false');
		assert.equal(result.draft.attempts, 0, 'a refused draft must not spend a model call');
	});
});
