import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { lintDraft } from '../src/draftLint.js';
import { shouldDraft } from '../src/draft.js';

const rules = (result) => result.violations.map((v) => v.rule);

const GOOD = `Hi Dana,

Got the ITB for the New Elementary geotech. We'll have a bid in before the 2/14 deadline, and I've put the 2/03 pre-bid on my calendar.

One thing I need: confirm whether the boring locations in the plan set are final, or if they're still moving.

Alex`;

describe('Suite 5: draft reply guardrails', () => {
	it('DRV-01 a clean draft passes the lint', () => {
		const result = lintDraft(GOOD, { sourceText: 'ITB 26-118 New Elementary, bids due 2/14, pre-bid 2/03' });
		assert.equal(result.pass, true, JSON.stringify(result.violations, null, 2));
	});

	it('DRV-02 a vendor blast with response_needed false never reaches the drafter', () => {
		const gate = shouldDraft({
			category: 'Low Priority / Noise',
			extracted: { response_needed: false },
		});
		assert.equal(gate.draft, false);
	});

	it('noise is refused even when the extractor thinks a response is needed', () => {
		const gate = shouldDraft({
			category: 'Low Priority / Noise',
			extracted: { response_needed: true },
		});
		assert.equal(gate.draft, false);
	});

	it('a bid outcome is left for Alex to answer himself', () => {
		const gate = shouldDraft({ category: 'Bid Outcome', extracted: { response_needed: true } });
		assert.equal(gate.draft, false);
	});

	it('a real opportunity does get drafted', () => {
		const gate = shouldDraft({ category: 'New Opportunity', extracted: { response_needed: true } });
		assert.equal(gate.draft, true);
	});

	it('DRV-03 RED LINE: a dollar figure the thread never mentioned fails the lint', () => {
		const fabricated = `Hi Dana,

We can do the six borings at $1,850 each. I'll send the PO paperwork over today.

Alex`;
		const result = lintDraft(fabricated, {
			sourceText: "Before I write the PO, what's your price for the borings?",
		});

		assert.equal(result.pass, false);
		assert.ok(rules(result).includes('fabricated_price'));
	});

	it('a per-unit rate is caught even without a dollar sign', () => {
		const result = lintDraft("Hi Dana,\n\nIt's 42.50 per foot on this one.\n\nAlex", {
			sourceText: 'what is your price',
		});
		assert.ok(rules(result).includes('fabricated_price'));
	});

	it('a figure the sender themselves quoted is allowed back', () => {
		const result = lintDraft(
			"Hi Dana,\n\nYou mentioned $1,200 for mobilization. That's workable, and I'll confirm the rest once I've priced the borings.\n\nAlex",
			{ sourceText: 'We budgeted $1,200 for mobilization, does that work?' },
		);
		assert.ok(!rules(result).includes('fabricated_price'), JSON.stringify(result.violations));
	});

	it('a draft that defers pricing cleanly passes', () => {
		const deferred = `Hi Dana,

Good to hear Southgate is moving. I don't have a number in front of me for the six borings at 30 ft, so let me price it properly and come back to you.

I'll have it to you before you cut the PO.

Alex`;
		const result = lintDraft(deferred, {
			sourceText: "Six borings, 30 ft each. Before I write the PO, what's your price for the borings?",
		});
		assert.equal(result.pass, true, JSON.stringify(result.violations, null, 2));
	});

	it('catches an em dash', () => {
		const result = lintDraft('Hi Dana,\n\nWe can do it — no problem at all.\n\nAlex');
		assert.ok(rules(result).includes('em_dash'));
	});

	it('catches banned vocabulary', () => {
		const result = lintDraft(
			"Hi Dana,\n\nWe'll leverage our robust process to streamline the borings.\n\nAlex",
		);
		const words = result.violations.filter((v) => v.rule === 'banned_word').map((v) => v.match);
		assert.deepEqual(words.sort(), ['leverage', 'robust', 'streamline']);
	});

	it('catches a draft with no contractions', () => {
		const stiff =
			'Hi Dana,\n\nWe have received the invitation to bid. We will submit prior to the stated deadline.\n\nAlex';
		assert.ok(rules(lintDraft(stiff)).includes('no_contractions'));
	});

	it('catches the throat-clearing opener and the bot closer', () => {
		const result = lintDraft(
			"Hi Dana,\n\nI hope this email finds you well. We'll get you a bid.\n\nPlease don't hesitate to reach out.\n\nAlex",
		);
		const phrases = result.violations.filter((v) => v.rule === 'banned_phrase').map((v) => v.match);
		assert.ok(phrases.includes('i hope this email finds you'));
		assert.ok(phrases.includes("please don't hesitate"));
	});

	it('catches "not just X, but Y"', () => {
		const result = lintDraft(
			"Hi Dana,\n\nThis isn't just a scheduling question, but a sequencing one.\n\nAlex",
		);
		assert.ok(rules(result).includes('not_just_x_but_y'));
	});

	it('catches a semicolon', () => {
		assert.ok(rules(lintDraft("Hi Dana,\n\nWe'll bid it; the date works.\n\nAlex")).includes('semicolon'));
	});

	it('catches an over-long draft', () => {
		const long = `Hi Dana, ${'we can handle that and it is fine '.repeat(30)} Alex`;
		assert.ok(rules(lintDraft(long, { maxWords: 150 })).includes('too_long'));
	});

	it('an empty draft fails rather than passing vacuously', () => {
		assert.equal(lintDraft('').pass, false);
		assert.equal(lintDraft('   ').pass, false);
	});
});
