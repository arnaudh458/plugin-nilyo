import type { Action, ActionResult, HandlerCallback, IAgentRuntime, Memory, State } from '@elizaos/core';
import { logger } from '@elizaos/core';
import { compact, nilyoTool } from './nilyoClient';
import { extractParams } from './params';

const hasToken = async (runtime: IAgentRuntime): Promise<boolean> => Boolean(runtime.getSetting('NILYO_API_TOKEN'));

/** Wraps a Nilyo tool call: reports the structured `action` next-step (connect/reconnect/subscribe/…)
 * as a normal reply instead of an error, since it is guidance for the user, not a failure. */
async function respond(runtime: IAgentRuntime, message: Memory, actionName: string, callback: HandlerCallback | undefined, run: () => Promise<Record<string, unknown>>): Promise<ActionResult> {
  try {
    const result = await run();
    const nextAction = result.action as string | undefined;
    const text = nextAction ? `${String(result.title ?? 'Next step needed')}: ${String(result.message ?? '')}` : summarize(result);
    if (callback) {
      await callback({
        text,
        actions: [actionName],
        source: message.content.source,
      });
    }
    return { text, success: true, data: result };
  } catch (error) {
    logger.error({ error, actionName }, 'Nilyo action failed');
    const text = error instanceof Error ? error.message : String(error);
    if (callback) {
      await callback({
        text: `Nilyo: ${text}`,
        actions: [actionName],
        source: message.content.source,
      });
    }
    return {
      success: false,
      error: error instanceof Error ? error : new Error(text),
    };
  }
}

/** Short, model-friendly summary of a tool result so the reply stays conversational. */
function summarize(result: Record<string, unknown>): string {
  if (Array.isArray(result)) return JSON.stringify(result.slice(0, 20));
  return JSON.stringify(result);
}

export const listAccountsAction: Action = {
  name: 'NILYO_LIST_ACCOUNTS',
  similes: ['LIST_CONNECTED_ACCOUNTS', 'WHICH_ACCOUNTS'],
  description: 'List the LinkedIn, WhatsApp, Instagram, Telegram, Email and Calendar accounts connected to Nilyo, with their display name, provider and connection status.',
  validate: hasToken,
  handler: async (runtime, message, _state, _options, callback): Promise<ActionResult> => respond(runtime, message, 'NILYO_LIST_ACCOUNTS', callback, () => nilyoTool(runtime, 'list_connected_accounts', {})),
  examples: [
    [
      {
        name: '{{userName}}',
        content: { text: 'Which accounts are connected to Nilyo?' },
      },
      {
        name: '{{agentName}}',
        content: {
          text: 'You have LinkedIn and WhatsApp connected.',
          actions: ['NILYO_LIST_ACCOUNTS'],
        },
      },
    ],
  ],
};

interface LinkedInProfileParams extends Record<string, unknown> {
  accountId?: string;
  profileUrlOrId?: string;
}

export const linkedinGetProfileAction: Action = {
  name: 'NILYO_LINKEDIN_GET_PROFILE',
  similes: ['GET_LINKEDIN_PROFILE', 'LOOKUP_LINKEDIN'],
  description: 'Resolve a LinkedIn profile from a profile URL, public identifier or name mentioned in the conversation; returns the stable provider ID used by other LinkedIn actions.',
  validate: hasToken,
  handler: async (runtime, message, state, _options, callback): Promise<ActionResult> => {
    if (!state) return { success: false, error: new Error('State is required') };
    const params = await extractParams<LinkedInProfileParams>(
      runtime,
      state,
      `Extract the LinkedIn profile the user wants (a linkedin.com/in/... URL, or a public identifier).
<response>
  <accountId>exact Nilyo account ID from the connected-accounts context, empty if only one account matches</accountId>
  <profileUrlOrId>the URL or identifier, empty if not found</profileUrlOrId>
</response>`
    );
    if (!params?.profileUrlOrId) {
      const text = 'I need a LinkedIn profile URL or identifier to look someone up.';
      if (callback)
        await callback({
          text,
          actions: ['NILYO_LINKEDIN_GET_PROFILE'],
          source: message.content.source,
        });
      return { success: false, text };
    }
    return respond(runtime, message, 'NILYO_LINKEDIN_GET_PROFILE', callback, () =>
      nilyoTool(
        runtime,
        'linkedin_get_profile',
        compact({
          account_id: params.accountId,
          user_id_or_url: params.profileUrlOrId,
        })
      )
    );
  },
  examples: [
    [
      {
        name: '{{userName}}',
        content: {
          text: 'Look up https://www.linkedin.com/in/jane-doe/ on LinkedIn',
        },
      },
      {
        name: '{{agentName}}',
        content: {
          text: 'Jane Doe, VP Engineering at Acme.',
          actions: ['NILYO_LINKEDIN_GET_PROFILE'],
        },
      },
    ],
  ],
};

