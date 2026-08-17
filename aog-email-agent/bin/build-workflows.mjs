#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { ROOT, categories, explicitCategories, extractorSchema, prompts, settings } from '../src/config.js';
import { buildClassifierSystemPrompt } from '../src/classify.js';
import { contacts } from '../src/config.js';

/**
 * Generates the importable n8n workflow JSON from the same config, prompts and source the
 * test suite runs against.
 *
 * n8n Code nodes cannot import local files, so the pure logic (tier lookup, draft lint,
 * stale detection, learning weights, summary assembly) has to exist twice: once in src/
 * where it is unit tested, and once inside a Code node where it actually runs. Rather than
 * maintain two copies and watch them drift, the Code node bodies are built here by
 * inlining the real source text with its imports stripped and its config frozen in.
 *
 *   node bin/build-workflows.mjs
 *
 * Edit src/ and config/, never workflows/*.json. Regenerate and re-import.
 */

const OUT = join(ROOT, 'workflows');

// ------------------------------------------------------------------ inlining

const readSrc = (name) => readFileSync(join(ROOT, 'src', name), 'utf8');

/** Strip ESM syntax so a module's body can live inside a Code node. */
function inline(name) {
	return (
		readSrc(name)
			.replace(/^import\s[\s\S]*?;$/gm, '')
			// re-export lists carry no code, drop them outright
			.replace(/^export\s*\{[\s\S]*?\};?$/gm, '')
			// everything else keeps its declaration and loses the keyword, including
			// `export async function` and `export default`
			.replace(/^export\s+(?:default\s+)?(?=(?:async\s+)?(?:function|class|const|let|var)\b)/gm, '')
			.replace(/\n{3,}/g, '\n\n')
			.trim()
	);
}

const frozenConfig = () =>
	[
		`const settings = ${JSON.stringify(settings, null, 1)};`,
		`const contacts = ${JSON.stringify(contacts, null, 1)};`,
	].join('\n');

// ------------------------------------------------------------------ node helpers

let nodeId = 0;
const id = () => `aog-${String(++nodeId).padStart(3, '0')}`;

const node = (name, type, typeVersion, parameters, position, extra = {}) => ({
	parameters,
	id: id(),
	name,
	type,
	typeVersion,
	position,
	...extra,
});

const code = (name, jsCode, position) =>
	node(name, 'n8n-nodes-base.code', 2, { jsCode }, position);

const sticky = (content, position, [width, height] = [420, 200]) =>
	node(`Note ${id()}`, 'n8n-nodes-base.stickyNote', 1, { content, width, height }, position);

/** connections[from].main[outputIndex] = [{node: to}] */
function connect(connections, from, to, outputIndex = 0, type = 'main', inputIndex = 0) {
	connections[from] ??= {};
	connections[from][type] ??= [];
	while (connections[from][type].length <= outputIndex) connections[from][type].push([]);
	connections[from][type][outputIndex].push({ node: to, type, index: inputIndex });
}

// `effort` replaces temperature on every model this pipeline targets, and the sub-node
// clears the sampling parameters for them. See the LmChatAnthropic patch.
const anthropic = (name, model, effort, position) =>
	node(
		name,
		'@n8n/n8n-nodes-langchain.lmChatAnthropic',
		1.3,
		{
			model: { __rl: true, mode: 'id', value: model },
			options: { effort, maxTokensToSample: settings.llm.maxTokens },
		},
		position,
		{ credentials: { anthropicApi: { id: 'REPLACE_ME', name: 'Anthropic account' } } },
	);

const outlookCreds = {
	credentials: {
		microsoftOutlookOAuth2Api: { id: 'REPLACE_ME', name: 'Microsoft Outlook account' },
	},
};

const workflow = (name, nodes, connections, notes = []) => ({
	name,
	nodes: [...nodes, ...notes],
	connections,
	settings: { executionOrder: 'v1', saveManualExecutions: true, callerPolicy: 'workflowsFromSameOwner' },
	pinData: {},
	meta: { templateCredsSetupCompleted: false },
	tags: [{ name: 'AOG Email Agent' }],
});

