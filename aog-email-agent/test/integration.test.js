import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ProjectAssistantSink } from '../src/integration.js';
import { lookupTier } from '../src/tier.js';

/** CLS-04 with EXT-04's extracted fields, which is what INT-01 and INT-02 both feed on. */
const cls04 = () => ({
	email: {
		internetMessageId: '<oakmont-001@gc-example.com>',
		from: 'pm@gc-example.com',
		subject: 'Boring schedule, Oakmont Logistics',
	},
	category: 'Active Project',
	tier: lookupTier('pm@gc-example.com'),
	extracted: {
		due_date: null,
		project_name: 'Oakmont Logistics',
		project_stage: 'active project',
		client_name: 'GC Example',
		bid_reference: null,
		response_needed: true,
	},
});

describe('Suite 9: project-assistant integration', () => {
	it('INT-01 the Oakmont record picks up the project name and stage', () => {
		const sink = new ProjectAssistantSink();
		const result = sink.submit(cls04());

		assert.equal(result.status, 'queued');

		const record = sink.getRecord('Oakmont Logistics');
		assert.equal(record.project_name, 'Oakmont Logistics');
		assert.equal(record.project_stage, 'active project');
		assert.equal(record.last_email_category, 'Active Project');
	});

	it('INT-02 the same message id processed twice leaves one record', () => {
		const sink = new ProjectAssistantSink();

		const first = sink.submit(cls04());
		const second = sink.submit(cls04());

		assert.equal(first.status, 'queued');
		assert.equal(second.status, 'duplicate');
		assert.equal(sink.recordCount, 1);
		assert.equal(sink.pending.length, 1, 'a duplicate must not queue a second write');
	});

	it('a later message on the same project updates the record instead of forking it', () => {
		const sink = new ProjectAssistantSink();
		sink.submit(cls04());

		const followUp = cls04();
		followUp.email.internetMessageId = '<oakmont-002@gc-example.com>';
		followUp.extracted = { ...followUp.extracted, project_stage: 'closeout' };

		const result = sink.submit(followUp);

		assert.equal(result.status, 'queued');
		assert.equal(result.intent.op, 'update');
		assert.equal(sink.recordCount, 1);
		assert.equal(sink.getRecord('Oakmont Logistics').project_stage, 'closeout');
	});

	it('INT-03 RED LINE: nothing reaches a live system before the gate clears', async () => {
		const writes = [];
		const sink = new ProjectAssistantSink({ liveWriter: async (intent) => writes.push(intent) });

		const { intent } = sink.submit(cls04());

		assert.equal(intent.approval, 'pending');
		assert.equal(writes.length, 0, 'a write happened without approval');
		assert.equal(sink.applied.length, 0);

		// The dry run logs what it intended to do, which is the whole point of the gate.
		assert.equal(sink.dryRunLog.length, 1);
		assert.equal(sink.dryRunLog[0].dry_run, true);
		assert.equal(sink.dryRunLog[0].fields.project_name, 'Oakmont Logistics');

		await sink.approve(intent.id, 'alex');

		assert.equal(writes.length, 1);
		assert.equal(writes[0].approved_by, 'alex');
		assert.equal(sink.pending.length, 0);
	});

	it('approval needs a named approver', async () => {
		const sink = new ProjectAssistantSink({ liveWriter: async () => {} });
		const { intent } = sink.submit(cls04());

		await assert.rejects(() => sink.approve(intent.id, ''), /named approver/);
	});

	it('a rejected intent never writes', async () => {
		const writes = [];
		const sink = new ProjectAssistantSink({ liveWriter: async (i) => writes.push(i) });
		const { intent } = sink.submit(cls04());

		sink.reject(intent.id, 'alex', 'wrong project');

		assert.equal(writes.length, 0);
		assert.equal(sink.pending.length, 0);
		await assert.rejects(() => sink.approve(intent.id, 'alex'), /no pending intent/);
	});

	it('a message with no project name stages nothing but is still marked seen', () => {
		const sink = new ProjectAssistantSink();
		const input = cls04();
		input.extracted = { ...input.extracted, project_name: null };

		const result = sink.submit(input);

		assert.equal(result.status, 'skipped');
		assert.equal(sink.recordCount, 0);
		assert.equal(sink.submit(input).status, 'duplicate');
	});

	it('project keys ignore case and spacing so one job does not become two records', () => {
		const sink = new ProjectAssistantSink();
		sink.submit(cls04());

		const variant = cls04();
		variant.email.internetMessageId = '<oakmont-003@gc-example.com>';
		variant.extracted = { ...variant.extracted, project_name: '  oakmont   logistics ' };

		sink.submit(variant);
		assert.equal(sink.recordCount, 1);
	});
});
