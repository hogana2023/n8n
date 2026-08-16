/**
 * Guardrail lint for generated reply drafts.
 *
 * Suite 5 asks for two separate things and this file does both:
 *   DRV-01  "Lint: no em dash, no banned vocabulary, contractions present"  -> style rules
 *   DRV-03  "Expect absent: any dollar figure"                             -> fabrication rules
 *
 * The bar in the spec is 1.00 on the lint and 0 fabricated commitments, which means this
 * runs as a gate and not as a score. A draft that fails does not reach the drafts folder,
 * it goes back for one regeneration and then to a human if it fails again.
 *
 * Everything here is pure string work. No model reviews the model.
 */

const BANNED_WORDS = [
	'delve', 'delving', 'leverage', 'leveraging', 'utilize', 'utilizing', 'harness', 'unlock',
	'unleash', 'empower', 'facilitate', 'foster', 'bolster', 'streamline', 'spearhead',
	'underscore', 'underscores', 'illuminate', 'elucidate', 'embark', 'unravel', 'elevate',
	'reimagine', 'revolutionize', 'transcend', 'resonate', 'showcase', 'grapple', 'intertwine',
	'garner', 'evoke', 'exemplify', 'amplify', 'augment', 'conceptualize', 'glean', 'strive',
	'thrive', 'unveil', 'multifaceted', 'nuanced', 'intricate', 'seamless', 'seamlessly',
	'robust', 'comprehensive', 'scalable', 'cutting-edge', 'holistic', 'meticulous',
	'meticulously', 'groundbreaking', 'transformative', 'innovative', 'vibrant', 'compelling',
	'invaluable', 'paramount', 'poignant', 'timeless', 'relentless', 'tireless', 'noteworthy',
	'commendable', 'exemplary', 'versatile', 'unprecedented', 'profound', 'captivating',
	'daunting', 'burgeoning', 'granular', 'impactful', 'mission-critical', 'pervasive',
	'thought-provoking', 'unparalleled', 'unwavering', 'ever-evolving', 'state-of-the-art',
	'game-changing', 'tapestry', 'realm', 'testament', 'beacon', 'myriad', 'kaleidoscope',
	'landscape', 'ecosystem', 'paradigm', 'nexus', 'catalyst', 'synergy', 'roadmap', 'toolkit',
	'facet', 'endeavor', 'groundwork', 'cornerstone', 'bedrock', 'pinnacle', 'crucible',
	'linchpin', 'plethora', 'stakeholders', 'trajectory', 'touchpoint', 'deliverables',
	'bandwidth', 'furthermore', 'moreover', 'notably', 'crucially', 'consequently',
	'accordingly', 'effortlessly', 'fundamentally', 'holistically', 'undoubtedly',
	'subsequently', 'conversely', 'akin', 'amidst', 'arduous', 'hence', 'herein', 'thereby',
	'therein', 'thereof', 'thus', 'whilst', 'notwithstanding', 'nonetheless', 'nevertheless',
	'kindly',
];

const BANNED_PHRASES = [
	'i hope this email finds you', 'i trust this email finds you', 'i hope this finds you',
	'thank you for reaching out', 'thanks for reaching out', 'i wanted to reach out',
	'please do not hesitate', "please don't hesitate", 'do not hesitate to reach out',
	'feel free to reach out', 'let me know if you need anything else',
	'i look forward to hearing from you', 'looking forward to hearing from you',
	'rest assured', 'at your earliest convenience', 'per my last email',
	'it is worth noting', "it's worth noting", 'it is important to note',
	"it's important to note", 'that being said', 'in conclusion', 'in summary',
	'to summarize', 'at the end of the day', 'a key takeaway', 'the bottom line is',
	'best regards', 'warm regards', 'as an ai', 'as a large language model',
	'here is a comprehensive', 'in today', 'let us delve', "let's delve", "let's dive",
	'at its core', 'this underscores', 'a testament to',
];

const CONTRACTIONS =
	/\b(?:it'?s|i'?m|i'?ll|i'?ve|i'?d|we'?ll|we'?re|we'?ve|we'?d|you'?re|you'?ll|you'?ve|don'?t|doesn'?t|didn'?t|can'?t|won'?t|wouldn'?t|shouldn'?t|couldn'?t|isn'?t|aren'?t|wasn'?t|weren'?t|haven'?t|hasn'?t|hadn'?t|there'?s|that'?s|here'?s|let'?s|they'?re|they'?ll|he'?s|she'?s|what'?s)\b/i;

/** $1,200 / 1200 dollars / USD 1200 / 45.50 per foot / 15% off. */
const MONEY_PATTERNS = [
	/\$\s?\d/,
	/\b\d[\d,]*(?:\.\d{2})?\s?(?:dollars|usd)\b/i,
	/\busd\s?\$?\d/i,
	/\b\d[\d,]*(?:\.\d{2})?\s?(?:per|\/)\s?(?:foot|ft|lf|boring|hour|hr|day|sample|test)\b/i,
];

