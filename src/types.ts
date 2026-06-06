import type {LanguageModel} from "ai";

// Re-export interfaces and default implementations for external use
export type {LLMService, LLMGenerationResult} from "./llm-service";
export {DefaultLLMService} from "./llm-service";
export type {
  ConversationStrategy,
  ConversationContext,
} from "./strategies/conversation-strategy";
export {TwoAgentPingPongStrategy} from "./strategies/conversation-strategy";

export interface ForumConfig {
  threadName: string;
  rounds: number;
  agents: [Agent, Agent];
  summarizer?: Summarizer;
  initialPrompt?: string;
  outputDir?: string;
  maxTokens?: number;
}

/**
 * Internal config type where all optional fields have been resolved to non-undefined values
 */
export interface InternalForumConfig extends ForumConfig {
  initialPrompt: string;
  outputDir: string;
  maxTokens: number;
}

export interface Agent {
  agentId: string;
  model: LanguageModel;
  personality: string;
}

export interface Summarizer {
  agentId: string;
  model: LanguageModel;
  personality: (state: ConversationState) => string;
}

export interface Message {
  role: string;
  content: string;
  timestamp: string;
  round: number;
  tokens: number;
}

export interface ConversationState {
  messages: Message[];
  totalTokens: number;
  completed: boolean;
  stoppedReason?: "max_rounds" | "max_tokens" | "fatal_error";
}

/**
 * Type definition for the async forum runner method
 */
export type ForumRunner = () => Promise<ConversationState>;