const write = (file, wf) => {
	writeFileSync(join(OUT, file), `${JSON.stringify(wf, null, 2)}\n`);
	console.log(`wrote workflows/${file}  (${wf.nodes.length} nodes)`);
};

// ================================================================== workflow 1

function inboundPipeline() {
	const nodes = [];
	const connections = {};
	const notes = [];

	nodes.push(
		node(
			'Inbox Trigger',
			'n8n-nodes-base.microsoftOutlookTrigger',
			1,
			{
				event: 'messageReceived',
				output: 'raw',
				filters: { readStatus: 'unread' },
				options: {},
			},
			[-460, 300],
			{ ...outlookCreds, alwaysOutputData: false },
		),
	);

	// --- normalize -----------------------------------------------------------
	nodes.push(
		code(
			'Normalize Message',
			`${inline('email.js')}

// One text rendering, shared by the classifier and the extractor, and byte-identical to
// what the fixture harness feeds them. If these drift, the measured scores stop applying.
const out = [];

for (const item of $input.all()) {
  const m = item.json;

  const email = {
    from: m.from?.emailAddress?.address ?? m.sender?.emailAddress?.address ?? '',
    fromName: m.from?.emailAddress?.name ?? '',
    to: (m.toRecipients ?? []).map((r) => r.emailAddress?.address).filter(Boolean).join(', '),
    subject: m.subject ?? '',
    body: m.body?.content ?? m.bodyPreview ?? '',
    receivedAt: (m.receivedDateTime ?? new Date().toISOString()).slice(0, 16),
    attachments: (m.attachments ?? []).map((a) => a.name).filter(Boolean),
  };

  // HTML bodies arrive as markup. The prompt wants prose.
  if ((m.body?.contentType ?? '').toLowerCase() === 'html') {
    email.body = email.body
      .replace(/<br\\s*\\/?>/gi, '\\n')
      .replace(/<\\/p>/gi, '\\n\\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  }

  out.push({
    json: {
      messageId: m.id,
      internetMessageId: m.internetMessageId ?? m.id,
      conversationId: m.conversationId ?? null,
      email,
      classifierText: renderEmail(email),
      extractorText: renderEmail(email, { withReferenceDate: true }),
    },
  });
}

return out;`,
			[-240, 300],
		),
	);

	// --- tier lookup, before anything model-shaped touches the item ----------
	nodes.push(
		code(
			'Priority Tier Lookup',
			`${frozenConfig()}

${inline('tier.js')}

// RED LINE: the tier is a table fact. No model runs in this node and none ever should.
return $input.all().map((item) => ({
  json: { ...item.json, tier: lookupTier(item.json.email.from) },
}));`,
			[-20, 300],
		),
	);

	// --- classifier ----------------------------------------------------------
	nodes.push(
		node(
			'Text Classifier',
			'@n8n/n8n-nodes-langchain.textClassifier',
			1,
			{
				inputText: '={{ $json.classifierText }}',
				categories: {
					categories: explicitCategories.map((c) => ({
						category: c.category,
						description: c.description,
					})),
				},
				options: {
					multiClass: false,
					fallback: 'other',
					systemPromptTemplate: buildClassifierSystemPrompt(),
					enableAutoFixing: true,
				},
			},
			[220, 300],
		),
	);

	nodes.push(anthropic('Classifier Model', settings.llm.classifierModel, settings.llm.effort.classifier, [220, 540]));
	connect(connections, 'Classifier Model', 'Text Classifier', 0, 'ai_languageModel');

	connect(connections, 'Inbox Trigger', 'Normalize Message');
	connect(connections, 'Normalize Message', 'Priority Tier Lookup');
	connect(connections, 'Priority Tier Lookup', 'Text Classifier');

	// --- one Set per branch, so the bin survives the merge -------------------
	// n8n collapses every connection into input 0, so a single downstream node cannot tell
	// which branch an item arrived on. Each branch stamps its own bin first.
	categories.forEach((category, index) => {
		const name = `Bin: ${category.category}`;
		nodes.push(
			node(
				name,
				'n8n-nodes-base.set',
				3.4,
				{
					mode: 'manual',
					includeOtherFields: true,
					assignments: {
						assignments: [
							{ id: `cat-${index}`, name: 'category', value: category.category, type: 'string' },
							{ id: `fol-${index}`, name: 'targetFolder', value: category.folder, type: 'string' },
						],
					},
					options: {},
				},
				[500, index * 110 - 140],
			),
		);
		connect(connections, 'Text Classifier', name, index);
		connect(connections, name, 'Routed');
	});

	nodes.push(node('Routed', 'n8n-nodes-base.noOp', 1, {}, [740, 300]));

	// --- file it -------------------------------------------------------------
	nodes.push(
		node(
			'Move To Folder',
			'n8n-nodes-base.microsoftOutlook',
			2,
			{
				resource: 'message',
				operation: 'move',
				messageId: { __rl: true, mode: 'id', value: '={{ $json.messageId }}' },
				folderId: { __rl: true, mode: 'name', value: '={{ $json.targetFolder }}' },
			},
			[960, 300],
			{ ...outlookCreds, onError: 'continueRegularOutput' },
		),
	);
	connect(connections, 'Routed', 'Move To Folder');

	// --- extraction ----------------------------------------------------------
	nodes.push(
		node(
			'Information Extractor',
			'@n8n/n8n-nodes-langchain.informationExtractor',
			1,
			{
				text: "={{ 'ROUTED AS: ' + $('Routed').item.json.category + '\\n\\n' + $('Routed').item.json.extractorText }}",
				schemaType: 'manual',
				inputSchema: JSON.stringify(extractorSchema, null, 2),
				options: { systemPromptTemplate: prompts.extractor },
			},
			[1180, 300],
		),
	);
	nodes.push(anthropic('Extractor Model', settings.llm.extractorModel, settings.llm.effort.extractor, [1180, 540]));
	connect(connections, 'Extractor Model', 'Information Extractor', 0, 'ai_languageModel');
	connect(connections, 'Move To Folder', 'Information Extractor');

	nodes.push(
		code(
			'Merge Facts',
			`${frozenConfig()}

${inline('tier.js')}

${inline('extract.js').replace(/^const EMPTY/m, 'const EMPTY')}

// The extractor output is re-joined with the item it came from, and anything tier-shaped
// the model produced is dropped here rather than trusted.
return $input.all().map((item, index) => {
  const source = $('Routed').all()[index].json;
  const { extracted, droppedFields } = normalizeExtraction(item.json.output ?? item.json);

  return {
    json: {
      messageId: source.messageId,
      internetMessageId: source.internetMessageId,
      conversationId: source.conversationId,
      email: source.email,
      category: source.category,
      targetFolder: source.targetFolder,
      tier: source.tier,
      extracted,
      dropped_model_fields: droppedFields,
      processed_at: new Date().toISOString(),
    },
  };
});`,
			[1400, 300],
		),
	);
	connect(connections, 'Information Extractor', 'Merge Facts');

	// --- draft gate ----------------------------------------------------------
	nodes.push(
		node(
			'Needs A Reply?',
			'n8n-nodes-base.if',
			2.2,
			{
				conditions: {
					options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
					conditions: [
						{
							id: 'response-needed',
							leftValue: '={{ $json.extracted.response_needed }}',
							rightValue: true,
							operator: { type: 'boolean', operation: 'true', singleValue: true },
						},
						{
							id: 'draftable-category',
							leftValue: JSON.stringify(settings.drafts.createFor),
							rightValue: '={{ $json.category }}',
							operator: { type: 'array', operation: 'contains', rightType: 'any' },
						},
					],
					combinator: 'and',
				},
				options: {},
			},
			[1620, 300],
		),
	);
	connect(connections, 'Merge Facts', 'Needs A Reply?');

	nodes.push(
		node(
			'Write Draft',
			'@n8n/n8n-nodes-langchain.chainLlm',
			1.6,
			{
				promptType: 'define',
				text: `={{ 'EMAIL TO REPLY TO:\\n\\n' + 'From: ' + $json.email.from + '\\nSubject: ' + $json.email.subject + '\\n\\n' + $json.email.body + '\\n\\nFACTS ALREADY EXTRACTED (this is everything you know):\\n\\n' + 'due date: ' + ($json.extracted.due_date || 'none stated') + '\\nproject: ' + ($json.extracted.project_name || 'not named') + '\\nclient: ' + ($json.extracted.client_name || 'not named') + '\\nthey are asking for: ' + (($json.extracted.requested_items || []).join(', ') || 'nothing specific') + '\\nstage: ' + ($json.extracted.project_stage || 'unknown') + '\\n\\nSign off as ${settings.mailbox.signOff}.' }}`,
				messages: {
					messageValues: [{ type: 'SystemMessagePromptTemplate', message: prompts.draft }],
				},
			},
			[1860, 200],
		),
	);
	nodes.push(anthropic('Draft Model', settings.llm.draftModel, settings.llm.effort.draft, [1860, 440]));
	connect(connections, 'Draft Model', 'Write Draft', 0, 'ai_languageModel');
	connect(connections, 'Needs A Reply?', 'Write Draft', 0);

	nodes.push(
		code(
			'Lint Draft',
			`${inline('draftLint.js')}

// The spec's bar on the lint is 1.00, so this is a gate and not a score. A draft that
// fails does not reach the drafts folder, it goes to the human queue with its violations.
return $input.all().map((item, index) => {
  const source = $('Needs A Reply?').all()[index].json;
  const body = item.json.text ?? item.json.response?.text ?? '';
  const sourceText = source.email.subject + '\\n' + source.email.body;
  const lint = lintDraft(body, { sourceText, maxWords: ${settings.drafts.maxWords} });

  return { json: { ...source, draft_body: body, lint, draft_ok: lint.pass } };
});`,
			[2080, 200],
		),
	);
	connect(connections, 'Write Draft', 'Lint Draft');

	nodes.push(
		node(
			'Draft Clean?',
			'n8n-nodes-base.if',
			2.2,
			{
				conditions: {
					options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
					conditions: [
						{
							id: 'lint-pass',
							leftValue: '={{ $json.draft_ok }}',
							rightValue: true,
							operator: { type: 'boolean', operation: 'true', singleValue: true },
						},
					],
					combinator: 'and',
				},
				options: {},
			},
			[2300, 200],
		),
	);
	connect(connections, 'Lint Draft', 'Draft Clean?');

	nodes.push(
		node(
			'Save Reply Draft',
			'n8n-nodes-base.microsoftOutlook',
			2,
			{
				resource: 'message',
				operation: 'reply',
				messageId: { __rl: true, mode: 'id', value: '={{ $json.messageId }}' },
				replyToSenderOnly: true,
				message: '={{ $json.draft_body }}',
				additionalFields: {},
				// saveAsDraft is the whole point. Nothing this workflow writes is ever sent.
				options: { saveAsDraft: true },
			},
			[2540, 120],
			outlookCreds,
		),
	);
	connect(connections, 'Draft Clean?', 'Save Reply Draft', 0);

	nodes.push(
		code(
			'Flag Draft For Human',
			`// Two lint failures in a row and nobody gets a draft. Better an empty drafts folder
// than one Alex has to proofread for invented prices.
return $input.all().map((item) => ({
  json: {
    ...item.json,
    needs_human_draft: true,
    reason: item.json.lint.violations.map((v) => v.detail).join('; '),
  },
}));`,
			[2540, 280],
		),
	);
	connect(connections, 'Draft Clean?', 'Flag Draft For Human', 1);

	// --- project record staging ---------------------------------------------
	nodes.push(
		code(
			'Stage Project Record',
			`${frozenConfig()}

${inline('integration.js')}

// INT-03 RED LINE. No live writer is attached here on purpose, so this node cannot reach
// Pipedrive, SharePoint or the R: drive no matter what it is fed. It builds the intended
// write, logs it, and parks it for approval. Wire the live writer only behind sign-off.
const seen = $getWorkflowStaticData('global');
seen.processedMessageIds ??= [];

const sink = new ProjectAssistantSink();
for (const messageId of seen.processedMessageIds) sink.seenMessages.add(messageId);

const out = [];

for (const item of $input.all()) {
  const { json } = item;
  const result = sink.submit({
    email: { internetMessageId: json.internetMessageId },
    category: json.category,
    extracted: json.extracted,
    tier: json.tier,
  });

  if (result.status !== 'duplicate') seen.processedMessageIds.push(json.internetMessageId);

  out.push({ json: { ...json, integration: result, dry_run_log: sink.dryRunLog } });
}

// Keep the dedupe list from growing without bound.
seen.processedMessageIds = seen.processedMessageIds.slice(-5000);

return out;`,
			[1860, 400],
		),
	);
	connect(connections, 'Needs A Reply?', 'Stage Project Record', 1);
	connect(connections, 'Lint Draft', 'Stage Project Record');

	notes.push(
		sticky(
			[
				'## Routing, tier, extraction, draft',
				'',
				'Order matters and is not cosmetic.',
				'',
				'**Priority Tier Lookup runs before the classifier.** The tier is a contacts-table fact and no model touches it. Suite 3 red line.',
				'',
				'**One Set node per bin.** n8n merges every connection into input 0, so the branch identity has to be stamped before the streams rejoin.',
				'',
				'**Save Reply Draft uses saveAsDraft.** Nothing here sends mail.',
				'',
				'**Stage Project Record has no live writer.** It logs the intended write and parks it. Suite 9 INT-03.',
				'',
				'Generated by `node bin/build-workflows.mjs`. Edit `src/` and `config/`, not this file.',
			].join('\n'),
			[-460, -180],
			[600, 420],
		),
	);

	return workflow('AOG Email Agent, Inbound Pipeline', nodes, connections, notes);
}

