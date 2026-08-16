import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildDailySummary } from '../src/dailySummary.js';
import { settings } from '../src/config.js';

const NOW = '2026-01-15T18:00:00';
const TODAY = '2026-01-15T09:00:00';
const YESTERDAY = '2026-01-13T09:00:00';

const record = (overrides) => ({
	processed_at: TODAY,
	subject: 'subject',
	from: 'someone@example.com',
	category: 'Unclassified',
	tier: { priority_tier: 'unknown' },
	extracted: { other_dates: [], requested_items: [] },
	...overrides,
});

/** One record per bin, so SUMX-01 exercises all nine categories in a single day. */
const fullDay = () => [
	record({
		category: 'New Opportunity',
		subject: 'ITB 26-118 Geotechnical Investigation, New Elementary',
		from: 'purchasing@example-isd.org',
		tier: { priority_tier: 'client' },
		extracted: {
			project_name: 'New Elementary',
			bid_reference: 'ITB 26-118',
			client_name: 'Example ISD',
			due_date: '2026-02-14T14:00',
			primary_due_date: '2026-02-14T14:00',
			other_dates: [{ label: 'pre-bid', date: '2026-02-03' }],
			response_needed: true,
			project_stage: 'proposal requested',
		},
	}),
	record({ category: 'Opportunity Update', extracted: { other_dates: [], project_name: 'Riverside Detention' } }),
	record({
		category: 'Bid Outcome',
		extracted: { other_dates: [], project_name: 'Well Field Access Road', response_needed: true },
	}),
	record({
		category: 'Active Project',
		from: 'pm@gc-example.com',
		tier: { priority_tier: 'key_client' },
		extracted: { other_dates: [], project_name: 'Oakmont Logistics', action_summary: 'Confirm crew mobilization.' },
	}),
	record({ category: 'Client & Network', from: 'principal@arch-example.com', tier: { priority_tier: 'key_client' }, extracted: { other_dates: [] } }),
	record({ category: 'Internal / Team', from: 'garic@alphaomega-example.com', tier: { priority_tier: 'internal' }, extracted: { other_dates: [] } }),
	record({ category: 'Compliance & Docs', from: 'subcontracts@gc-example.com', tier: { priority_tier: 'key_client' }, extracted: { other_dates: [] } }),
	record({ category: 'Low Priority / Noise', from: 'news@arch-example.com', tier: { priority_tier: 'key_client' }, extracted: { other_dates: [] } }),
	record({ category: 'Unclassified', extracted: { other_dates: [] } }),
];

describe('Suite 8: daily executive summary', () => {
	it('SUMX-01 a day spanning all nine categories produces all five sections', () => {
		const summary = buildDailySummary(fullDay(), { now: NOW });

		assert.deepEqual(
			summary.sections.map((s) => s.title),
			settings.dailySummary.sections,
		);
		assert.equal(summary.sections.length, 5);
	});

	it('SUMX-02 CLS-01 lands under New Opportunities and its 2/14 date under Critical Deadlines', () => {
		const summary = buildDailySummary(fullDay(), { now: NOW });

		const opportunities = summary.sections.find((s) => s.title === 'New Opportunities');
		assert.equal(opportunities.items.length, 1);
		assert.match(opportunities.text, /New Elementary/);

		const deadlines = summary.sections.find((s) => s.title === 'Critical Deadlines');
		assert.ok(
			deadlines.items.some((d) => d.date.startsWith('2026-02-14')),
			`2/14 missing from Critical Deadlines: ${deadlines.text}`,
		);
	});

	it('SUMX-03 a day with no new opportunities says so instead of vanishing or padding', () => {
		const quiet = fullDay().filter((r) => r.category !== 'New Opportunity');
		const summary = buildDailySummary(quiet, { now: NOW });

		const section = summary.sections.find((s) => s.title === 'New Opportunities');

		assert.ok(section, 'section was omitted');
		assert.equal(section.empty, true);
		assert.equal(section.items.length, 0);
		assert.equal(section.text, settings.dailySummary.emptySectionText);
		assert.match(summary.text, /New Opportunities\nNone\./);
	});

	it('does not pad an empty day with yesterday', () => {
		const stale = fullDay().map((r) => ({ ...r, processed_at: YESTERDAY }));
		const summary = buildDailySummary(stale, { now: NOW });

		for (const section of summary.sections) {
			assert.equal(section.items.length, 0, `${section.title} carried over old items`);
		}
	});

	it('the key client marketing blast stays out of High-Priority Comms', () => {
		// PRI-04 again, one layer down. The tier is key_client and the bin is Noise, and the
		// brief follows the bin.
		const summary = buildDailySummary(fullDay(), { now: NOW });
		const comms = summary.sections.find((s) => s.title === 'High-Priority Comms');

		assert.ok(!comms.items.some((i) => i.category === 'Low Priority / Noise'));
		assert.ok(comms.items.length > 0);
	});

	it('outstanding follow-ups come from the stale job, not from the day of mail', () => {
		const summary = buildDailySummary(fullDay(), {
			now: NOW,
			staleFollowUps: [
				{ to: 'pm@gc-example.com', subject: 'Southgate proposal', elapsed_days: 6, last_outbound_at: '2026-01-09T09:00:00Z' },
			],
		});

		const followUps = summary.sections.find((s) => s.title === 'Outstanding Follow-ups');
		assert.equal(followUps.items.length, 1);
		assert.match(followUps.text, /Southgate proposal/);
	});

	it('deadlines beyond the horizon are left out', () => {
		const far = [
			record({
				category: 'New Opportunity',
				extracted: { other_dates: [], due_date: '2027-06-01', primary_due_date: '2027-06-01' },
			}),
		];
		const deadlines = buildDailySummary(far, { now: NOW }).sections.find(
			(s) => s.title === 'Critical Deadlines',
		);
		assert.equal(deadlines.items.length, 0);
	});
});
