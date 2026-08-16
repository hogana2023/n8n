import { settings } from './config.js';
import { parseAddress } from './tier.js';

/**
 * Stale follow-up detection. Suite 6.
 *
 * Runs on a timer against sent-versus-received state, not on the classifier. The rule is
 * per thread, never per message: the last thing AOG sent is stale when nothing has come
 * back on that conversation since, and enough time has passed.
 *
 * STL-03 is the case that decides the shape of this. A reply from a different person on
 * the same thread answers the thread. Matching on the original recipient's address would
 * nag a conversation that already moved, so matching is on conversation id only.
 */

const DAY_MS = 86_400_000;

const toTime = (value) => (value instanceof Date ? value.getTime() : new Date(value).getTime());

/** Whole days between two instants, counting Mon-Fri only when asked. */
export function daysBetween(from, to, businessDaysOnly = false) {
	const start = toTime(from);
	const end = toTime(to);
	if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;

	if (!businessDaysOnly) return Math.floor((end - start) / DAY_MS);

	let count = 0;
	for (let t = start + DAY_MS; t <= end; t += DAY_MS) {
		const day = new Date(t).getUTCDay();
		if (day !== 0 && day !== 6) count++;
	}
	return count;
}

/**
 * @typedef {object} MailEvent
 * @property {string} threadId      conversation id from the mail store
 * @property {'inbound'|'outbound'} direction
 * @property {string} [from]
 * @property {string} [to]
 * @property {string|Date} date
 * @property {string} [subject]
 * @property {string} [category]
 * @property {string} [priority_tier]
 */

/**
 * @param {MailEvent[]} events
 * @param {object} [opts]
 * @param {string|Date} [opts.now]
 * @param {number} [opts.thresholdDays]
 * @param {boolean} [opts.businessDaysOnly]
 * @param {string[]} [opts.ignoreCategories]
 * @param {string[]} [opts.onlyTiers]
 * @returns {{surfaced: Array<object>, evaluated: Array<object>}}
 */
export function findStaleThreads(events, opts = {}) {
	const cfg = settings.staleFollowUp;
	const now = opts.now ? toTime(opts.now) : Date.now();
	const thresholdDays = opts.thresholdDays ?? cfg.thresholdDays;
	const businessDaysOnly = opts.businessDaysOnly ?? cfg.businessDaysOnly;
	const ignoreCategories = new Set(opts.ignoreCategories ?? cfg.ignoreCategories ?? []);
	const onlyTiers = opts.onlyTiers ?? cfg.onlyTiers ?? null;

	/** @type {Map<string, MailEvent[]>} */
	const threads = new Map();
	for (const event of events) {
		const key = event.threadId ?? `__no-thread__${threads.size}`;
		if (!threads.has(key)) threads.set(key, []);
		threads.get(key).push(event);
	}

	const evaluated = [];

	for (const [threadId, raw] of threads) {
		const messages = [...raw].sort((a, b) => toTime(a.date) - toTime(b.date));
		const outbound = messages.filter((m) => m.direction === 'outbound');
		if (outbound.length === 0) continue;

		const lastOutbound = outbound.at(-1);
		const sentAt = toTime(lastOutbound.date);

		// Thread-aware: ANY inbound after the last outbound answers it, whoever sent it.
		const answeredBy = messages.find((m) => m.direction === 'inbound' && toTime(m.date) > sentAt);

		const category = lastOutbound.category ?? messages.at(-1)?.category ?? null;
		const tier = lastOutbound.priority_tier ?? messages.at(-1)?.priority_tier ?? null;

		const elapsedDays = daysBetween(sentAt, now, businessDaysOnly);

		let surfaced = true;
		let reason = 'no reply past threshold';

		if (answeredBy) {
			surfaced = false;
			reason = `answered on ${new Date(toTime(answeredBy.date)).toISOString().slice(0, 10)} by ${parseAddress(answeredBy.from) || 'someone on the thread'}`;
		} else if (elapsedDays < thresholdDays) {
			surfaced = false;
			reason = `only ${elapsedDays} day(s) elapsed, threshold ${thresholdDays}`;
		} else if (category && ignoreCategories.has(category)) {
			surfaced = false;
			reason = `category ${category} is not chased`;
		} else if (onlyTiers && tier && !onlyTiers.includes(tier)) {
			surfaced = false;
			reason = `tier ${tier} is not chased`;
		}

		evaluated.push({
			threadId,
			subject: lastOutbound.subject ?? messages.at(-1)?.subject ?? null,
			to: lastOutbound.to ?? null,
			last_outbound_at: new Date(sentAt).toISOString(),
			elapsed_days: elapsedDays,
			threshold_days: thresholdDays,
			category,
			priority_tier: tier,
			surfaced,
			reason,
		});
	}

	evaluated.sort((a, b) => b.elapsed_days - a.elapsed_days);

	return { surfaced: evaluated.filter((t) => t.surfaced), evaluated };
}