// ================================================================== workflow 2

function staleFollowUp() {
	const nodes = [];
	const connections = {};

	nodes.push(
		node(
			'Every Weekday Morning',
			'n8n-nodes-base.scheduleTrigger',
			1.2,
			{ rule: { interval: [{ field: 'cronExpression', expression: '0 7 * * 1-5' }] } },
			[-400, 300],
		),
	);

	nodes.push(
		node(
			'Recent Sent Mail',
			'n8n-nodes-base.microsoftOutlook',
			2,
			{
				resource: 'message',
				operation: 'getAll',
				returnAll: true,
				filtersUI: {
					values: {
						filters: {
							custom: `receivedDateTime ge {{ new Date(Date.now() - 45 * 86400000).toISOString() }}`,
						},
					},
				},
				output: 'fields',
				fields: ['id', 'conversationId', 'subject', 'from', 'toRecipients', 'sentDateTime', 'receivedDateTime'],
			},
			[-180, 200],
			{ ...outlookCreds, notes: 'Point this at the Sent Items folder.' },
		),
	);

	nodes.push(
		node(
			'Recent Received Mail',
			'n8n-nodes-base.microsoftOutlook',
			2,
			{
				resource: 'message',
				operation: 'getAll',
				returnAll: true,
				filtersUI: {
					values: {
						filters: {
							custom: `receivedDateTime ge {{ new Date(Date.now() - 45 * 86400000).toISOString() }}`,
						},
					},
				},
				output: 'fields',
				fields: ['id', 'conversationId', 'subject', 'from', 'receivedDateTime'],
			},
			[-180, 400],
			outlookCreds,
		),
	);

	connect(connections, 'Every Weekday Morning', 'Recent Sent Mail');
	connect(connections, 'Every Weekday Morning', 'Recent Received Mail');

	nodes.push(
		code(
			'Find Stale Threads',
			`${frozenConfig()}

${inline('tier.js')}

${inline('stale.js')}

// STL-03. Matching is on conversationId alone, so a reply from anyone on the thread counts
// as an answer. Matching on the original recipient would nag threads that already moved.
const events = [];

for (const item of $('Recent Sent Mail').all()) {
  const m = item.json;
  events.push({
    threadId: m.conversationId,
    direction: 'outbound',
    to: (m.toRecipients ?? []).map((r) => r.emailAddress?.address).filter(Boolean).join(', '),
    subject: m.subject,
    date: m.sentDateTime ?? m.receivedDateTime,
  });
}

for (const item of $('Recent Received Mail').all()) {
  const m = item.json;
  events.push({
    threadId: m.conversationId,
    direction: 'inbound',
    from: m.from?.emailAddress?.address ?? '',
    subject: m.subject,
    date: m.receivedDateTime,
  });
}

const { surfaced, evaluated } = findStaleThreads(events, { now: new Date().toISOString() });

return surfaced.length
  ? surfaced.map((thread) => ({ json: thread }))
  : [{ json: { none: true, evaluated: evaluated.length } }];`,
			[60, 300],
		),
	);
	connect(connections, 'Recent Sent Mail', 'Find Stale Threads');
	connect(connections, 'Recent Received Mail', 'Find Stale Threads');

	nodes.push(
		node(
			'Draft The Nudge List',
			'n8n-nodes-base.microsoftOutlook',
			2,
			{
				resource: 'draft',
				operation: 'create',
				subject: '=Stale follow-ups, {{ $now.format("yyyy-LL-dd") }}',
				bodyContent:
					'={{ $json.none ? "Nothing has gone unanswered past the threshold." : $input.all().map(i => "- " + (i.json.to || "unknown") + ", " + i.json.elapsed_days + " days: " + (i.json.subject || "(no subject)")).join("\\n") }}',
				additionalFields: { bodyContentType: 'Text' },
			},
			[300, 300],
			outlookCreds,
		),
	);
	connect(connections, 'Find Stale Threads', 'Draft The Nudge List');

	return workflow('AOG Email Agent, Stale Follow-up', nodes, connections, [
		sticky(
			[
				'## Stale follow-up',
				'',
				`Threshold is **${settings.staleFollowUp.thresholdDays} days** and is a placeholder. Confirm the real one.`,
				'',
				'Thread-aware by conversationId: a reply from anyone on the thread answers it (STL-03).',
				'',
				'Output is a draft, not a send.',
			].join('\n'),
			[-400, 0],
			[460, 260],
		),
	]);
}