/** "not just X, but Y" and its rewordings. */
const NOT_JUST_PATTERNS = [
	/\b(?:not|isn'?t|aren'?t|wasn'?t|weren'?t)\s+just\b[^.!?]{0,60}\bbut\b/i,
	/\bisn'?t (?:just )?about\b[^.!?]{0,60}\bit'?s about\b/i,
	/\bit'?s not\b[^.!?]{0,40}\bit'?s\b/i,
	/\bthe question isn'?t\b[^.!?]{0,60}\bthe question is\b/i,
];

/** A posed question answered in the next breath: "The timeline? Two weeks." */
const SELF_POSED_QUESTION = /(?:^|[.!?]\s)[A-Z][^.!?\n]{0,40}\?\s+[A-Z][^?\n]{0,60}[.!]/;

const violation = (rule, detail, match) => ({ rule, detail, match: match ?? null });

const wordsIn = (text) => text.toLowerCase().match(/[a-z][a-z'-]*/g) ?? [];

/**
 * @param {string} draft            the generated reply body
 * @param {object} [opts]
 * @param {string} [opts.sourceText] thread + extracted facts, everything the draft is allowed to know
 * @param {number} [opts.maxWords]
 * @returns {{pass: boolean, violations: Array<{rule: string, detail: string, match: string|null}>, wordCount: number}}
 */
export function lintDraft(draft, opts = {}) {
	const text = String(draft ?? '');
	const source = String(opts.sourceText ?? '');
	const maxWords = opts.maxWords ?? 150;
	const v = [];

	if (!text.trim()) {
		return { pass: false, violations: [violation('empty', 'draft is empty')], wordCount: 0 };
	}

	// --- punctuation -------------------------------------------------------
	if (/[—–]/.test(text)) {
		v.push(violation('em_dash', 'em or en dash present', text.match(/[—–].{0,30}/)?.[0]));
	}
	if (/\s--\s/.test(text)) {
		v.push(violation('em_dash', 'double hyphen used as a dash'));
	}
	if (text.includes(';')) {
		v.push(violation('semicolon', 'semicolon present'));
	}
	if (text.includes('…')) {
		v.push(violation('ellipsis', 'unicode ellipsis present'));
	}

	// --- vocabulary --------------------------------------------------------
	const words = new Set(wordsIn(text));
	for (const banned of BANNED_WORDS) {
		if (banned.includes('-') ? text.toLowerCase().includes(banned) : words.has(banned)) {
			v.push(violation('banned_word', `banned vocabulary: "${banned}"`, banned));
		}
	}

	const lower = text.toLowerCase();
	for (const phrase of BANNED_PHRASES) {
		if (lower.includes(phrase)) {
			v.push(violation('banned_phrase', `banned phrase: "${phrase}"`, phrase));
		}
	}

	// --- required voice ----------------------------------------------------
	if (!CONTRACTIONS.test(text)) {
		v.push(violation('no_contractions', 'no contractions, reads stiff'));
	}

	// --- banned shapes -----------------------------------------------------
	for (const pattern of NOT_JUST_PATTERNS) {
		const hit = text.match(pattern);
		if (hit) v.push(violation('not_just_x_but_y', '"not just X, but Y" shape', hit[0]));
	}
	const posed = text.match(SELF_POSED_QUESTION);
	if (posed) {
		v.push(violation('self_posed_question', 'question posed and answered immediately', posed[0].trim()));
	}

	const openers = (text.match(/(?:^|\n)\s*([A-Za-z']+)/g) ?? []).map((s) => s.trim().toLowerCase());
	for (let i = 0; i + 2 < openers.length; i++) {
		if (openers[i] && openers[i] === openers[i + 1] && openers[i] === openers[i + 2]) {
			v.push(violation('anaphora', `three lines opening with "${openers[i]}"`));
			break;
		}
	}

	// --- fabrication guard -------------------------------------------------
	for (const pattern of MONEY_PATTERNS) {
		const hit = text.match(pattern);
		if (!hit) continue;
		if (source && source.toLowerCase().includes(hit[0].toLowerCase())) continue;
		v.push(violation('fabricated_price', 'dollar figure not present in the source thread', hit[0]));
	}

	// --- length ------------------------------------------------------------
	const wordCount = wordsIn(text).length;
	if (wordCount > maxWords) {
		v.push(violation('too_long', `${wordCount} words, limit ${maxWords}`));
	}

	return { pass: v.length === 0, violations: v, wordCount };
}

export const _internals = { BANNED_WORDS, BANNED_PHRASES, MONEY_PATTERNS };
