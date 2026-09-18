import { describe, expect, it, beforeAll } from 'bun:test';
import { nilyoPlugin } from '../index';
import { createMockRuntime, createTestMemory, createTestState, setupLoggerSpies } from './test-utils';

beforeAll(() => {
  setupLoggerSpies();
});

describe('nilyoPlugin shape', () => {
  it('exposes the expected metadata', () => {
    expect(nilyoPlugin.name).toBe('plugin-nilyo');
    expect(nilyoPlugin.description).toContain('LinkedIn');
  });

  it('registers one connected-accounts provider', () => {
    expect(nilyoPlugin.providers?.map((p) => p.name)).toEqual(['NILYO_CONNECTED_ACCOUNTS']);
  });

  it('registers every Nilyo action with a unique name and at least one example', () => {
    const names = nilyoPlugin.actions?.map((a) => a.name) ?? [];
    expect(names).toEqual([
      'NILYO_LIST_ACCOUNTS',
      'NILYO_LINKEDIN_GET_PROFILE',
      'NILYO_LINKEDIN_SEARCH_PEOPLE',
      'NILYO_LINKEDIN_SEND_INVITATION',
      'NILYO_MESSAGING_SEND_TO_CONTACT',
      'NILYO_MESSAGING_LIST_CHATS',
      'NILYO_EMAIL_LIST',
      'NILYO_EMAIL_SEND',
      'NILYO_CALENDAR_LIST_CALENDARS',
      'NILYO_CALL_TOOL',
    ]);
    expect(new Set(names).size).toBe(names.length);
    for (const action of nilyoPlugin.actions ?? []) {
      expect(action.examples?.length ?? 0).toBeGreaterThan(0);
    }
  });
});

describe('action validate() gating on NILYO_API_TOKEN', () => {
  it('is selectable once a token is configured', async () => {
    const runtime = createMockRuntime();
    const message = createTestMemory();
    const state = createTestState();
    for (const action of nilyoPlugin.actions ?? []) {
      expect(await action.validate(runtime, message, state)).toBe(true);
    }
  });

  it('is not selectable without a token', async () => {
    const runtime = createMockRuntime({ getSetting: (() => null) as any });
    const message = createTestMemory();
    const state = createTestState();
    for (const action of nilyoPlugin.actions ?? []) {
      expect(await action.validate(runtime, message, state)).toBe(false);
    }
  });
});

describe('NILYO_LIST_ACCOUNTS handler', () => {
  it('calls the Nilyo MCP tool and reports the result through the callback', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: { structuredContent: { accounts: [{ provider: 'linkedin', name: 'Jane' }] } },
        }),
        { status: 200 }
      )) as typeof fetch;

    try {
      const runtime = createMockRuntime();
      const message = createTestMemory();
      const action = nilyoPlugin.actions?.find((a) => a.name === 'NILYO_LIST_ACCOUNTS');
      expect(action).toBeDefined();

      const calls: any[] = [];
      const result = await action!.handler(runtime, message, createTestState(), {}, (async (content: any) => {
        calls.push(content);
      }) as any);

      expect(result.success).toBe(true);
      expect(calls.length).toBe(1);
      expect(calls[0].text).toContain('linkedin');
      expect(calls[0].actions).toEqual(['NILYO_LIST_ACCOUNTS']);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('reports a Nilyo MCP error through the callback instead of throwing', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, error: { message: 'invalid token' } }), {
        status: 200,
      })) as typeof fetch;

    try {
      const runtime = createMockRuntime();
      const message = createTestMemory();
      const action = nilyoPlugin.actions?.find((a) => a.name === 'NILYO_LIST_ACCOUNTS');

      const calls: any[] = [];
      const result = await action!.handler(runtime, message, createTestState(), {}, (async (content: any) => {
        calls.push(content);
      }) as any);

      expect(result.success).toBe(false);
      expect(calls[0].text).toContain('invalid token');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
