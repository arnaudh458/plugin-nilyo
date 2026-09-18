import {
  composePromptFromState,
  ModelType,
  parseKeyValueXml,
  type IAgentRuntime,
  type State,
} from '@elizaos/core';

/**
 * Extracts structured parameters from the conversation with a small text model, following the same
 * `{{recentMessages}}` + XML-response pattern used by `@elizaos/plugin-bootstrap`'s own actions
 * (e.g. `SEND_MESSAGE`'s target extraction). Returns `null` when the model output does not parse.
 */
export async function extractParams<T extends Record<string, unknown>>(
  runtime: IAgentRuntime,
  state: State,
  instructions: string
): Promise<T | null> {
  const template = `# Task: Extract parameters for a Nilyo agent action

# Recent Messages:
{{recentMessages}}

# Instructions:
${instructions}

Do NOT include any thinking, reasoning, or <think> sections in your response. Go directly to the XML
response format without any preamble or explanation. Leave a field empty (\`<field></field>\`) rather
than guessing when the conversation does not say.`;

  const prompt = composePromptFromState({ state, template });
  const raw = await runtime.useModel(ModelType.TEXT_SMALL, { prompt, stopSequences: [] });
  return parseKeyValueXml<T>(raw);
}
