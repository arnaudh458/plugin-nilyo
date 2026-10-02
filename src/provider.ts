import type {
  IAgentRuntime,
  Memory,
  Provider,
  ProviderResult,
  State,
} from "@elizaos/core";
import { logger } from "@elizaos/core";
import { nilyoTool } from "./nilyoClient";

/**
 * Surfaces the user's connected Nilyo accounts so the agent never has to guess between two accounts
 * of the same provider: it can see display names/providers up front and pass an exact `account_id`
 * through NILYO_CALL_TOOL when more than one match exists, instead of asking or picking arbitrarily.
 */
export const connectedAccountsProvider: Provider = {
  name: "NILYO_CONNECTED_ACCOUNTS",
  description:
    "The LinkedIn, WhatsApp, Instagram, Telegram, Email and Calendar accounts connected to Nilyo",
  dynamic: true,

  get: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state: State | undefined,
  ): Promise<ProviderResult> => {
    if (!runtime.getSetting("NILYO_API_TOKEN")) {
      return { text: "", values: {}, data: {} };
    }
    try {
      const result = await nilyoTool(runtime, "list_connected_accounts", {});
      const accounts = (
        Array.isArray(result) ? result : ((result.accounts as unknown[]) ?? [])
      ) as Array<Record<string, unknown>>;
      if (accounts.length === 0) {
        return {
          text: "No Nilyo accounts are connected yet.",
          values: {
            nilyoAccounts: [],
            nilyoAccountsContext: "No Nilyo accounts are connected.",
          },
          data: { accounts },
        };
      }
      const lines = accounts.map((account) => {
        const id = account.account_id ?? account.unipile_account_id;
        const label =
          account.name ??
          account.display_name ??
          account.identifier ??
          id ??
          "?";
        return `- ${String(account.provider ?? "?")}: ${String(label)}${id ? ` (account_id: ${String(id)})` : ""}`;
      });
      const context = lines.join("\n");
      return {
        text: `Connected Nilyo accounts:\n${context}`,
        values: { nilyoAccounts: accounts, nilyoAccountsContext: context },
        data: { accounts },
      };
    } catch (error) {
      logger.warn({ error }, "NILYO_CONNECTED_ACCOUNTS provider failed");
      return { text: "", values: {}, data: {} };
    }
  },
};
