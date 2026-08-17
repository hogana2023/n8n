import { buildInvocationKwargs, usesAdaptiveThinking } from '../LmChatAnthropic.node';

/**
 * The Claude 5 family, plus Opus 4.7 and 4.8, reject `temperature`, `top_p`, `top_k` and
 * the fixed `budget_tokens` thinking budget with a 400. Before this handling existed the
 * node sent `temperature` on every request and `budget_tokens` whenever thinking was on,
 * so every call to one of those models failed. These tests pin both request shapes.
 */
describe('LmChatAnthropic request shape', () => {
	describe('usesAdaptiveThinking', () => {
		test.each([
			'claude-opus-5',
			'claude-sonnet-5',
			'claude-fable-5',
			'claude-mythos-5',
			'claude-opus-4-7',
			'claude-opus-4-8',
		])('%s uses adaptive thinking', (model) => {
			expect(usesAdaptiveThinking(model)).toBe(true);
		});

		test.each([
			'claude-3-5-sonnet-20241022',
			'claude-3-opus-20240229',
			'claude-3-7-sonnet-20250219',
			'claude-sonnet-4-5',
			'claude-opus-4-6',
			'claude-haiku-4-5',
			'claude-2.1',
		])('%s keeps the budgeted shape', (model) => {
			expect(usesAdaptiveThinking(model)).toBe(false);
		});

		it('does not match a model that merely starts with a known prefix', () => {
			expect(usesAdaptiveThinking('claude-opus-50')).toBe(false);
			expect(usesAdaptiveThinking('claude-sonnet-55')).toBe(false);
		});
	});

	describe('buildInvocationKwargs, adaptive models', () => {
		it('clears every sampling parameter', () => {
			const kwargs = buildInvocationKwargs('claude-sonnet-5', {
				temperature: 0.7,
				topP: 0.9,
				topK: 40,
			});

			expect(kwargs).toHaveProperty('temperature', undefined);
			expect(kwargs).toHaveProperty('top_p', undefined);
			expect(kwargs).toHaveProperty('top_k', undefined);
		});

		it('sends adaptive thinking and never a token budget', () => {
			const kwargs = buildInvocationKwargs('claude-opus-5', { thinking: true, thinkingBudget: 8000 });

			expect(kwargs.thinking).toEqual({ type: 'adaptive' });
			expect(JSON.stringify(kwargs)).not.toContain('budget_tokens');
		});

		it('passes effort through and defaults it to high', () => {
			expect(buildInvocationKwargs('claude-opus-5', { effort: 'low' }).output_config).toEqual({
				effort: 'low',
			});
			expect(buildInvocationKwargs('claude-opus-5', {}).output_config).toEqual({ effort: 'high' });
		});

		it('always sets max_tokens, since adaptive thinking spends from it', () => {
			expect(buildInvocationKwargs('claude-opus-5', {}).max_tokens).toBe(4096);
			expect(buildInvocationKwargs('claude-opus-5', { maxTokensToSample: 16000 }).max_tokens).toBe(
				16000,
			);
		});

		it('serializes to a body with no rejected key present', () => {
			// JSON.stringify drops undefined, which is what actually removes the fields
			// from the outbound request.
			const body = JSON.parse(
				JSON.stringify(
					buildInvocationKwargs('claude-sonnet-5', { temperature: 0.7, topP: 0.9, topK: 40 }),
				),
			);

			for (const rejected of ['temperature', 'top_p', 'top_k', 'budget_tokens']) {
				expect(body).not.toHaveProperty(rejected);
			}
			expect(body.thinking).toEqual({ type: 'adaptive' });
		});
	});

	describe('buildInvocationKwargs, older models', () => {
		it('returns no overrides when thinking is off', () => {
			expect(buildInvocationKwargs('claude-3-5-sonnet-20241022', { temperature: 0.7 })).toEqual({});
		});

		it('keeps the budgeted thinking shape', () => {
			const kwargs = buildInvocationKwargs('claude-3-7-sonnet-20250219', {
				thinking: true,
				thinkingBudget: 2048,
				maxTokensToSample: 8192,
			});

			expect(kwargs.thinking).toEqual({ type: 'enabled', budget_tokens: 2048 });
			expect(kwargs.max_tokens).toBe(8192);
			expect(kwargs).not.toHaveProperty('output_config');
		});

		it('falls back to the minimum budget', () => {
			const kwargs = buildInvocationKwargs('claude-3-7-sonnet-20250219', { thinking: true });
			expect(kwargs.thinking).toEqual({ type: 'enabled', budget_tokens: 1024 });
		});
	});
});
