import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { ROOT, settings } from './config.js';

/**
 * Thin Anthropic Messages client for the offline eval harness.
 *
 * n8n itself never calls this. In the running workflow the Text Classifier and Information
 * Extractor nodes talk to the model through their own Chat Model sub-node. This exists so
 * the fixtures in test/ can exercise the exact same prompt text outside n8n and score it,
 * which is what the spec's "run every fixture three times" needs.
 *
 * Cassette cache: set AOG_LLM_CACHE=1 and responses are recorded to test/.cassettes.json,
 * then replayed. Makes a scored run reproducible and lets the suite run without a key once
 * it has been recorded at least once.
 */

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const CASSETTE_PATH = join(ROOT, 'test', '.cassettes.json');

const useCache = () => process.env.AOG_LLM_CACHE === '1';

let cassettes = null;

function loadCassettes() {
	if (cassettes) return cassettes;
	cassettes = existsSync(CASSETTE_PATH) ? JSON.parse(readFileSync(CASSETTE_PATH, 'utf8')) : {};
	return cassettes;
}

function saveCassettes() {
	if (!cassettes) return;
	mkdirSync(dirname(CASSETTE_PATH), { recursive: true });
	writeFileSync(CASSETTE_PATH, `${JSON.stringify(cassettes, null, 2)}\n`);
}

const cacheKey = (payload, pass) =>
	createHash('sha256').update(`${pass}::${JSON.stringify(payload)}`).digest('hex').slice(0, 32);

export class MissingApiKeyError extends Error {
	constructor() {
		super(
			'ANTHROPIC_API_KEY is not set. Export a key to run the model-backed suites, or run with AOG_LLM_CACHE=1 against a recorded cassette.',
		);
		this.name = 'MissingApiKeyError';
	}
}

/**
 * @param {object} args
 * @param {string} args.system
 * @param {string} args.user
 * @param {string} [args.model]
 * @param {number} [args.temperature]
 * @param {number} [args.maxTokens]
 * @param {number} [args.pass] which of the three fixture passes this is, so the cache keeps them apart
 * @returns {Promise<string>} the assistant text
 */
export async function callModel({
	system,
	user,
	model = settings.llm.classifierModel,
	temperature = settings.llm.temperature,
	maxTokens = settings.llm.maxTokens,
	pass = 0,
}) {
	const payload = {
		model,
		max_tokens: maxTokens,
		temperature,
		system,
		messages: [{ role: 'user', content: user }],
	};

	const key = cacheKey(payload, pass);

	if (useCache()) {
		const hit = loadCassettes()[key];
		if (hit) return hit;
	}

	const apiKey = process.env.ANTHROPIC_API_KEY;
	if (!apiKey) throw new MissingApiKeyError();

	const response = await fetch(API_URL, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'x-api-key': apiKey,
			'anthropic-version': API_VERSION,
		},
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		throw new Error(`anthropic ${response.status}: ${await response.text()}`);
	}

	const body = await response.json();
	const text = (body.content ?? [])
		.filter((block) => block.type === 'text')
		.map((block) => block.text)
		.join('')
		.trim();

	if (useCache()) {
		loadCassettes()[key] = text;
		saveCassettes();
	}

	return text;
}

/** Pull the first JSON object out of a model response, fenced or bare. */
export function parseJsonResponse(text) {
	const trimmed = String(text ?? '').trim();

	const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
	const candidate = fenced ? fenced[1].trim() : trimmed;

	try {
		return JSON.parse(candidate);
	} catch {
		const start = candidate.indexOf('{');
		const end = candidate.lastIndexOf('}');
		if (start !== -1 && end > start) {
			return JSON.parse(candidate.slice(start, end + 1));
		}
		throw new Error(`model did not return JSON:\n${trimmed.slice(0, 400)}`);
	}
}
