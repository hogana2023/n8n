import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { findStaleThreads } from '../src/stale.js';

/** Day 0 is 2026-01-05, a Monday. */
const DAY0 = new Date('2026-01-05T09:00:00Z');
const day = (n, hour = 9) =>
	new Date(DAY0.getTime() + n * 86_400_000 + (hour - 9) * 3_600_000).toISOString();

const THRESHOLD = 5;

describe('Suite 6: stale follow-up', () => {
	it('STL-01 outbound on day 0, nothing back by day 6, surfaces', () => {
		const { surfaced } = findStaleThreads(
			[
				{
					threadId: 't1',
					direction: 'outbound',
					to: 'pm@gc-example.com',
					subject: 'Southgate proposal',
					date: day(0),
					category: 'New Opportunity',
					priority_tier: 'key_client',
				},
			],
			{ now: day(6), thresholdDays: THRESHOLD },
		);

		assert.equal(surfaced.length, 1);
		assert.equal(surfaced[0].threadId, 't1');
		assert.equal(surfaced[0].elapsed_days, 6);
	});

	it('STL-02 a reply on day 2 answers it, nothing surfaces', () => {
		const { surfaced, evaluated } = findStaleThreads(
			[
				{ threadId: 't2', direction: 'outbound', to: 'pm@gc-example.com', date: day(0) },
				{ threadId: 't2', direction: 'inbound', from: 'pm@gc-example.com', date: day(2) },
			],
			{ now: day(6), thresholdDays: THRESHOLD },
		);

		assert.equal(surfaced.length, 0);
		assert.match(evaluated[0].reason, /answered on 2026-01-07/);
	});

	it('STL-03 a reply from someone else on the same thread still counts as answered', () => {
		// Thread-aware matching. Matching on the original recipient would nag a thread that
		// already moved to a different person at the same company.
		const { surfaced, evaluated } = findStaleThreads(
			[
				{ threadId: 't3', direction: 'outbound', to: 'pm@gc-example.com', date: day(0) },
				{ threadId: 't3', direction: 'inbound', from: 'estimator@gc-example.com', date: day(3) },
			],
			{ now: day(9), thresholdDays: THRESHOLD },
		);

		assert.equal(surfaced.length, 0);
		assert.match(evaluated[0].reason, /estimator@gc-example\.com/);
	});

	it('a thread inside the threshold is left alone', () => {
		const { surfaced } = findStaleThreads(
			[{ threadId: 't4', direction: 'outbound', date: day(0) }],
			{ now: day(3), thresholdDays: THRESHOLD },
		);
		assert.equal(surfaced.length, 0);
	});

	it('a reply that predates the last outbound does not count as an answer', () => {
		// Someone replied, then AOG wrote again. The ball is back with them.
		const { surfaced } = findStaleThreads(
			[
				{ threadId: 't5', direction: 'outbound', date: day(0) },
				{ threadId: 't5', direction: 'inbound', from: 'pm@gc-example.com', date: day(1) },
				{ threadId: 't5', direction: 'outbound', date: day(2) },
			],
			{ now: day(9), thresholdDays: THRESHOLD },
		);

		assert.equal(surfaced.length, 1);
		assert.equal(surfaced[0].elapsed_days, 7);
	});

	it('a thread AOG never wrote on is not chased', () => {
		const { evaluated } = findStaleThreads(
			[{ threadId: 't6', direction: 'inbound', from: 'x@y.test', date: day(0) }],
			{ now: day(30), thresholdDays: THRESHOLD },
		);
		assert.equal(evaluated.length, 0);
	});

	it('noise is never chased no matter how long it sits', () => {
		const { surfaced } = findStaleThreads(
			[{ threadId: 't7', direction: 'outbound', date: day(0), category: 'Low Priority / Noise' }],
			{ now: day(60), thresholdDays: THRESHOLD },
		);
		assert.equal(surfaced.length, 0);
	});

	it('business-day counting is available and is stricter than calendar days', () => {
		const events = [{ threadId: 't8', direction: 'outbound', date: day(0) }];

		const calendar = findStaleThreads(events, { now: day(6), thresholdDays: 5, businessDaysOnly: false });
		const business = findStaleThreads(events, { now: day(6), thresholdDays: 5, businessDaysOnly: true });

		assert.equal(calendar.surfaced.length, 1);
		// Mon -> Sun is 4 working days, so the same window does not surface yet.
		assert.equal(business.surfaced.length, 0);
	});
});