interface LinkedInSearchParams extends Record<string, unknown> {
  accountId?: string;
  keywords?: string;
}

export const linkedinSearchPeopleAction: Action = {
  name: 'NILYO_LINKEDIN_SEARCH_PEOPLE',
  similes: ['SEARCH_LINKEDIN', 'FIND_ON_LINKEDIN'],
  description: 'Search LinkedIn people by keywords (name, company, role) using the connected LinkedIn account.',
  validate: hasToken,
  handler: async (runtime, message, state, _options, callback): Promise<ActionResult> => {
    if (!state) return { success: false, error: new Error('State is required') };
    const params = await extractParams<LinkedInSearchParams>(
      runtime,
      state,
      `Extract the LinkedIn people-search keywords (name, company, role, etc).
<response>
  <accountId>exact Nilyo account ID from the connected-accounts context, empty if only one account matches</accountId>
  <keywords>the search keywords, empty if not found</keywords>
</response>`
    );
    if (!params?.keywords) {
      const text = 'Who or what should I search for on LinkedIn?';
      if (callback)
        await callback({
          text,
          actions: ['NILYO_LINKEDIN_SEARCH_PEOPLE'],
          source: message.content.source,
        });
      return { success: false, text };
    }
    return respond(runtime, message, 'NILYO_LINKEDIN_SEARCH_PEOPLE', callback, () => nilyoTool(runtime, 'linkedin_search_people', compact({ account_id: params.accountId, keywords: params.keywords })));
  },
  examples: [
    [
      {
        name: '{{userName}}',
        content: { text: 'Who do I know at Stripe on LinkedIn?' },
      },
      {
        name: '{{agentName}}',
        content: {
          text: 'Found 3 people at Stripe in your network.',
          actions: ['NILYO_LINKEDIN_SEARCH_PEOPLE'],
        },
      },
    ],
  ],
};

interface LinkedInInviteParams extends Record<string, unknown> {
  accountId?: string;
  userId?: string;
  message?: string;
}

export const linkedinSendInvitationAction: Action = {
  name: 'NILYO_LINKEDIN_SEND_INVITATION',
  similes: ['CONNECT_ON_LINKEDIN', 'SEND_LINKEDIN_INVITE'],
  description: 'Send a LinkedIn connection invitation to a stable provider user ID (resolve it first with NILYO_LINKEDIN_GET_PROFILE or NILYO_LINKEDIN_SEARCH_PEOPLE — never invent an ID).',
  validate: hasToken,
  handler: async (runtime, message, state, _options, callback): Promise<ActionResult> => {
    if (!state) return { success: false, error: new Error('State is required') };
    const params = await extractParams<LinkedInInviteParams>(
      runtime,
      state,
      `Extract the LinkedIn invitation details from the conversation. The user ID must be a stable
provider ID already resolved earlier in the conversation (from a profile lookup or search result),
never a URL, a name, or something invented.
<response>
  <accountId>exact Nilyo account ID from the connected-accounts context, empty if only one account matches</accountId>
  <userId>the resolved LinkedIn provider user ID, empty if not found</userId>
  <message>optional invitation note, empty if none</message>
</response>`
    );
    if (!params?.userId) {
      const text = 'I need a resolved LinkedIn provider ID (look the profile up first) before I can send an invitation.';
      if (callback)
        await callback({
          text,
          actions: ['NILYO_LINKEDIN_SEND_INVITATION'],
          source: message.content.source,
        });
      return { success: false, text };
    }
    return respond(runtime, message, 'NILYO_LINKEDIN_SEND_INVITATION', callback, () =>
      nilyoTool(
        runtime,
        'linkedin_send_invitation',
        compact({
          account_id: params.accountId,
          user_id: params.userId,
          message: params.message,
        })
      )
    );
  },
  examples: [
    [
      {
        name: '{{userName}}',
        content: {
          text: 'Send her a connection request saying it was great meeting at the conference',
        },
      },
      {
        name: '{{agentName}}',
        content: {
          text: 'Invitation sent.',
          actions: ['NILYO_LINKEDIN_SEND_INVITATION'],
        },
      },
    ],
  ],
};

