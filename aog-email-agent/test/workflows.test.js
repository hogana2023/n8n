import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { ROOT, categories, settings } from '../src/config.js';

/**
 * The workflow JSON is assembled by string surgery in bin/build-workflows.mjs: real module
 * source with its imports stripped, pasted into Code nodes. That is the only way to keep
 * one tested implementation when n8n Code nodes cannot import anything. It is also exactly
 * the kind of thing that breaks silently, so every generated body gets parsed here.
 *
 * Run `node bin/build-workflows.mjs` after touching src/ or config/, or these fail.
 */

const dir = join(ROOT, 'workflows');
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
const load = (file) => JSON.parse(readFileSync(join(dir, file), 'utf8'));

describe('generated n8n workflows', () => {
	it('all four workflows are present', () => {
		assert.deepEqual(files.sort(), [
			'01-inbound-pipeline.json',
			'02-stale-followup.json',
			'03-inbox-learning.json',
			'04-daily-summary.json',
		]);
	});

	for (const file of files) {
		describe(file, () => {
			const wf = load(file);

			it('has a name, nodes and connections', () => {
				assert.ok(wf.name);
				assert.ok(Array.isArray(wf.nodes) && wf.nodes.length > 0);
				assert.equal(typeof wf.connections, 'object');
			});

			it('node names are unique', () => {
				const names = wf.nodes.map((n) => n.name);
				assert.equal(new Set(names).size, names.length);
			});

			it('every connection points at a node that exists', () => {
				const names = new Set(wf.nodes.map((n) => n.name));
				for (const [from, outputs] of Object.entries(wf.connections)) {
					assert.ok(names.has(from), `connection from unknown node "${from}"`);
					for (const group of Object.values(outputs)) {
						for (const branch of group) {
							for (const target of branch) {
								assert.ok(names.has(target.node), `"${from}" points at unknown node "${target.node}"`);
							}
						}
					}
				}
			});

			it('every Code node body parses as JavaScript', () => {
				for (const codeNode of wf.nodes.filter((n) => n.type === 'n8n-nodes-base.code')) {
					assert.doesNotThrow(
						// eslint-disable-next-line no-new-func
						() => new Function(codeNode.parameters.jsCode),
						`Code node "${codeNode.name}" in ${file} does not parse`,
					);
				}
			});

			it('no import or export statement survived the inlining', () => {
				for (const codeNode of wf.nodes.filter((n) => n.type === 'n8n-nodes-base.code')) {
					const body = codeNode.parameters.jsCode;
					assert.ok(!/^\s*import\s/m.test(body), `"${codeNode.name}" still has an import`);
					assert.ok(!/^\s*export\s/m.test(body), `"${codeNode.name}" still has an export`);
				}
			});

			it('carries no credential values, only placeholders', () => {
				const serialized = JSON.stringify(wf);

				// Shapes, not literals. A test that hardcodes the secret it is guarding
				// against has leaked it into the repo itself.
				const secretShapes = [
					/sk-ant-[A-Za-z0-9]/,
					/"(?:client_secret|clientSecret|password|accessToken|refresh_token)"\s*:\s*"[^"]+"/i,
					/\bBearer\s+[A-Za-z0-9._-]{16,}/,
				];
				for (const shape of secretShapes) {
					assert.ok(!shape.test(serialized), `${file} embeds something matching ${shape}`);
				}

				for (const n of wf.nodes.filter((n) => n.credentials)) {
					for (const credential of Object.values(n.credentials)) {
						assert.equal(credential.id, 'REPLACE_ME');
					}
				}
			});

			it('never sends mail, only drafts it', () => {
				for (const n of wf.nodes.filter((n) => n.type === 'n8n-nodes-base.microsoftOutlook')) {
					const { resource, operation, options } = n.parameters;
					assert.ok(
						!(resource === 'message' && operation === 'send'),
						`"${n.name}" sends a message`,
					);
					assert.ok(
						!(resource === 'draft' && operation === 'send'),
						`"${n.name}" sends a draft`,
					);
					if (resource === 'message' && operation === 'reply') {
						assert.equal(options?.saveAsDraft, true, `"${n.name}" replies without saveAsDraft`);
					}
				}
			});
		});
	}

	describe('inbound pipeline specifics', () => {
		const wf = load('01-inbound-pipeline.json');
		const byName = new Map(wf.nodes.map((n) => [n.name, n]));

		it('the classifier carries the eight explicit bins and falls back to Other', () => {
			const classifier = byName.get('Text Classifier');
			const configured = classifier.parameters.categories.categories.map((c) => c.category);

			assert.equal(configured.length, 8);
			assert.ok(!configured.includes('Unclassified'), 'Unclassified must be the fallback branch');
			assert.equal(classifier.parameters.options.fallback, 'other');
			assert.equal(classifier.parameters.options.multiClass, false);
		});

		it('all nine classifier outputs are wired to their own bin', () => {
			const outputs = wf.connections['Text Classifier'].main;
			assert.equal(outputs.length, 9, 'a bin is unwired, messages would be dropped');

			outputs.forEach((branch, index) => {
				assert.equal(branch.length, 1);
				assert.equal(branch[0].node, `Bin: ${categories[index].category}`);
			});
		});

		it('every bin node stamps the folder from the config', () => {
			for (const category of categories) {
				const bin = byName.get(`Bin: ${category.category}`);
				const folder = bin.parameters.assignments.assignments.find((a) => a.name === 'targetFolder');
				assert.equal(folder.value, category.folder);
			}
		});

		it('RED LINE: the tier lookup runs before the classifier and has no model attached', () => {
			assert.ok(byName.has('Priority Tier Lookup'));
			assert.deepEqual(wf.connections['Priority Tier Lookup'].main[0].map((c) => c.node), ['Text Classifier']);
			assert.deepEqual(wf.connections['Normalize Message'].main[0].map((c) => c.node), ['Priority Tier Lookup']);

			// A model can only reach a node through an ai_languageModel connection.
			const modelTargets = Object.values(wf.connections)
				.flatMap((outputs) => outputs.ai_languageModel ?? [])
				.flat()
				.map((c) => c.node);
			assert.ok(!modelTargets.includes('Priority Tier Lookup'));
		});

		it('the classifier, extractor and drafter each have a model attached', () => {
			for (const target of ['Text Classifier', 'Information Extractor', 'Write Draft']) {
				const attached = Object.entries(wf.connections).some(([, outputs]) =>
					(outputs.ai_languageModel ?? []).flat().some((c) => c.node === target),
				);
				assert.ok(attached, `"${target}" has no model`);
			}
		});

		it('the lint gate sits between the drafter and the mailbox', () => {
			assert.deepEqual(wf.connections['Write Draft'].main[0].map((c) => c.node), ['Lint Draft']);
			assert.deepEqual(wf.connections['Lint Draft'].main[0].map((c) => c.node).sort(), [
				'Draft Clean?',
				'Stage Project Record',
			]);
			assert.deepEqual(wf.connections['Draft Clean?'].main[0].map((c) => c.node), ['Save Reply Draft']);
			assert.deepEqual(wf.connections['Draft Clean?'].main[1].map((c) => c.node), ['Flag Draft For Human']);
		});

		it('RED LINE: the record stager has no live writer wired in', () => {
			const stager = byName.get('Stage Project Record');
			assert.ok(stager.parameters.jsCode.includes('new ProjectAssistantSink()'));
			assert.ok(!/liveWriter\s*:/.test(stager.parameters.jsCode), 'a live writer is attached');
		});

		it('no model sub-node sends a rejected sampling parameter', () => {
			const models = wf.nodes.filter((n) => n.type.endsWith('.lmChatAnthropic'));
			assert.equal(models.length, 3);

			for (const model of models) {
				const serialized = JSON.stringify(model.parameters);
				for (const rejected of ['temperature', 'topP', 'topK', 'thinkingBudget']) {
					assert.ok(!serialized.includes(rejected), `"${model.name}" sends ${rejected}`);
				}
				assert.ok(
					['low', 'medium', 'high', 'xhigh', 'max'].includes(model.parameters.options.effort),
					`"${model.name}" has no effort level`,
				);
			}
		});

		it('the extractor is handed the reference date and the routed bin', () => {
			const text = byName.get('Information Extractor').parameters.text;
			assert.ok(text.includes('extractorText'));
			assert.ok(text.includes('ROUTED AS'));
		});
	});
});
