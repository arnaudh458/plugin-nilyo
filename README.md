# plugin-nilyo

Give an ElizaOS agent send/reply/invite access — plus account and billing management — on the user's own LinkedIn, WhatsApp, Instagram, Telegram, Email and Calendar accounts through [Nilyo](https://nilyo.com) — a remote MCP that bridges those accounts through [Unipile](https://www.unipile.com)'s connection layer. The agent never receives provider credentials; it calls structured Nilyo tools and gets back structured results. The personal token configured below grants that full capability set, so treat it like a credential, not a read-only key.

## Prerequisites

1. Create a personal Nilyo token from https://nilyo.com/account -> **Agent access**.
2. Connect the LinkedIn/WhatsApp/Instagram/Telegram/Email/Calendar accounts you want the agent to use, from the same Nilyo account.

## Install

```bash
elizaos plugins add plugin-nilyo
```

Or add it to your character/agent config directly:

```json
{
  "plugins": ["plugin-nilyo"],
  "settings": {
    "secrets": {
      "NILYO_API_TOKEN": "your Nilyo personal token"
    }
  }
}
```

| Variable          | Required | Description                                                                 |
| ----------------- | -------- | ----------------------------------------------------------------------------- |
| `NILYO_API_TOKEN`  | Yes      | Personal token from https://nilyo.com/account -> Agent access.               |
| `NILYO_BASE_URL`   | No       | Defaults to `https://nilyo.com`. Only change for a Nilyo staging environment. |

Every action `validate()`s against `NILYO_API_TOKEN` being set, so the agent simply won't offer Nilyo actions until it is configured.

## Actions

| Action                          | What it does                                                                                     |
| -------------------------------- | -------------------------------------------------------------------------------------------------- |
| `NILYO_LIST_ACCOUNTS`            | Lists connected accounts (provider, display name, status).                                        |
| `NILYO_LINKEDIN_GET_PROFILE`     | Resolves a LinkedIn profile from a URL/identifier to the stable provider ID other actions need.    |
| `NILYO_LINKEDIN_SEARCH_PEOPLE`   | Searches LinkedIn people by keywords.                                                              |
| `NILYO_LINKEDIN_SEND_INVITATION` | Sends a LinkedIn connection invitation to an already-resolved provider ID.                         |
| `NILYO_MESSAGING_SEND_TO_CONTACT`| Sends a WhatsApp/Instagram/Telegram message to a person by name or phone number.                   |
| `NILYO_MESSAGING_LIST_CHATS`     | Lists recent chats, optionally filtered to unread.                                                 |
| `NILYO_EMAIL_LIST`               | Lists recent emails from the connected Gmail/Outlook/IMAP mailbox.                                 |
| `NILYO_EMAIL_SEND`               | Sends an email.                                                                                    |
| `NILYO_CALENDAR_LIST_CALENDARS`  | Lists the connected calendars.                                                                     |
| `NILYO_CALL_TOOL`                | Escape hatch: calls any Nilyo MCP tool by exact name for everything the actions above don't cover (invitations list, post comments/reactions, IMAP folders, webhook destinations, billing, etc). |

A `NILYO_CONNECTED_ACCOUNTS` provider also injects the connected accounts into context, so the agent knows what's available without an explicit action call, and can disambiguate when more than one account of the same provider is connected.

## Example prompts

- "Which accounts are connected to Nilyo?"
- "Who do I know at Stripe on LinkedIn?"
- "Send Julien a WhatsApp saying the meeting moved to 3pm."
- "What's in my inbox?"
- "List my pending LinkedIn invitations." (via `NILYO_CALL_TOOL` -> `linkedin_list_invitations`)

## Notes for chaining

Structured next-step results from Nilyo (`connect_account`, `reconnect_account`, `subscribe`, …) are surfaced as a normal reply rather than an error — they are guidance for the user, not a failure. Never invent a LinkedIn/provider ID: resolve one first with `NILYO_LINKEDIN_GET_PROFILE` or `NILYO_LINKEDIN_SEARCH_PEOPLE` (or the matching tool via `NILYO_CALL_TOOL`) before using it in a write action.

## Development

```bash
bun install
bun run build
bun test        # component tests (mocked runtime)
elizaos test e2e # e2e tests (real runtime)
elizaos dev      # hot-reload against a local agent
```

## Links

- Nilyo: https://nilyo.com
- Agent setup guide: https://nilyo.com/setup-for-agents
- Source: https://github.com/arnaudh458/plugin-nilyo