interface LinkedInConversationParams extends Record<string, unknown> {
  accountId?: string;
  chatId?: string;
  text?: string;
}

export const linkedinListConversationsAction: Action = {
  name: 'NILYO_LINKEDIN_LIST_CONVERSATIONS',
  similes: ['LIST_LINKEDIN_MESSAGES', 'CHECK_LINKEDIN_INBOX'],
  description: 'List recent conversations from the connected LinkedIn account.',
  validate: hasToken,
  handler: async (runtime, message, state, _options, callback): Promise<ActionResult> => {
    const params = state
      ? await extractParams<LinkedInConversationParams>(
          runtime,
          state,
          `Extract the exact Nilyo LinkedIn account ID from the connected-accounts context when the user selected one.
<response>
  <accountId>exact account ID, empty if only one LinkedIn account matches</accountId>
</response>`
        )
      : null;
    return respond(runtime, message, 'NILYO_LINKEDIN_LIST_CONVERSATIONS', callback, () => nilyoTool(runtime, 'linkedin_list_conversations', compact({ account_id: params?.accountId, limit: 20 })));
  },
  examples: [
    [
      {
        name: '{{userName}}',
        content: { text: 'Show me my recent LinkedIn conversations' },
      },
      {
        name: '{{agentName}}',
        content: {
          text: 'Here are your recent LinkedIn conversations.',
          actions: ['NILYO_LINKEDIN_LIST_CONVERSATIONS'],
        },
      },
    ],
  ],
};

export const linkedinReadConversationAction: Action = {
  name: 'NILYO_LINKEDIN_READ_CONVERSATION',
  similes: ['READ_LINKEDIN_MESSAGES', 'OPEN_LINKEDIN_CONVERSATION'],
  description: 'Read a LinkedIn conversation by the exact chat ID returned by the conversation list.',
  validate: hasToken,
  handler: async (runtime, message, state, _options, callback): Promise<ActionResult> => {
    if (!state) return { success: false, error: new Error('State is required') };
    const params = await extractParams<LinkedInConversationParams>(
      runtime,
      state,
      `Extract the LinkedIn chat and account IDs from prior Nilyo results.
<response>
  <accountId>exact Nilyo account ID, empty if only one LinkedIn account matches</accountId>
  <chatId>exact LinkedIn chat ID, empty if not found</chatId>
</response>`
    );
    if (!params?.chatId) {
      const text = 'I need a LinkedIn chat ID from the conversation list.';
      if (callback)
        await callback({
          text,
          actions: ['NILYO_LINKEDIN_READ_CONVERSATION'],
          source: message.content.source,
        });
      return { success: false, text };
    }
    return respond(runtime, message, 'NILYO_LINKEDIN_READ_CONVERSATION', callback, () => nilyoTool(runtime, 'linkedin_read_conversation', compact({ account_id: params.accountId, chat_id: params.chatId })));
  },
  examples: [
    [
      {
        name: '{{userName}}',
        content: { text: 'Open the LinkedIn conversation with Jane' },
      },
      {
        name: '{{agentName}}',
        content: {
          text: 'Here are the messages with Jane.',
          actions: ['NILYO_LINKEDIN_READ_CONVERSATION'],
        },
      },
    ],
  ],
};

