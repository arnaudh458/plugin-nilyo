import type { Plugin } from '@elizaos/core';
import { logger } from '@elizaos/core';
import { z } from 'zod';
import { nilyoActions } from './actions';
import { connectedAccountsProvider } from './provider';
import { NilyoPluginTestSuite } from './tests';

const configSchema = z.object({
  NILYO_API_TOKEN: z
    .string()
    .min(1, 'NILYO_API_TOKEN is required')
    .optional()
    .transform((val) => {
      if (!val) {
        logger.warn(
          'NILYO_API_TOKEN is not set — create a personal token from https://nilyo.com/account -> Agent access to enable Nilyo actions.'
        );
      }
      return val;
    }),
  NILYO_BASE_URL: z.string().url().optional(),
});

export const nilyoPlugin: Plugin = {
  name: 'plugin-nilyo',
  description:
    "Give the agent access to the user's own LinkedIn, WhatsApp, Instagram, Telegram, Email and Calendar accounts through Nilyo.",
  config: {
    NILYO_API_TOKEN: process.env.NILYO_API_TOKEN,
    NILYO_BASE_URL: process.env.NILYO_BASE_URL,
  },
  async init(config: Record<string, string>) {
    logger.debug('Nilyo plugin initialized');
    try {
      const validatedConfig = await configSchema.parseAsync(config);
      for (const [key, value] of Object.entries(validatedConfig)) {
        if (value) process.env[key] = value;
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.issues?.map((e) => e.message)?.join(', ') || 'Unknown validation error';
        throw new Error(`Invalid Nilyo plugin configuration: ${errorMessages}`);
      }
      throw new Error(`Invalid Nilyo plugin configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
  actions: nilyoActions,
  providers: [connectedAccountsProvider],
  tests: [NilyoPluginTestSuite],
};

export default nilyoPlugin;
