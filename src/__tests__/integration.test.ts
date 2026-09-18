import { describe, expect, it, beforeAll } from 'bun:test';
import { nilyoPlugin } from '../index';
import { createMockRuntime, createTestMemory, createTestState, setupLoggerSpies } from './test-utils';

/**
 * Integration tests exercising a full action chain: extractParams() (via a mocked TEXT_SMALL model)
 * feeding into the Nilyo MCP client (via a mocked fetch), end to end through an action handler.
 */

beforeAll(() => {
  setupLoggerSpies();
});

describe('Integration: NILYO_LINKEDIN_GET_PROFILE end to end', () => {
  it('extracts the profile URL from the conversation and resolves it through the MCP tool', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: { structuredContent: { profile: { id: 'abc123', name: 'Jane Doe' } } },
        }),
        { status: 200 }
      )) as typeof fetch;

    try {
      const runtime = createMockRuntime({
        useModel: (async () =>
          '<response><profileUrlOrId>https://www.linkedin.com/in/jane-doe/</profileUrlOrId></response>') as any,
      });
      const message = createTestMemory({ content: { text: 'Look up https://www.linkedin.com/in/jane-doe/', source: 'test' } });
      const action = nilyoPlugin.actions?.find((a) => a.name === 'NILYO_LINKEDIN_GET_PROFILE');
      expect(action).toBeDefined();

      const calls: any[] = [];
      const result = await action!.handler(runtime, message, createTestState(), {}, (async (content: any) => {
        calls.push(content);
      }) as any);

      expect(result.success).toBe(true);
      expect(calls[0].text).toContain('Jane Doe');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('asks for a profile when extraction finds nothing, without calling the MCP', async () => {
    let fetchCalled = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      return new Response('{}', { status: 200 });
    }) as typeof fetch;

    try {
      const runtime = createMockRuntime({
        useModel: (async () => '<response><profileUrlOrId></profileUrlOrId></response>') as any,
      });
      const message = createTestMemory({ content: { text: 'Look someone up on LinkedIn', source: 'test' } });
      const action = nilyoPlugin.actions?.find((a) => a.name === 'NILYO_LINKEDIN_GET_PROFILE');

      const result = await action!.handler(runtime, message, createTestState(), {}, undefined);

      expect(result.success).toBe(false);
      expect(fetchCalled).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('Integration: NILYO_CONNECTED_ACCOUNTS provider', () => {
  it('summarizes the connected accounts for the agent context', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: { structuredContent: { accounts: [{ provider: 'whatsapp', name: 'Personal' }] } },
        }),
        { status: 200 }
      )) as typeof fetch;

    try {
      const runtime = createMockRuntime();
      const provider = nilyoPlugin.providers?.[0];
      expect(provider).toBeDefined();

      const result = await provider!.get(runtime, createTestMemory(), createTestState());
      expect(result.text).toContain('whatsapp');
      expect((result.values as any).nilyoAccounts).toHaveLength(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('returns empty context without a configured token', async () => {
    const runtime = createMockRuntime({ getSetting: (() => null) as any });
    const provider = nilyoPlugin.providers?.[0];

    const result = await provider!.get(runtime, createTestMemory(), createTestState());
    expect(result.text).toBe('');
  });
});