export const linkedinSendMessageAction: Action = {
  name: 'NILYO_LINKEDIN_SEND_MESSAGE',
  similes: ['REPLY_LINKEDIN_MESSAGE', 'SEND_LINKEDIN_MESSAGE'],
  description: 'Send a message in an existing LinkedIn conversation after its chat ID has been resolved.',
  validate: hasToken,
  handler: async (runtime, message, state, _options, callback): Promise<ActionResult> => {
    if (!state) return { success: false, error: new Error('State is required') };
    const params = await extractParams<LinkedInConversationParams>(
      runtime,
      state,
      `Extract the approved LinkedIn reply and exact IDs from the conversation.
<response>
  <accountId>exact Nilyo account ID, empty if only one LinkedIn account matches</accountId>
  <chatId>exact LinkedIn chat ID, empty if not found</chatId>
  <text>exact message text requested by the user, empty if not found</text>
</response>`
    );
    if (!params?.chatId || !params.text) {
      const text = 'I need the LinkedIn conversation and the message to send.';
      if (callback)
        await callback({
          text,
          actions: ['NILYO_LINKEDIN_SEND_MESSAGE'],
          source: message.content.source,
        });
      return { success: false, text };
    }
    return respond(runtime, message, 'NILYO_LINKEDIN_SEND_MESSAGE', callback, () =>
      nilyoTool(
        runtime,
        'linkedin_send_message',
        compact({
          account_id: params.accountId,
          chat_id: params.chatId,
          text: params.text,
        })
      )
    );
  },
  examples: [
    [
      {
        name: '{{userName}}',
        content: { text: 'Reply to Jane on LinkedIn: Thursday works for me' },
      },
      {
        name: '{{agentName}}',
        content: {
          text: 'Message sent to Jane.',
          actions: ['NILYO_LINKEDIN_SEND_MESSAGE'],
        },
      },
    ],
  ],
};

interface MessagingSendParams extends Record<string, unknown> {
  accountId?: string;
  provider?: string;
  name?: string;
  text?: string;
}

export const messagingSendToContactAction: Action = {
  name: 'NILYO_MESSAGING_SEND_TO_CONTACT',
  similes: ['SEND_WHATSAPP', 'SEND_INSTAGRAM_DM', 'SEND_TELEGRAM'],
  description: 'Send a WhatsApp, Instagram or Telegram message to a person by name or phone number. Sends only when exactly one person matches; otherwise returns candidates to disambiguate.',
  validate: hasToken,
  handler: async (runtime, message, state, _options, callback): Promise<ActionResult> => {
    if (!state) return { success: false, error: new Error('State is required') };
    const params = await extractParams<MessagingSendParams>(
      runtime,
      state,
      `Extract the details to send a WhatsApp/Instagram/Telegram message.
<response>
  <accountId>exact Nilyo account ID from the connected-accounts context, empty if only one account matches</accountId>
  <provider>whatsapp, instagram or telegram — empty if not stated (defaults to whatsapp)</provider>
  <name>recipient name or phone number, empty if not found</name>
  <text>the message text to send, empty if not found</text>
</response>`
    );
    if (!params?.name || !params?.text) {
      const text = 'Who should I message, and what should I say?';
      if (callback)
        await callback({
          text,
          actions: ['NILYO_MESSAGING_SEND_TO_CONTACT'],
          source: message.content.source,
        });
      return { success: false, text };
    }
    return respond(runtime, message, 'NILYO_MESSAGING_SEND_TO_CONTACT', callback, () =>
      nilyoTool(
        runtime,
        'messaging_send_to_contact',
        compact({
          account_id: params.accountId,
          provider: params.provider || 'whatsapp',
          name: params.name,
          text: params.text,
        })
      )
    );
  },
  examples: [
    [
      {
        name: '{{userName}}',
        content: {
          text: 'Send Julien a WhatsApp saying the meeting moved to 3pm',
        },
      },
      {
        name: '{{agentName}}',
        content: {
          text: 'Sent to Julien on WhatsApp.',
          actions: ['NILYO_MESSAGING_SEND_TO_CONTACT'],
        },
      },
    ],
  ],
};

interface MessagingListParams extends Record<string, unknown> {
  accountId?: string;
  provider?: string;
  isUnread?: string;
}

