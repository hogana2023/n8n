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

/** The account cannot make calls at all: no credit, or a rejected key. */
export class AccountError extends Error {
	constructor(message) {
		super(message);
		this.name = 'AccountError';
	}
}

export class RefusalError extends Error {
	constructor(details) {
		super(`model declined the request: ${details?.category ?? 'no category given'}`);
		this.name = 'RefusalError';
		this.details = details ?? null;
	}
}

/**
 * @param {object} args
 * @param {string} args.system
 * @param {string} args.user
 * @param {string} [args.model]
 * @param {'low'|'medium'|'high'|'xhigh'|'max'} [args.effort]
 * @param {number} [args.maxTokens]
 * @param {number} [args.pass] which of the three fixture passes this is, so the cache keeps them apart
 * @returns {Promise<string>} the assistant text
 */
export async function callModel({
	system,
	user,
	model = settings.llm.classifierModel,
	effort = settings.llm.effort.classifier,
	maxTokens = settings.llm.maxTokens,
	pass = 0,
}) {
	// No temperature, top_p or top_k. Every model this pipeline targets rejects them with
	// a 400. Depth is controlled by effort instead, and thinking is on by default on these
	// models whether or not it is asked for, so max_tokens has to cover it.
	const payload = {
		model,
		max_tokens: maxTokens,
		thinking: { type: 'adaptive' },
		output_config: { effort },
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
		const detail = await response.text();

		// Billing and auth failures are conditions to report, not defects to debug. They
		// look identical to a broken request in a stack trace, so they get their own type.
		if (/credit balance is too low/i.test(detail)) {
			throw new AccountError(
				'the Anthropic account has no credit. The key is valid, but every inference call is rejected until the account is topped up.',
			);
		}
		if (response.status === 401) {
			throw new AccountError('the Anthropic key was rejected. Check ANTHROPIC_API_KEY.');
		}

		throw new Error(`anthropic ${response.status}: ${detail}`);
	}

	const body = await response.json();

	// A decline is a 200 with an empty or partial content array, so this has to be checked
	// before reading content or the caller gets an unhelpful undefined.
	if (body.stop_reason === 'refusal') {
		throw new RefusalError(body.stop_details);
	}

	const text = (body.content ?? [])
		.filter((block) => block.type === 'text')
		.map((block) => block.text)
		.join('')
		.trim();

	if (body.stop_reason === 'max_tokens' && !text) {
		throw new Error(
			`model hit max_tokens (${maxTokens}) before writing any text. Adaptive thinking spends from the same budget, so raise llm.maxTokens or lower effort.`,
		);
	}

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
