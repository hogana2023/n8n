import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { applyActions, initialState, scoreSender } from '../src/learning.js';
import { settings } from '../src/config.js';

const SENDER_X = 'news@drillrig-vendor.com';
const SENDER_Y = 'developer@example-dev.com';
const KEY_CLIENT = 'pm@gc-example.com';

describe('Suite 7: inbox learning', () => {
	it('LRN-01 three unread deletes over a week lower the sender weight', () => {
		const before = initialState(SENDER_X);

		const { state, changes } = applyActions([
			{ sender: SENDER_X, type: 'delete_unread', at: '2026-01-05' },
			{ sender: SENDER_X, type: 'delete_unread', at: '2026-01-08' },
			{ sender: SENDER_X, type: 'delete_unread', at: '2026-01-11' },
		]);

		assert.ok(
			state[SENDER_X].weight < before.weight,
			`expected weight below ${before.weight}, got ${state[SENDER_X].weight}`,
		);
		assert.equal(changes[0].actions, 3);
		assert.ok(changes[0].weight_delta < 0);
	});

	it('LRN-02 repeated fast replies raise the sender weight', () => {
		const before = initialState(SENDER_Y);

		const { state } = applyActions([
			{ sender: SENDER_Y, type: 'reply', replyLatencyMinutes: 4 },
			{ sender: SENDER_Y, type: 'reply', replyLatencyMinutes: 9 },
			{ sender: SENDER_Y, type: 'reply', replyLatencyMinutes: 2 },
		]);

		assert.ok(
			state[SENDER_Y].weight > before.weight,
			`expected weight above ${before.weight}, got ${state[SENDER_Y].weight}`,
		);
	});

	it('LRN-03 one delete from a key client holds the tier and barely moves the weight', () => {
		// The overfitting guard. Two mechanisms have to hold at once: the per-action clamp
		// and the tier floor.
		const before = initialState(KEY_CLIENT);
		assert.equal(before.priority_tier, 'key_client');

		const { state, changes } = applyActions([{ sender: KEY_CLIENT, type: 'delete_unread' }]);
		const after = state[KEY_CLIENT];

		assert.equal(after.priority_tier, 'key_client');
		assert.equal(changes[0].tier_changed, false);
		assert.equal(changes[0].suggested_tier, null);

		const moved = Math.abs(after.weight - before.weight);
		assert.ok(
			moved <= settings.learning.singleActionCap + 1e-9,
			`weight moved ${moved}, cap is ${settings.learning.singleActionCap}`,
		);
	});

	it('a key client cannot be pushed through the tier floor by volume', () => {
		const actions = Array.from({ length: 50 }, () => ({ sender: KEY_CLIENT, type: 'delete_unread' }));
		const { state } = applyActions(actions);

		assert.equal(state[KEY_CLIENT].priority_tier, 'key_client');
		assert.ok(state[KEY_CLIENT].weight >= 0.7, `floor breached: ${state[KEY_CLIENT].weight}`);
	});

	it('a slow reply earns the small bump, not the fast-reply bump', () => {
		const fast = applyActions([{ sender: SENDER_Y, type: 'reply', replyLatencyMinutes: 3 }]);
		const slow = applyActions([{ sender: SENDER_Y, type: 'reply', replyLatencyMinutes: 600 }]);

		assert.ok(fast.state[SENDER_Y].weight > slow.state[SENDER_Y].weight);
	});

	it('an undampened sender that bottoms out is flagged for a human, never demoted automatically', () => {
		const actions = Array.from({ length: 20 }, () => ({ sender: SENDER_X, type: 'delete_unread' }));
		const { state } = applyActions(actions);

		assert.equal(state[SENDER_X].priority_tier, 'vendor', 'tier still comes from the table');
		assert.equal(state[SENDER_X].suggested_tier, 'review_for_demotion');
	});

	it('scoring keeps a bruised key client above a healthy unknown', () => {
		const { state } = applyActions([
			{ sender: KEY_CLIENT, type: 'delete_unread' },
			{ sender: KEY_CLIENT, type: 'delete_unread' },
		]);

		const client = scoreSender(KEY_CLIENT, state);
		const stranger = scoreSender('nobody@nowhere.test', state);

		assert.ok(client.score > stranger.score);
	});

	it('state carries forward across passes', () => {
		const first = applyActions([{ sender: SENDER_X, type: 'delete_unread' }]);
		const second = applyActions([{ sender: SENDER_X, type: 'delete_unread' }], first.state);

		assert.equal(second.state[SENDER_X].actions, 2);
		assert.ok(second.state[SENDER_X].weight < first.state[SENDER_X].weight);
	});
});