export const messagingListChatsAction: Action = {
  name: 'NILYO_MESSAGING_LIST_CHATS',
  similes: ['LIST_WHATSAPP_CHATS', 'LIST_CONVERSATIONS'],
  description: 'List recent WhatsApp, Instagram or Telegram chats, optionally filtered to unread only.',
  validate: hasToken,
  handler: async (runtime, message, state, _options, callback): Promise<ActionResult> => {
    if (!state) return { success: false, error: new Error('State is required') };
    const params = await extractParams<MessagingListParams>(
      runtime,
      state,
      `Extract chat-list filters.
<response>
  <accountId>exact Nilyo account ID from the connected-accounts context, empty if only one account matches</accountId>
  <provider>whatsapp, instagram or telegram — empty if not stated (defaults to whatsapp)</provider>
  <isUnread>true if the user only wants unread chats, otherwise empty</isUnread>
</response>`
    );
    return respond(runtime, message, 'NILYO_MESSAGING_LIST_CHATS', callback, () =>
      nilyoTool(
        runtime,
        'messaging_list_chats',
        compact({
          account_id: params?.accountId,
          provider: params?.provider || 'whatsapp',
          is_unread: params?.isUnread === 'true' ? true : undefined,
          limit: 50,
        })
      )
    );
  },
  examples: [
    [
      {
        name: '{{userName}}',
        content: { text: 'Show me my unread WhatsApp chats' },
      },
      {
        name: '{{agentName}}',
        content: {
          text: 'You have 4 unread WhatsApp chats.',
          actions: ['NILYO_MESSAGING_LIST_CHATS'],
        },
      },
    ],
  ],
};

interface MessagingReadParams extends Record<string, unknown> {
  accountId?: string;
  chatId?: string;
}

export const messagingReadChatAction: Action = {
  name: 'NILYO_MESSAGING_READ_CHAT',
  similes: ['READ_WHATSAPP_CHAT', 'LIST_WHATSAPP_MESSAGES'],
  description: 'Read messages from a WhatsApp, Instagram or Telegram chat using its exact chat ID.',
  validate: hasToken,
  handler: async (runtime, message, state, _options, callback): Promise<ActionResult> => {
    if (!state) return { success: false, error: new Error('State is required') };
    const params = await extractParams<MessagingReadParams>(
      runtime,
      state,
      `Extract the chat and account IDs from prior Nilyo results.
<response>
  <accountId>exact Nilyo account ID, empty if only one messaging account matches</accountId>
  <chatId>exact chat ID, empty if not found</chatId>
</response>`
    );
    if (!params?.chatId) {
      const text = 'I need a chat ID from the conversation list.';
      if (callback)
        await callback({
          text,
          actions: ['NILYO_MESSAGING_READ_CHAT'],
          source: message.content.source,
        });
      return { success: false, text };
    }
    return respond(runtime, message, 'NILYO_MESSAGING_READ_CHAT', callback, () =>
      nilyoTool(
        runtime,
        'messaging_list_messages',
        compact({
          account_id: params.accountId,
          chat_id: params.chatId,
          limit: 50,
        })
      )
    );
  },
  examples: [
    [
      {
        name: '{{userName}}',
        content: { text: 'Read my WhatsApp chat with Julien' },
      },
      {
        name: '{{agentName}}',
        content: {
          text: 'Here are the recent messages with Julien.',
          actions: ['NILYO_MESSAGING_READ_CHAT'],
        },
      },
    ],
  ],
};

interface EmailListParams extends Record<string, unknown> {
  accountId?: string;
  folderId?: string;
}

