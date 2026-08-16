import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { lookupTier, stripModelTier } from '../src/tier.js';
import { categoryByName } from '../src/config.js';

/**
 * Suite 3: Priority tier. Bar is 1.00, so every case is exact-match.
 * No model runs in this file, which is the whole point of the suite.
 */
describe('Suite 3: priority tier', () => {
	it('PRI-01 known key client resolves from the table', () => {
		const result = lookupTier('pm@gc-example.com');
		assert.equal(result.priority_tier, 'key_client');
		assert.equal(result.tier_source, 'lookup');
	});

	it('PRI-02 an address not in the table falls back to unknown, flagged as a default', () => {
		const result = lookupTier('someone@brand-new-domain.com');
		assert.equal(result.priority_tier, 'unknown');
		assert.equal(result.tier_source, 'default');
	});

	it('PRI-03 internal staff resolve from the table', () => {
		const result = lookupTier('garic@alphaomega-example.com');
		assert.equal(result.priority_tier, 'internal');
		assert.equal(result.tier_source, 'lookup');
	});

	it('PRI-04 content routes to Noise, the table still says key_client', () => {
		// The split the spec calls out. Routing is decided elsewhere by content, and this
		// suite only has to prove the lookup is indifferent to it.
		const route = 'Low Priority / Noise';
		const result = lookupTier('news@arch-example.com');

		assert.equal(categoryByName(route)?.category, 'Low Priority / Noise');
		assert.equal(result.priority_tier, 'key_client');
		assert.equal(result.tier_source, 'lookup');
	});

	it('reads "Name <addr>" the same as a bare address', () => {
		assert.equal(lookupTier('Pat Morrow <PM@GC-Example.com>').priority_tier, 'key_client');
	});

	it('falls back to the domain when the address is not listed', () => {
		const result = lookupTier('newhire@alphaomega-example.com');
		assert.equal(result.priority_tier, 'internal');
		assert.equal(result.matched_on, 'domain');
	});

	it('RED LINE: a tier emitted by the model is stripped before it can reach a record', () => {
		const hallucinated = {
			project_name: 'New Elementary',
			priority_tier: 'key_client',
			urgency: 'high',
			importance: 'critical',
		};

		const { clean, removed } = stripModelTier(hallucinated);

		assert.equal(clean.priority_tier, undefined);
		assert.equal(clean.urgency, undefined);
		assert.equal(clean.importance, undefined);
		assert.equal(clean.project_name, 'New Elementary');
		assert.deepEqual(removed.sort(), ['importance', 'priority_tier', 'urgency']);
	});

	it('every tier in the table carries a rank, a start weight and a floor', () => {
		for (const address of ['pm@gc-example.com', 'garic@alphaomega-example.com', 'nobody@nowhere.test']) {
			const result = lookupTier(address);
			assert.equal(typeof result.tier_rank, 'number');
			assert.equal(typeof result.weight_floor, 'number');
		}
	});
});
