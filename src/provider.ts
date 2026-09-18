import type { IAgentRuntime, Memory, Provider, ProviderResult, State } from '@elizaos/core';
import { logger } from '@elizaos/core';
import { nilyoTool } from './nilyoClient';

/**
 * Surfaces the user's connected Nilyo accounts so the agent never has to guess between two accounts
 * of the same provider: it can see display names/providers up front and pass an exact `account_id`
 * through NILYO_CALL_TOOL when more than one match exists, instead of asking or picking arbitrarily.
 */
export const connectedAccountsProvider: Provider = {
  name: 'NILYO_CONNECTED_ACCOUNTS',
  description: 'The LinkedIn, WhatsApp, Instagram, Telegram, Email and Calendar accounts connected to Nilyo',
  dynamic: true,

  get: async (runtime: IAgentRuntime, _message: Memory, _state: State | undefined): Promise<ProviderResult> => {
    if (!runtime.getSetting('NILYO_API_TOKEN')) {
      return { text: '', values: {}, data: {} };
    }
    try {
      const result = await nilyoTool(runtime, 'list_connected_accounts', {});
      const accounts = (Array.isArray(result) ? result : (result.accounts as unknown[]) ?? []) as Array<
        Record<string, unknown>
      >;
      if (accounts.length === 0) {
        return { text: 'No Nilyo accounts are connected yet.', values: { nilyoAccounts: [] }, data: { accounts } };
      }
      const lines = accounts.map(
        (a) => `- ${String(a.provider ?? '?')}: ${String(a.name ?? a.display_name ?? a.unipile_account_id ?? '?')}`
      );
      return {
        text: `Connected Nilyo accounts:\n${lines.join('\n')}`,
        values: { nilyoAccounts: accounts },
        data: { accounts },
      };
    } catch (error) {
      logger.warn({ error }, 'NILYO_CONNECTED_ACCOUNTS provider failed');
      return { text: '', values: {}, data: {} };
    }
  },
};
