import { contacts, settings } from './config.js';
import { lookupTier, parseAddress } from './tier.js';

/**
 * Inbox learning loop. Suite 7.
 *
 * Watches what Alex actually does with mail (deletes, archives, fast replies) and moves a
 * per-sender weight. The weight feeds the next scoring pass. It does NOT set the tier.
 * Tier stays a contacts-table fact, so this loop can never violate the Suite 3 red line.
 *
 * LRN-03 is the guard that shapes everything here. One delete from a key client must not
 * knock them down. Two mechanisms stop it:
 *   1. a per-action clamp (singleActionCap) on tiers listed in dampenedTiers
 *   2. a hard weightFloor per tier that no amount of actions can push through
 * A tier demotion is only ever *suggested*, never applied, and only after enough evidence.
 */

const ACTION_DELTAS = {
	delete_unread: 'deleteUnreadDelta',
	delete_read: 'deleteReadDelta',
	archive_unread: 'archiveUnreadDelta',
	reply: 'fastReplyDelta',
	open: 'openedNoReplyDelta',
};

const round = (n) => Math.round(n * 1e6) / 1e6;

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

function tierMeta(tierName) {
	const meta = contacts.tiers[tierName];
	if (!meta) throw new Error(`unknown tier "${tierName}"`);
	return meta;
}

/** Where a sender sits before any action has been observed. */
export function initialState(address) {
	const { priority_tier, tier_source } = lookupTier(address);
	const meta = tierMeta(priority_tier);
	return {
		address: parseAddress(address),
		priority_tier,
		tier_source,
		weight: meta.startWeight,
		actions: 0,
		suggested_tier: null,
	};
}

/**
 * Resolve the signed delta for one action, after damping.
 * A `reply` only earns the fast-reply bump when it landed inside fastReplyMinutes.
 */
function deltaFor(action, cfg, damped) {
	let raw;

	if (action.type === 'reply') {
		const minutes = action.replyLatencyMinutes ?? Infinity;
		raw = minutes <= cfg.fastReplyMinutes ? cfg.fastReplyDelta : cfg.openedNoReplyDelta;
	} else {
		const key = ACTION_DELTAS[action.type];
		if (!key) return 0;
		raw = cfg[key];
	}

	if (!damped) return raw;
	return Math.sign(raw) * Math.min(Math.abs(raw), cfg.singleActionCap);
}

/**
 * Apply a batch of observed actions to sender state.
 *
 * @param {Array<{sender: string, type: keyof typeof ACTION_DELTAS, at?: string, replyLatencyMinutes?: number}>} actions
 * @param {Record<string, object>} [priorState] keyed by lowercased address
 * @returns {{state: Record<string, object>, changes: Array<object>}}
 */
export function applyActions(actions, priorState = {}) {
	const cfg = settings.learning;
	// JSON clone rather than structuredClone: this same source is inlined into an n8n Code
	// node by bin/build-workflows.mjs, and the sandbox there does not always expose it.
	const state = JSON.parse(JSON.stringify(priorState));
	const before = {};

	for (const action of actions) {
		const address = parseAddress(action.sender);
		if (!address) continue;

		if (!state[address]) state[address] = initialState(address);
		if (!(address in before)) before[address] = { ...state[address] };

		const entry = state[address];
		const meta = tierMeta(entry.priority_tier);
		const damped = (cfg.dampenedTiers ?? []).includes(entry.priority_tier);

		const delta = deltaFor(action, cfg, damped);
		entry.weight = round(clamp(entry.weight + delta, Math.max(cfg.minWeight, meta.weightFloor), cfg.maxWeight));
		entry.actions += 1;
	}

	// Tier demotion is a suggestion for a human, never an automatic change.
	for (const entry of Object.values(state)) {
		const meta = tierMeta(entry.priority_tier);
		const damped = (cfg.dampenedTiers ?? []).includes(entry.priority_tier);
		const atFloor = entry.weight <= meta.weightFloor + 1e-9;
		entry.suggested_tier =
			!damped && atFloor && entry.actions >= cfg.minActionsBeforeTierChange ? 'review_for_demotion' : null;
	}

	const changes = Object.keys(before).map((address) => ({
		address,
		priority_tier: state[address].priority_tier,
		tier_changed: before[address].priority_tier !== state[address].priority_tier,
		weight_before: before[address].weight,
		weight_after: state[address].weight,
		weight_delta: round(state[address].weight - before[address].weight),
		actions: state[address].actions,
		suggested_tier: state[address].suggested_tier,
	}));

	return { state, changes };
}

/**
 * The scoring pass the daily jobs read. Combines the fixed tier rank with the learned
 * weight so a heavily-ignored unknown sinks below an occasionally-ignored key client.
 */
export function scoreSender(address, state = {}) {
	const entry = state[parseAddress(address)] ?? initialState(address);
	const meta = tierMeta(entry.priority_tier);
	const rankScore = 1 - meta.rank / 10;
	return {
		address: entry.address,
		priority_tier: entry.priority_tier,
		weight: entry.weight,
		score: round(rankScore * 0.6 + entry.weight * 0.4),
	};
}
