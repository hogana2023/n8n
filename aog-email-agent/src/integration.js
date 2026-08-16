import { settings } from './config.js';

/**
 * Project-assistant integration. Suite 9.
 *
 * Two things this has to get right, and both are red lines:
 *   INT-02  the same message processed twice produces one record, never two
 *   INT-03  nothing reaches Pipedrive, SharePoint or the R: drive without a human clearing it
 *
 * So the sink never writes. It builds an *intent*, records it in the dry-run log, and parks
 * it. A live write only happens inside approve(), and only when an approver is named. The
 * live writer is injected, which means the default configuration cannot touch a real system
 * even by accident: with no writer wired up, approve() records the approval and stops.
 */

const normalizeProject = (name) =>
	String(name ?? '')
		.trim()
		.toLowerCase()
		.replace(/\s+/g, ' ');

let counter = 0;
const nextId = () => `intent_${++counter}`;

export class ProjectAssistantSink {
	/**
	 * @param {object} [opts]
	 * @param {(intent: object) => Promise<object>} [opts.liveWriter] only ever called from approve()
	 * @param {'required'|'off'} [opts.approvalGate]
	 */
	constructor(opts = {}) {
		this.liveWriter = opts.liveWriter ?? null;
		this.approvalGate = opts.approvalGate ?? settings.integration.approvalGate;
		this.dedupeKey = opts.dedupeKey ?? settings.integration.dedupeKey;

		/** @type {Map<string, object>} project records, keyed by normalized project name */
		this.records = new Map();
		/** @type {Set<string>} message ids already consumed */
		this.seenMessages = new Set();
		/** @type {object[]} intents waiting on a human */
		this.pending = [];
		/** @type {object[]} everything we intended to write, approved or not */
		this.dryRunLog = [];
		/** @type {object[]} intents that actually reached a live system */
		this.applied = [];
	}

	/**
	 * Take a processed email and stage a record update.
	 *
	 * @param {object} input
	 * @param {object} input.email     needs the dedupe key, normally internetMessageId
	 * @param {string} input.category
	 * @param {object} input.extracted
	 * @param {object} [input.tier]
	 * @returns {{status: 'queued'|'duplicate'|'skipped', intent: object|null, reason?: string}}
	 */
	submit({ email, category, extracted, tier }) {
		const messageId = email?.[this.dedupeKey] ?? email?.id ?? null;

		if (!messageId) {
			return { status: 'skipped', intent: null, reason: `no ${this.dedupeKey} on the message` };
		}

		if (this.seenMessages.has(messageId)) {
			// INT-02. Idempotency is on the message, not on the record, so a replayed
			// execution or a webhook redelivery cannot double-write.
			return { status: 'duplicate', intent: null, reason: `${messageId} already processed` };
		}

		const projectName = extracted?.project_name ?? null;
		if (!projectName) {
			this.seenMessages.add(messageId);
			return { status: 'skipped', intent: null, reason: 'no project name to key a record on' };
		}

		const key = normalizeProject(projectName);
		const existing = this.records.get(key) ?? null;

		const fields = {
			project_name: projectName,
			project_stage: extracted.project_stage ?? null,
			client_name: extracted.client_name ?? null,
			bid_reference: extracted.bid_reference ?? null,
			due_date: extracted.due_date ?? null,
			last_email_category: category,
			last_email_id: messageId,
			priority_tier: tier?.priority_tier ?? null,
		};

		const intent = {
			id: nextId(),
			op: existing ? 'update' : 'create',
			target: 'project_assistant',
			record_key: key,
			message_id: messageId,
			fields,
			approval: this.approvalGate === 'required' ? 'pending' : 'not_required',
			approved_by: null,
			created_at: new Date().toISOString(),
		};

		// The record in this.records is the pipeline's own view, not a live system. It is
		// what lets INT-01 assert the record carries the project name and stage without
		// anything having been written outward.
		this.records.set(key, { ...(existing ?? {}), ...stripNulls(fields), record_key: key });
		this.seenMessages.add(messageId);

		this.dryRunLog.push({ ...intent, dry_run: true });

		if (this.approvalGate === 'required') {
			this.pending.push(intent);
			return { status: 'queued', intent };
		}

		this.applied.push(intent);
		return { status: 'queued', intent };
	}

	getRecord(projectName) {
		return this.records.get(normalizeProject(projectName)) ?? null;
	}

	get recordCount() {
		return this.records.size;
	}

	/**
	 * Clear the gate on one intent. This is the only path to a live system.
	 * @param {string} intentId
	 * @param {string} approver
	 */
	async approve(intentId, approver) {
		if (!approver) throw new Error('approve() needs a named approver');

		const index = this.pending.findIndex((i) => i.id === intentId);
		if (index === -1) throw new Error(`no pending intent ${intentId}`);

		const [intent] = this.pending.splice(index, 1);
		intent.approval = 'approved';
		intent.approved_by = approver;
		intent.approved_at = new Date().toISOString();

		let result = null;
		if (this.liveWriter) {
			result = await this.liveWriter(intent);
		}

		this.applied.push(intent);
		return { intent, result, wrote: Boolean(this.liveWriter) };
	}

	reject(intentId, approver, reason) {
		const index = this.pending.findIndex((i) => i.id === intentId);
		if (index === -1) throw new Error(`no pending intent ${intentId}`);
		const [intent] = this.pending.splice(index, 1);
		intent.approval = 'rejected';
		intent.approved_by = approver ?? null;
		intent.reason = reason ?? null;
		return intent;
	}
}

function stripNulls(obj) {
	return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null && v !== undefined));
}

export const _internals = { normalizeProject };
