import type { IAgentRuntime } from '@elizaos/core';

/** Remove empty optional fields so the MCP schema validation only sees what was filled in. */
export function compact<T extends Record<string, unknown>>(input: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value) && value.length === 0) continue;
    (out as Record<string, unknown>)[key] = value;
  }
  return out;
}

/** JSON-RPC call to the Nilyo MCP endpoint with the configured personal token. */
export async function nilyoRpc(
  runtime: IAgentRuntime,
  method: string,
  params: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  const token = runtime.getSetting('NILYO_API_TOKEN');
  if (!token) {
    throw new Error(
      'NILYO_API_TOKEN is not configured. Create a personal token from https://nilyo.com/account -> Agent access and set it in this character/agent config.'
    );
  }
  const baseUrl = String(runtime.getSetting('NILYO_BASE_URL') || 'https://nilyo.com').replace(/\/$/, '');
  const response = await fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
  });
  if (!response.ok) {
    throw new Error(`Nilyo MCP request failed: ${response.status} ${response.statusText}`);
  }
  const json = (await response.json()) as { result?: Record<string, unknown>; error?: { message?: string } };
  if (json.error) {
    throw new Error(json.error.message ?? 'Nilyo MCP error');
  }
  return json.result ?? {};
}

/**
 * Call one Nilyo tool. Structured next-step actions (connect_account, reconnect_account, subscribe,
 * choose_account…) are returned as data with `action` set so the caller can surface them instead of
 * treating a missing/expired connection as a hard failure.
 */
export async function nilyoTool(
  runtime: IAgentRuntime,
  name: string,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const result = await nilyoRpc(runtime, 'tools/call', { name, arguments: args });
  const content = (result.content as Array<{ type: string; text?: string }> | undefined) ?? [];
  const text = content.find((item) => item.type === 'text')?.text ?? '';
  if (result.isError) {
    const structured = result.structuredContent as Record<string, unknown> | undefined;
    const error = (structured?.error as Record<string, unknown> | undefined) ?? {};
    const nextTools = error.next_tools as string[] | undefined;
    throw new Error(
      `${String(error.message ?? text ?? 'Nilyo tool failed')}${nextTools ? ` (next: ${nextTools.join(', ')})` : ''}`
    );
  }
  if (result.structuredContent !== undefined && result.structuredContent !== null) {
    return result.structuredContent as Record<string, unknown>;
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { text };
  }
}
