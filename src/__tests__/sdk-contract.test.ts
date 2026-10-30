import { describe, expect, it } from 'bun:test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { State } from '@elizaos/core';

// Optional local rebuild; never replace files in an installed (possibly hard-linked) SDK.
const candidate = process.env.NILYO_AUDIT_CORE_ENTRY;
const core: typeof import('@elizaos/core') = await import(
  candidate ? pathToFileURL(resolve(candidate)).href : '@elizaos/core'
);

const state = (values: Record<string, unknown>): State => ({
  text: '',
  values,
  data: {},
});

describe('real core prompt/XML migration contracts (synthetic, no model or provider)', () => {
  it('uses state.values and preserves message text without HTML escaping', () => {
    const input = {
      ...state({ recentMessages: 'Alice <alice@example.test> & Bob' }),
      recentMessages: 'old',
    };
    expect(
      core.composePromptFromState({
        state: input,
        template: '{{recentMessages}}',
      })
    ).toBe('Alice <alice@example.test> & Bob');
  });

  it('does not interpret template syntax inside conversation values', () => {
    const text = '{{#if secret}}changed{{/if}} {{secret}}';
    expect(
      core.composePromptFromState({
        state: state({ recentMessages: text, secret: 'private' }),
        template: '{{recentMessages}}',
      })
    ).toBe(text);
  });

  it('does not expose an object constructor through the prompt wrapper defaults', () => {
    expect(
      core.composePromptFromState({
        state: state({ probe: {} }),
        template: '{{probe.constructor}}',
      })
    ).toBe('');
  });

  it('rejects an AST object at the string-only wrapper boundary', () => {
    // Empty benign AST only: no generated expressions or executable payload.
    const ast = { type: 'Program', body: [], strip: {} };
    expect(() =>
      core.composePromptFromState({
        state: state({}),
        template: ast as unknown as string,
      })
    ).toThrow();
  });

  it('retains the small-model XML extraction contract, including empty fields', () => {
    expect(core.ModelType.TEXT_SMALL).toBe('TEXT_SMALL');
    expect(core.parseKeyValueXml('<response><name>Alice</name><text>Hello</text><cc></cc></response>')).toEqual({
      name: 'Alice',
      text: 'Hello',
      cc: '',
    });
    expect(core.parseKeyValueXml('no XML response')).toBeNull();
  });
});
