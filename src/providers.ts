import {createOpenRouter} from "@openrouter/ai-sdk-provider";
import type {LanguageModel} from "ai";
import * as dotenv from "dotenv";

// Load environment variables so the provider can read OPENROUTER_API_KEY
dotenv.config();

/**
 * Shared OpenRouter provider instance.
 *
 * The API key is read from the OPENROUTER_API_KEY environment variable
 * (see .env / .env.example). OpenRouter exposes hundreds of models from many
 * vendors behind a single, OpenAI-compatible endpoint, which lets the forum mix
 * models from different providers (OpenAI, Anthropic, Google, etc.) freely.
 */
export const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  appName: "agent-forum",
});

/**
 * Selects an OpenRouter chat model by its slug, e.g. "openai/gpt-4o-mini"
 * or "anthropic/claude-3.5-sonnet". Returns a model ready to pass to an Agent.
 */
export function orModel(modelId: string): LanguageModel {
  return openrouter.chat(modelId);
}
