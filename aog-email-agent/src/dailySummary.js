import { settings } from './config.js';

/**
 * Daily executive summary. Suite 8.
 *
 * Assembled in code, not by a model. The spec wants all five sections present every day
 * (SUMX-01), an empty section to say so out loud rather than vanish (SUMX-03), and no
 * padding with yesterday's items. Those are structural guarantees, and a model asked to
 * "write a brief" will eventually drop an empty section or backfill it to look useful.
 * So the sections are built from the day's records and the model, if used at all, only
 * ever writes the one-line lede.
 */

const SECTIONS = settings.dailySummary.sections;
const EMPTY = settings.dailySummary.emptySectionText;

const HIGH_PRIORITY_TIERS = ['internal', 'key_client'];
const NOISE = ['Low Priority / Noise', 'Unclassified'];

const toTime = (v) => (v instanceof Date ? v.getTime() : new Date(v).getTime());

const dateOnly = (iso) => String(iso ?? '').slice(0, 10);

function inWindow(record, now, windowHours) {
	const stamp = toTime(record.processed_at ?? record.received_at);
	if (!Number.isFinite(stamp)) return false;
	return stamp > now - windowHours * 3_600_000 && stamp <= now;
}

function label(record) {
	const parts = [];
	if (record.extracted?.project_name) parts.push(record.extracted.project_name);
	if (record.extracted?.bid_reference) parts.push(`(${record.extracted.bid_reference})`);
	const name = parts.join(' ');
	return name || record.subject || '(no subject)';
}

/**
 * @param {Array<object>} records processed mail: {subject, from, category, extracted, tier, processed_at}
 * @param {object} [opts]
 * @param {string|Date} [opts.now]
 * @param {number} [opts.windowHours]
 * @param {Array<object>} [opts.staleFollowUps] output of findStaleThreads().surfaced
 * @returns {{date: string, window_hours: number, sections: Array<{title: string, items: object[], empty: boolean, text: string}>, text: string}}
 */
export function buildDailySummary(records, opts = {}) {
	const cfg = settings.dailySummary;
	const now = opts.now ? toTime(opts.now) : Date.now();
	const windowHours = opts.windowHours ?? cfg.windowHours;
	const horizonMs = cfg.criticalDeadlineHorizonDays * 86_400_000;

	// Scoped to the window. Anything older is carryover and does not belong in today's brief.
	const today = records.filter((r) => inWindow(r, now, windowHours));

	const newOpportunities = today
		.filter((r) => r.category === 'New Opportunity')
		.map((r) => ({
			label: label(r),
			client: r.extracted?.client_name ?? null,
			from: r.from ?? null,
			due_date: r.extracted?.due_date ?? null,
			subject: r.subject ?? null,
		}));

	const criticalDeadlines = today
		.flatMap((r) => {
			const dates = [];
			const primary = r.extracted?.primary_due_date ?? r.extracted?.due_date ?? null;
			if (primary) dates.push({ kind: 'due', date: primary });
			for (const other of r.extracted?.other_dates ?? []) {
				dates.push({ kind: other.label, date: other.date });
			}
			return dates.map((d) => ({ ...d, label: label(r), category: r.category }));
		})
		.filter((d) => {
			const when = toTime(d.date);
			return Number.isFinite(when) && when <= now + horizonMs;
		})
		.sort((a, b) => toTime(a.date) - toTime(b.date));

	const highPriority = today
		.filter(
			(r) =>
				HIGH_PRIORITY_TIERS.includes(r.tier?.priority_tier) && !NOISE.includes(r.category),
		)
		.map((r) => ({
			from: r.from ?? null,
			tier: r.tier?.priority_tier ?? null,
			category: r.category,
			subject: r.subject ?? null,
			summary: r.extracted?.action_summary ?? null,
		}));

	const followUps = (opts.staleFollowUps ?? []).map((t) => ({
		to: t.to ?? null,
		subject: t.subject ?? null,
		elapsed_days: t.elapsed_days,
		last_outbound_at: dateOnly(t.last_outbound_at),
	}));

	const awaitingDecision = today
		.filter(
			(r) =>
				r.extracted?.project_stage === 'bid submitted' ||
				r.awaiting_decision === true ||
				(r.category === 'Bid Outcome' && r.extracted?.response_needed === true),
		)
		.map((r) => ({
			label: label(r),
			category: r.category,
			stage: r.extracted?.project_stage ?? null,
			subject: r.subject ?? null,
		}));

	const bucket = {
		'New Opportunities': newOpportunities,
		'Critical Deadlines': criticalDeadlines,
		'High-Priority Comms': highPriority,
		'Outstanding Follow-ups': followUps,
		'Awaiting Decision': awaitingDecision,
	};

	// SECTIONS drives the loop, so every section exists every day whether or not it has items.
	const sections = SECTIONS.map((title) => {
		const items = bucket[title] ?? [];
		return {
			title,
			items,
			empty: items.length === 0,
			text: items.length === 0 ? EMPTY : items.map((i) => renderItem(title, i)).join('\n'),
		};
	});

	const text = sections.map((s) => `${s.title}\n${s.text}`).join('\n\n');

	return {
		date: new Date(now).toISOString().slice(0, 10),
		window_hours: windowHours,
		sections,
		text,
	};
}

function renderItem(title, item) {
	switch (title) {
		case 'New Opportunities':
			return `- ${item.label}${item.client ? `, ${item.client}` : ''}${item.due_date ? `, due ${item.due_date}` : ''}`;
		case 'Critical Deadlines':
			return `- ${item.date} ${item.kind}, ${item.label}`;
		case 'High-Priority Comms':
			return `- ${item.from} (${item.tier}), ${item.category}: ${item.subject ?? ''}`.trimEnd();
		case 'Outstanding Follow-ups':
			return `- ${item.to ?? 'unknown'}, ${item.elapsed_days} days since ${item.last_outbound_at}: ${item.subject ?? ''}`.trimEnd();
		case 'Awaiting Decision':
			return `- ${item.label}, ${item.stage ?? item.category}`;
		default:
			return `- ${JSON.stringify(item)}`;
	}
}