// ================================================================== workflow 3

function inboxLearning() {
	const nodes = [];
	const connections = {};

	nodes.push(
		node(
			'Nightly',
			'n8n-nodes-base.scheduleTrigger',
			1.2,
			{ rule: { interval: [{ field: 'cronExpression', expression: '0 2 * * *' }] } },
			[-400, 300],
		),
	);

	nodes.push(
		code(
			'Collect Inbox Actions',
			`// Reads what Alex did with yesterday's mail. Deleted Items and read state come from
// Graph; the reply latency comes from matching sent mail back to its conversation.
//
// This node is the one piece of the loop that needs a real mailbox to be meaningful, so it
// ships as the shape of the data rather than a guess at the query. Fill in the Graph calls
// once the mailbox is connected. Everything downstream is already tested against this shape.
return [
  { json: { sender: 'news@drillrig-vendor.com', type: 'delete_unread', at: $now.toISO() } },
];`,
			[-180, 300],
		),
	);
	connect(connections, 'Nightly', 'Collect Inbox Actions');

	nodes.push(
		code(
			'Update Sender Weights',
			`${frozenConfig()}

${inline('tier.js')}

${inline('learning.js')}

// LRN-03. The floor and the per-action clamp both live in the config above, so a single
// delete from a key client cannot move them and no volume of deletes can breach the floor.
// Tier itself is never written here. It stays a contacts-table fact.
const store = $getWorkflowStaticData('global');
store.senderWeights ??= {};

const actions = $input.all().map((item) => item.json).filter((a) => a.sender && a.type);
const { state, changes } = applyActions(actions, store.senderWeights);

store.senderWeights = state;

return changes.length
  ? changes.map((change) => ({ json: change }))
  : [{ json: { none: true, tracked: Object.keys(state).length } }];`,
			[60, 300],
		),
	);
	connect(connections, 'Collect Inbox Actions', 'Update Sender Weights');

	return workflow('AOG Email Agent, Inbox Learning', nodes, connections, [
		sticky(
			[
				'## Inbox learning',
				'',
				'Moves a per-sender **weight**. Never moves a **tier**. Tier stays a contacts-table fact (Suite 3 red line).',
				'',
				`Key clients and internal senders are damped: any single action moves them at most **${settings.learning.singleActionCap}**, and a per-tier floor stops volume from pushing them down (LRN-03).`,
				'',
				'A sender that bottoms out is flagged `review_for_demotion` for a human. It is never demoted automatically.',
				'',
				'State lives in workflow static data. Move it to a real table before this matters.',
			].join('\n'),
			[-400, -20],
			[520, 320],
		),
	]);
}