export const emailListAction: Action = {
  name: 'NILYO_EMAIL_LIST',
  similes: ['LIST_EMAILS', 'CHECK_INBOX'],
  description: 'List recent emails from the connected Gmail, Outlook or IMAP mailbox.',
  validate: hasToken,
  handler: async (runtime, message, state, _options, callback): Promise<ActionResult> => {
    const params = state
      ? await extractParams<EmailListParams>(
          runtime,
          state,
          `Extract an optional exact folder ID if the user named one (from a prior email_list_folders result).
<response>
  <accountId>exact Nilyo account ID from the connected-accounts context, empty if only one mailbox matches</accountId>
  <folderId>the exact folder ID, empty if not stated (defaults to the inbox)</folderId>
</response>`
        )
      : null;
    return respond(runtime, message, 'NILYO_EMAIL_LIST', callback, () =>
      nilyoTool(
        runtime,
        'email_list_messages',
        compact({
          account_id: params?.accountId,
          folder_id: params?.folderId,
          limit: 20,
        })
      )
    );
  },
  examples: [
    [
      { name: '{{userName}}', content: { text: "What's in my inbox?" } },
      {
        name: '{{agentName}}',
        content: {
          text: 'You have 5 new emails, the latest from Acme Billing.',
          actions: ['NILYO_EMAIL_LIST'],
        },
      },
    ],
  ],
};

interface EmailReadParams extends Record<string, unknown> {
  accountId?: string;
  emailId?: string;
}

export const emailReadAction: Action = {
  name: 'NILYO_EMAIL_READ',
  similes: ['READ_EMAIL', 'OPEN_EMAIL'],
  description: 'Read an email by the exact message ID returned by the email list.',
  validate: hasToken,
  handler: async (runtime, message, state, _options, callback): Promise<ActionResult> => {
    if (!state) return { success: false, error: new Error('State is required') };
    const params = await extractParams<EmailReadParams>(
      runtime,
      state,
      `Extract the email and account IDs from prior Nilyo results.
<response>
  <accountId>exact Nilyo account ID, empty if only one mailbox matches</accountId>
  <emailId>exact email message ID, empty if not found</emailId>
</response>`
    );
    if (!params?.emailId) {
      const text = 'I need an email ID from the message list.';
      if (callback)
        await callback({
          text,
          actions: ['NILYO_EMAIL_READ'],
          source: message.content.source,
        });
      return { success: false, text };
    }
    return respond(runtime, message, 'NILYO_EMAIL_READ', callback, () => nilyoTool(runtime, 'email_read_message', compact({ account_id: params.accountId, email_id: params.emailId })));
  },
  examples: [
    [
      {
        name: '{{userName}}',
        content: { text: 'Open the latest email from Acme' },
      },
      {
        name: '{{agentName}}',
        content: {
          text: 'Here is the email from Acme.',
          actions: ['NILYO_EMAIL_READ'],
        },
      },
    ],
  ],
};

interface EmailSendParams extends Record<string, unknown> {
  accountId?: string;
  to?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  body?: string;
  replyToMessageId?: string;
}

export const emailSendAction: Action = {
  name: 'NILYO_EMAIL_SEND',
  similes: ['SEND_EMAIL', 'REPLY_TO_EMAIL'],
  description: 'Send an email from the connected Gmail, Outlook or IMAP mailbox.',
  validate: hasToken,
  handler: async (runtime, message, state, _options, callback): Promise<ActionResult> => {
    if (!state) return { success: false, error: new Error('State is required') };
    const params = await extractParams<EmailSendParams>(
      runtime,
      state,
      `Extract the email to send.
<response>
  <accountId>exact Nilyo account ID from the connected-accounts context, empty if only one mailbox matches</accountId>
  <to>comma-separated recipient addresses, empty if not found</to>
  <cc>comma-separated CC addresses, empty if none</cc>
  <bcc>comma-separated BCC addresses, empty if none</bcc>
  <subject>the subject line, empty if not found</subject>
  <body>the plain-text body, empty if not found</body>
  <replyToMessageId>exact email ID when replying to a listed message, empty for a new email</replyToMessageId>
</response>`
    );
    if (!params?.to || !params?.body) {
      const text = 'Who should I email, and what should it say?';
      if (callback)
        await callback({
          text,
          actions: ['NILYO_EMAIL_SEND'],
          source: message.content.source,
        });
      return { success: false, text };
    }
    const addresses = (value: string) =>
      value
        .split(',')
        .map((email) => email.trim())
        .filter(Boolean)
        .map((email) => ({ email }));
    return respond(runtime, message, 'NILYO_EMAIL_SEND', callback, () =>
      nilyoTool(
        runtime,
        'email_send',
        compact({
          account_id: params.accountId,
          to: addresses(params.to as string),
          cc: params.cc ? addresses(params.cc as string) : undefined,
          bcc: params.bcc ? addresses(params.bcc as string) : undefined,
          subject: params.subject,
          plain_text: params.body,
          reply_to_message_id: params.replyToMessageId,
        })
      )
    );
  },
  examples: [
    [
      {
        name: '{{userName}}',
        content: {
          text: 'Email jane@acme.com subject Follow-up saying thanks for the call today',
        },
      },
      {
        name: '{{agentName}}',
        content: {
          text: 'Email sent to jane@acme.com.',
          actions: ['NILYO_EMAIL_SEND'],
        },
      },
    ],
  ],
};

