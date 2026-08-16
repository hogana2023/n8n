import { contacts } from './config.js';

/**
 * Priority tier lookup.
 *
 * Spec red line: "Any priority tier set by the LLM instead of the contacts lookup" is a
 * ship blocker. So there is no model anywhere in this file and there never should be.
 * Address match wins over domain match, and a miss returns the default tier with
 * tier_source 'default' so the caller can tell a real lookup from a fallback.
 *
 * Suite 3 cases: PRI-01 address hit, PRI-02 miss, PRI-03 internal hit, PRI-04 the split
 * where content routed the message to Noise but the tier stays whatever the table says.
 */

const normalize = (address) => String(address ?? '').trim().toLowerCase();

/** Pulls the address out of "Name <addr@host>" or a bare address. */
export function parseAddress(input) {
	const raw = normalize(input);
	const angled = raw.match(/<([^>]+)>/);
	return angled ? angled[1].trim() : raw;
}

export function domainOf(address) {
	const at = parseAddress(address).lastIndexOf('@');
	return at === -1 ? '' : parseAddress(address).slice(at + 1);
}

/**
 * @param {string} fromAddress
 * @returns {{priority_tier: string, tier_source: 'lookup'|'default', tier_rank: number, weight_floor: number, matched_on: 'address'|'domain'|null}}
 */
export function lookupTier(fromAddress) {
	const address = parseAddress(fromAddress);
	const domain = domainOf(address);

	let tier = null;
	let matchedOn = null;

	if (address && Object.hasOwn(contacts.byAddress, address)) {
		tier = contacts.byAddress[address];
		matchedOn = 'address';
	} else if (domain && Object.hasOwn(contacts.byDomain, domain)) {
		tier = contacts.byDomain[domain];
		matchedOn = 'domain';
	}

	const source = tier ? 'lookup' : 'default';
	const resolved = tier ?? contacts.defaultTier;
	const meta = contacts.tiers[resolved];

	if (!meta) {
		throw new Error(`contacts.json maps ${address} to unknown tier "${resolved}"`);
	}

	return {
		priority_tier: resolved,
		tier_source: source,
		tier_rank: meta.rank,
		weight_floor: meta.weightFloor,
		matched_on: matchedOn,
	};
}

/**
 * Strips any tier-shaped field a model tried to emit. Called on every extractor result
 * before the tier lookup is merged in, so a hallucinated tier can never reach a record.
 */
const MODEL_TIER_FIELDS = [
	'priority_tier',
	'tier',
	'tier_source',
	'priority',
	'importance',
	'urgency',
	'weight',
];

export function stripModelTier(extracted) {
	const clean = { ...extracted };
	const removed = [];
	for (const field of MODEL_TIER_FIELDS) {
		if (field in clean) {
			removed.push(field);
			delete clean[field];
		}
	}
	return { clean, removed };
}