// ================================================================== workflow 4

function dailySummaryWorkflow() {
	const nodes = [];
	const connections = {};

	nodes.push(
		node(
			'Every Morning',
			'n8n-nodes-base.scheduleTrigger',
			1.2,
			{
				rule: {
					interval: [
						{ field: 'cronExpression', expression: `0 ${Number(settings.dailySummary.sendAt.split(':')[0])} * * 1-5` },
					],
				},
			},
			[-400, 300],
		),
	);

	nodes.push(
		code(
			'Read The Day',
			`// The processed records the inbound pipeline wrote. Swap this for the real store once
// one exists; the assembly below only cares about the shape.
const store = $getWorkflowStaticData('global');
return (store.processedToday ?? []).map((record) => ({ json: record }));`,
			[-180, 300],
		),
	);
	connect(connections, 'Every Morning', 'Read The Day');

	nodes.push(
		code(
			'Build The Brief',
			`${frozenConfig()}

${inline('dailySummary.js')}

// SUMX-01 and SUMX-03 are structural, so the sections are assembled here rather than
// written by a model. A model asked to "write a brief" eventually drops an empty section
// or backfills it with something old to look useful. This cannot.
const records = $input.all().map((item) => item.json).filter((r) => r && !r.none);
const summary = buildDailySummary(records, { now: new Date().toISOString() });

return [{ json: summary }];`,
			[60, 300],
		),
	);
	connect(connections, 'Read The Day', 'Build The Brief');

	nodes.push(
		node(
			'Draft The Brief',
			'n8n-nodes-base.microsoftOutlook',
			2,
			{
				resource: 'draft',
				operation: 'create',
				subject: '=Daily brief, {{ $json.date }}',
				bodyContent: '={{ $json.text }}',
				additionalFields: { bodyContentType: 'Text', toRecipients: settings.mailbox.address },
			},
			[300, 300],
			outlookCreds,
		),
	);
	connect(connections, 'Build The Brief', 'Draft The Brief');

	return workflow('AOG Email Agent, Daily Executive Summary', nodes, connections, [
		sticky(
			[
				'## Daily executive summary',
				'',
				'Five sections, every day, whether or not they have anything in them:',
				'',
				settings.dailySummary.sections.map((s) => `- ${s}`).join('\n'),
				'',
				`An empty section prints "${settings.dailySummary.emptySectionText}" (SUMX-03). It is never omitted and never padded with yesterday.`,
				'',
				'Scoped to a 24 hour window. No carryover.',
			].join('\n'),
			[-400, -40],
			[480, 340],
		),
	]);
}

// ================================================================== main

write('01-inbound-pipeline.json', inboundPipeline());
write('02-stale-followup.json', staleFollowUp());
write('03-inbox-learning.json', inboxLearning());
write('04-daily-summary.json', dailySummaryWorkflow());