export const calendarListCalendarsAction: Action = {
  name: 'NILYO_CALENDAR_LIST_CALENDARS',
  similes: ['LIST_CALENDARS'],
  description: 'List the calendars available on the connected calendar account.',
  validate: hasToken,
  handler: async (runtime, message, _state, _options, callback): Promise<ActionResult> => respond(runtime, message, 'NILYO_CALENDAR_LIST_CALENDARS', callback, () => nilyoTool(runtime, 'calendar_list_calendars', {})),
  examples: [
    [
      {
        name: '{{userName}}',
        content: { text: 'What calendars do I have connected?' },
      },
      {
        name: '{{agentName}}',
        content: {
          text: 'You have "Work" and "Personal" calendars connected.',
          actions: ['NILYO_CALENDAR_LIST_CALENDARS'],
        },
      },
    ],
  ],
};

interface CallToolParams extends Record<string, unknown> {
  toolName?: string;
  argumentsJson?: string;
}

export const callToolAction: Action = {
  name: 'NILYO_CALL_TOOL',
  similes: ['NILYO_TOOL', 'CALL_NILYO_TOOL'],
  description: 'Call any Nilyo MCP tool by exact name for requests the other Nilyo actions do not cover (invitations list, post comments/reactions, IMAP folders, webhook destinations, billing, etc). Use exact provider IDs already resolved in the conversation; never invent one.',
  validate: hasToken,
  handler: async (runtime, message, state, _options, callback): Promise<ActionResult> => {
    if (!state) return { success: false, error: new Error('State is required') };
    const params = await extractParams<CallToolParams>(
      runtime,
      state,
      `Extract the exact Nilyo MCP tool name to call and its JSON arguments object.
<response>
  <toolName>exact tool name, e.g. linkedin_list_invitations, empty if unclear</toolName>
  <argumentsJson>a JSON object of arguments, {} if none</argumentsJson>
</response>`
    );
    if (!params?.toolName) {
      const text = 'Which Nilyo tool should I call?';
      if (callback)
        await callback({
          text,
          actions: ['NILYO_CALL_TOOL'],
          source: message.content.source,
        });
      return { success: false, text };
    }
    let args: Record<string, unknown> = {};
    try {
      args = params.argumentsJson ? (JSON.parse(params.argumentsJson) as Record<string, unknown>) : {};
    } catch {
      const text = `Could not parse the arguments for ${params.toolName} as JSON.`;
      if (callback)
        await callback({
          text,
          actions: ['NILYO_CALL_TOOL'],
          source: message.content.source,
        });
      return { success: false, text };
    }
    return respond(runtime, message, 'NILYO_CALL_TOOL', callback, () => nilyoTool(runtime, params.toolName as string, args));
  },
  examples: [
    [
      {
        name: '{{userName}}',
        content: { text: 'List my pending LinkedIn invitations' },
      },
      {
        name: '{{agentName}}',
        content: {
          text: 'You have 2 pending invitations.',
          actions: ['NILYO_CALL_TOOL'],
        },
      },
    ],
  ],
};

export const nilyoActions: Action[] = [
  listAccountsAction,
  linkedinGetProfileAction,
  linkedinSearchPeopleAction,
  linkedinSendInvitationAction,
  linkedinListConversationsAction,
  linkedinReadConversationAction,
  linkedinSendMessageAction,
  messagingSendToContactAction,
  messagingListChatsAction,
  messagingReadChatAction,
  emailListAction,
  emailReadAction,
  emailSendAction,
  calendarListCalendarsAction,
  callToolAction,
];
