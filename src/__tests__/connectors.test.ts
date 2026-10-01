import { beforeAll, describe, expect, it, mock } from 'bun:test';
import type { IAgentRuntime } from '@elizaos/core';
import { nilyoPlugin } from '../index';
import { createMockRuntime, createTestMemory, createTestState, setupLoggerSpies } from './test-utils';

interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

beforeAll(() => {
  setupLoggerSpies();
});

function runtimeWithExtractions(extractions: string[]): IAgentRuntime {
  const responses = [...extractions];
  return createMockRuntime({
    useModel: mock(async () => responses.shift() ?? '<response></response>') as any,
  });
}

async function runAction(name: string, runtime: IAgentRuntime) {
  const action = nilyoPlugin.actions?.find((candidate) => candidate.name === name);
  expect(action).toBeDefined();
  return action!.handler(runtime, createTestMemory(), createTestState(), {}, undefined);
}

async function withMockNilyo(run: (calls: ToolCall[]) => Promise<void>) {
  const originalFetch = globalThis.fetch;
  const calls: ToolCall[] = [];
  globalThis.fetch = (async (_input, init) => {
    const request = JSON.parse(String(init?.body)) as { params: ToolCall };
    calls.push(request.params);
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: { structuredContent: { tool: request.params.name, ok: true } },
      }),
      { status: 200 }
    );
  }) as typeof fetch;

  try {
    await run(calls);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

describe('Nilyo channel integrations', () => {
  it('lists, reads and replies to email through the selected mailbox', async () => {
    const runtime = runtimeWithExtractions([
      '<response><accountId>mail-1</accountId><folderId>inbox</folderId></response>',
      '<response><accountId>mail-1</accountId><emailId>email-42</emailId></response>',
      '<response><accountId>mail-1</accountId><to>jane@example.com</to><cc></cc><bcc></bcc><subject>Re: Hello</subject><body>Thanks Jane</body><replyToMessageId>email-42</replyToMessageId></response>',
    ]);

    await withMockNilyo(async (calls) => {
      expect((await runAction('NILYO_EMAIL_LIST', runtime)).success).toBe(true);
      expect((await runAction('NILYO_EMAIL_READ', runtime)).success).toBe(true);
      expect((await runAction('NILYO_EMAIL_SEND', runtime)).success).toBe(true);

      expect(calls).toEqual([
        {
          name: 'email_list_messages',
          arguments: { account_id: 'mail-1', folder_id: 'inbox', limit: 20 },
        },
        {
          name: 'email_read_message',
          arguments: { account_id: 'mail-1', email_id: 'email-42' },
        },
        {
          name: 'email_send',
          arguments: {
            account_id: 'mail-1',
            to: [{ email: 'jane@example.com' }],
            subject: 'Re: Hello',
            plain_text: 'Thanks Jane',
            reply_to_message_id: 'email-42',
          },
        },
      ]);
    });
  });

  it('lists, reads and sends WhatsApp messages through the selected account', async () => {
    const runtime = runtimeWithExtractions([
      '<response><accountId>wa-1</accountId><provider>whatsapp</provider><isUnread>true</isUnread></response>',
      '<response><accountId>wa-1</accountId><chatId>chat-7</chatId></response>',
      '<response><accountId>wa-1</accountId><provider>whatsapp</provider><name>Julien</name><text>See you at 3pm</text></response>',
    ]);

    await withMockNilyo(async (calls) => {
      expect((await runAction('NILYO_MESSAGING_LIST_CHATS', runtime)).success).toBe(true);
      expect((await runAction('NILYO_MESSAGING_READ_CHAT', runtime)).success).toBe(true);
      expect((await runAction('NILYO_MESSAGING_SEND_TO_CONTACT', runtime)).success).toBe(true);

      expect(calls).toEqual([
        {
          name: 'messaging_list_chats',
          arguments: {
            account_id: 'wa-1',
            provider: 'whatsapp',
            is_unread: true,
            limit: 50,
          },
        },
        {
          name: 'messaging_list_messages',
          arguments: { account_id: 'wa-1', chat_id: 'chat-7', limit: 50 },
        },
        {
          name: 'messaging_send_to_contact',
          arguments: {
            account_id: 'wa-1',
            provider: 'whatsapp',
            name: 'Julien',
            text: 'See you at 3pm',
          },
        },
      ]);
    });
  });

  it('resolves a profile then lists, reads and replies to LinkedIn conversations', async () => {
    const runtime = runtimeWithExtractions([
      '<response><accountId>li-1</accountId><profileUrlOrId>https://www.linkedin.com/in/jane-doe/</profileUrlOrId></response>',
      '<response><accountId>li-1</accountId></response>',
      '<response><accountId>li-1</accountId><chatId>chat-9</chatId></response>',
      '<response><accountId>li-1</accountId><chatId>chat-9</chatId><text>Thursday works for me</text></response>',
    ]);

    await withMockNilyo(async (calls) => {
      expect((await runAction('NILYO_LINKEDIN_GET_PROFILE', runtime)).success).toBe(true);
      expect((await runAction('NILYO_LINKEDIN_LIST_CONVERSATIONS', runtime)).success).toBe(true);
      expect((await runAction('NILYO_LINKEDIN_READ_CONVERSATION', runtime)).success).toBe(true);
      expect((await runAction('NILYO_LINKEDIN_SEND_MESSAGE', runtime)).success).toBe(true);

      expect(calls).toEqual([
        {
          name: 'linkedin_get_profile',
          arguments: {
            account_id: 'li-1',
            user_id_or_url: 'https://www.linkedin.com/in/jane-doe/',
          },
        },
        {
          name: 'linkedin_list_conversations',
          arguments: { account_id: 'li-1', limit: 20 },
        },
        {
          name: 'linkedin_read_conversation',
          arguments: { account_id: 'li-1', chat_id: 'chat-9' },
        },
        {
          name: 'linkedin_send_message',
          arguments: {
            account_id: 'li-1',
            chat_id: 'chat-9',
            text: 'Thursday works for me',
          },
        },
      ]);
    });
  });
});
