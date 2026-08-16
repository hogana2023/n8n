/**
 * Turning a mail item into the single block of text the classifier and extractor read.
 *
 * The n8n workflow builds the same string in a Set node so the prompt sees byte-identical
 * input in production and in the harness. If these two drift, the fixture scores stop
 * meaning anything, so keep them in step.
 */

const clean = (s) => String(s ?? '').replace(/\r\n/g, '\n').trim();

/** Strip quoted history so a long reply chain does not drown the live message. */
export function stripQuoted(body) {
	const text = clean(body);
	const markers = [
		/\n-{2,}\s*Original Message\s*-{2,}/i,
		/\nOn .{0,120}\bwrote:\s*\n/,
		/\n_{10,}\n/,
		/\nFrom:\s.+\nSent:\s/i,
	];
	let cut = text.length;
	for (const marker of markers) {
		const hit = text.match(marker);
		if (hit?.index !== undefined && hit.index < cut) cut = hit.index;
	}
	return text.slice(0, cut).trim();
}

/**
 * @param {object} email {from, to, subject, body, receivedAt, attachments?}
 * @param {object} [opts]
 * @param {boolean} [opts.withReferenceDate] extractor needs it, classifier does not
 * @returns {string}
 */
export function renderEmail(email, opts = {}) {
	const lines = [];

	if (opts.withReferenceDate && email.receivedAt) {
		lines.push(`REFERENCE DATE: ${clean(email.receivedAt)}`, '');
	}

	lines.push(`From: ${clean(email.from)}`);
	if (email.to) lines.push(`To: ${clean(email.to)}`);
	lines.push(`Subject: ${clean(email.subject) || '(no subject)'}`);

	const attachments = email.attachments ?? [];
	if (attachments.length) {
		lines.push(`Attachments: ${attachments.map((a) => (typeof a === 'string' ? a : a.name)).join(', ')}`);
	}

	lines.push('', stripQuoted(email.body));

	return lines.join('\n').trim();
}

/**
 * Threads classify on the whole conversation, oldest first, so the opening request stays
 * visible. CLS-13 fails if only the last message is shown, because the last message is
 * "sounds good, talk soon".
 */
export function renderThread(thread, opts = {}) {
	const messages = thread.messages ?? [];
	const lines = [];

	if (opts.withReferenceDate && (thread.receivedAt ?? messages.at(-1)?.receivedAt)) {
		lines.push(`REFERENCE DATE: ${clean(thread.receivedAt ?? messages.at(-1).receivedAt)}`, '');
	}

	if (thread.subject) lines.push(`Subject: ${clean(thread.subject)}`, '');

	lines.push(`THREAD, ${messages.length} message(s), oldest first:`, '');

	messages.forEach((message, index) => {
		lines.push(`--- message ${index + 1} of ${messages.length} ---`);
		lines.push(`From: ${clean(message.from)}`);
		if (message.receivedAt) lines.push(`Date: ${clean(message.receivedAt)}`);
		if (message.subject) lines.push(`Subject: ${clean(message.subject)}`);
		lines.push('', stripQuoted(message.body), '');
	});

	return lines.join('\n').trim();
}

/** One entry point, so callers do not have to branch on shape. */
export function renderInput(fixtureInput, opts = {}) {
	return fixtureInput.messages ? renderThread(fixtureInput, opts) : renderEmail(fixtureInput, opts);
}

export function senderOf(fixtureInput) {
	if (fixtureInput.from) return fixtureInput.from;
	const messages = fixtureInput.messages ?? [];
	return messages[0]?.from ?? '';
}
