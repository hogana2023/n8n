/**
 * Expectation matchers for the fixture files.
 *
 * The spec splits checks into exact-match (category, dates, flags, tier) and contains-check
 * (summaries, drafts). These handle the exact-match side, with three escape hatches for the
 * places the spec itself is loose:
 *
 *   {"$contains": "Example ISD"}          the spec writes client_name as a name, not a string
 *   {"$setContains": [...]}               EXT-05 lists items without pinning their wording
 *   {"$nextWeekday": "friday"}            EXT-05 says "(upcoming Friday, resolved)"
 *
 * Dates compare by prefix so an expectation of "2026-02-03" is satisfied by
 * "2026-02-03T00:00", and an expectation carrying a time is not satisfied by a bare date.
 */

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** Next occurrence of a weekday strictly after the reference date. */
export function nextWeekday(referenceDate, weekday) {
	const target = WEEKDAYS.indexOf(String(weekday).toLowerCase());
	if (target === -1) throw new Error(`unknown weekday "${weekday}"`);

	const base = new Date(`${referenceDate}${/[Zz]|[+-]\d{2}:?\d{2}$/.test(referenceDate) ? '' : 'Z'}`);
	if (Number.isNaN(base.getTime())) throw new Error(`unparseable reference date "${referenceDate}"`);

	const ahead = (target - base.getUTCDay() + 7) % 7 || 7;
	return new Date(base.getTime() + ahead * 86_400_000).toISOString().slice(0, 10);
}

export const norm = (v) => String(v ?? '').trim().toLowerCase();

export function dateMatches(actual, expected) {
	if (expected === null) return actual === null || actual === undefined;
	if (!actual) return false;
	return String(actual).startsWith(String(expected));
}

const isDateish = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v);

export function matches(actual, expected, referenceDate) {
	if (expected === null) return actual === null || actual === undefined;

	if (Array.isArray(expected)) {
		if (!Array.isArray(actual) || actual.length !== expected.length) return false;
		return expected.every((item, i) => matches(actual[i], item, referenceDate));
	}

	if (expected && typeof expected === 'object') {
		if ('$contains' in expected) return norm(actual).includes(norm(expected.$contains));

		if ('$setContains' in expected) {
			if (!Array.isArray(actual)) return false;
			const have = actual.map(norm);
			return expected.$setContains.every((needle) =>
				have.some((item) => item.includes(norm(needle)) || norm(needle).includes(item)),
			);
		}

		if ('$nextWeekday' in expected) {
			return dateMatches(actual, nextWeekday(referenceDate, expected.$nextWeekday));
		}

		if (actual === null || actual === undefined || typeof actual !== 'object') return false;

		return Object.entries(expected).every(([key, value]) => matches(actual[key], value, referenceDate));
	}

	if (isDateish(expected)) return dateMatches(actual, expected);

	return norm(actual) === norm(expected);
}
