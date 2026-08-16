import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { matches, nextWeekday, dateMatches } from '../src/matchers.js';

const REF = '2026-01-15T09:00';

/**
 * The eval harness's verdicts are only worth as much as these are. A matcher that is too
 * loose turns the whole scorecard into theatre, so the sloppy-pass cases below matter more
 * than the happy paths.
 */
describe('fixture matchers', () => {
	it('resolves the upcoming Friday from a Thursday reference date', () => {
		assert.equal(nextWeekday(REF, 'friday'), '2026-01-16');
	});

	it('a weekday that equals the reference day resolves to next week, not today', () => {
		assert.equal(nextWeekday(REF, 'thursday'), '2026-01-22');
	});

	it('rejects a weekday it does not recognise instead of silently passing', () => {
		assert.throws(() => nextWeekday(REF, 'sometime'), /unknown weekday/);
	});

	it('a date expectation is satisfied by a more precise actual', () => {
		assert.equal(dateMatches('2026-02-03T00:00', '2026-02-03'), true);
	});

	it('a date expectation carrying a time is not satisfied by a bare date', () => {
		assert.equal(dateMatches('2026-02-14', '2026-02-14T14:00'), false);
	});

	it('EXT-01 exact date matches, a wrong year does not', () => {
		assert.equal(matches('2026-02-14T14:00', '2026-02-14T14:00', REF), true);
		assert.equal(matches('2027-02-14T14:00', '2026-02-14T14:00', REF), false);
	});

	it('RED LINE: a null actual never satisfies a real expected date', () => {
		assert.equal(matches(null, '2026-02-14T14:00', REF), false);
	});

	it('an expected null is satisfied only by null or undefined', () => {
		assert.equal(matches(null, null, REF), true);
		assert.equal(matches(undefined, null, REF), true);
		assert.equal(matches('2026-02-14', null, REF), false);
	});

	it('$contains is case and whitespace tolerant', () => {
		assert.equal(matches('  example isd  ', { $contains: 'Example ISD' }, REF), true);
		assert.equal(matches('Example County', { $contains: 'Example ISD' }, REF), false);
	});

	it('EXT-05 $setContains accepts free wording but demands every item', () => {
		const got = [
			'Certificate of Insurance',
			'three references',
			'current prequalification form',
			'fee schedule',
		];
		const want = {
			$setContains: ['certificate of insurance', 'references', 'prequalification form', 'fee schedule'],
		};

		assert.equal(matches(got, want, REF), true);
		assert.equal(matches(got.slice(0, 3), want, REF), false);
		assert.equal(matches('not an array', want, REF), false);
	});

	it('EXT-05 resolves the Friday deadline rather than hardcoding it', () => {
		assert.equal(matches('2026-01-16', { $nextWeekday: 'friday' }, REF), true);
		assert.equal(matches('2026-01-23', { $nextWeekday: 'friday' }, REF), false);
	});

	it('EXT-03 other_dates match element by element', () => {
		const got = [{ label: 'pre-bid meeting', date: '2026-02-03' }];
		const want = [{ label: { $contains: 'pre-bid' }, date: '2026-02-03' }];

		assert.equal(matches(got, want, REF), true);
	});

	it('an extra unexpected date in other_dates fails the case', () => {
		const got = [
			{ label: 'pre-bid', date: '2026-02-03' },
			{ label: 'questions due', date: '2026-01-30' },
		];
		const want = [{ label: { $contains: 'pre-bid' }, date: '2026-02-03' }];

		assert.equal(matches(got, want, REF), false);
	});

	it('an object expectation is not satisfied by a scalar', () => {
		assert.equal(matches('pre-bid', { label: { $contains: 'pre-bid' } }, REF), false);
		assert.equal(matches(null, { label: 'x' }, REF), false);
	});

	it('booleans compare strictly enough that false does not pass for true', () => {
		assert.equal(matches(true, true, REF), true);
		assert.equal(matches(false, true, REF), false);
	});

	it('requested_items compare in order when written as a plain array', () => {
		assert.equal(matches(['bid'], ['bid'], REF), true);
		assert.equal(matches(['bid', 'references'], ['bid'], REF), false);
	});
});
