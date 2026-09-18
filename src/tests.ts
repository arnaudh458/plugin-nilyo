import type { IAgentRuntime, TestSuite } from '@elizaos/core';

/**
 * E2E suite run by `elizaos test e2e` inside a real runtime with the plugin loaded. Kept to
 * deterministic wiring checks (registration, config gating) rather than real model completions,
 * since e2e runs are not guaranteed to have an LLM provider key configured.
 */
export const NilyoPluginTestSuite: TestSuite = {
  name: 'plugin_nilyo_test_suite',
  tests: [
    {
      name: 'nilyo_actions_are_registered',
      fn: async (runtime: IAgentRuntime) => {
        const expected = [
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
        ];
        const registered = new Set((runtime.actions ?? []).map((a) => a.name));
        for (const name of expected) {
          if (!registered.has(name)) {
            throw new Error(`Expected action ${name} to be registered in the runtime`);
          }
        }
      },
    },
    {
      name: 'nilyo_connected_accounts_provider_is_registered',
      fn: async (runtime: IAgentRuntime) => {
        const registered = (runtime.providers ?? []).some((p) => p.name === 'NILYO_CONNECTED_ACCOUNTS');
        if (!registered) {
          throw new Error('Expected NILYO_CONNECTED_ACCOUNTS provider to be registered in the runtime');
        }
      },
    },
    {
      name: 'nilyo_actions_are_gated_on_NILYO_API_TOKEN',
      fn: async (runtime: IAgentRuntime) => {
        const action = (runtime.actions ?? []).find((a) => a.name === 'NILYO_LIST_ACCOUNTS');
        if (!action) throw new Error('NILYO_LIST_ACCOUNTS action not found');
        const hasToken = Boolean(runtime.getSetting('NILYO_API_TOKEN'));
        // Without asserting a specific config here, just confirm validate() reflects the setting
        // rather than always returning true — a regression that would make the action selectable
        // with no way to actually call the Nilyo MCP.
        const valid = await action.validate(runtime, {} as any, undefined);
        if (valid !== hasToken) {
          throw new Error(
            `Expected NILYO_LIST_ACCOUNTS.validate() (${valid}) to match whether NILYO_API_TOKEN is set (${hasToken})`
          );
        }
      },
    },
  ],
};

export default NilyoPluginTestSuite;
