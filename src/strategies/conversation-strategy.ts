import {Message, Agent} from "../types";
import {MessageBuilder} from "../message-builder";

/**
 * API message format
 */
interface ApiMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Context provided to strategy for decision making
 */
export interface ConversationContext {
  round: number;
  maxRounds: number;
  messages: Message[];
  agents: [Agent, Agent];
  initialPrompt: string;
}

/**
 * Interface for conversation flow strategies
 */
export interface ConversationStrategy {
  /**
   * Determines which agent should speak next
   * Returns agent index (0 or 1) or null if conversation should end
   */
  getNextAgent(context: ConversationContext): number | null;

  /**
   * Builds conversation history from the specified agent's perspective
   */
  buildConversationHistory(
    messages: Message[],
    agentId: string,
    initialPrompt: string
  ): ApiMessage[];

  /**
   * Determines if the conversation should continue
   */
  shouldContinue(context: ConversationContext): boolean;
}

/**
 * Default strategy: Two agents alternate turns (ping-pong)
 * Each round consists of agent 0 speaking, then agent 1 speaking
 */
export class TwoAgentPingPongStrategy implements ConversationStrategy {
  /**
   * Gets the next agent to speak in a ping-pong pattern
   * Pattern: agent 0, agent 1, agent 0, agent 1, etc.
   */
  getNextAgent(context: ConversationContext): number | null {
    if (!this.shouldContinue(context)) {
      return null;
    }

    // Determine which agent based on message count
    // Even message count (0, 2, 4...) = agent 0
    // Odd message count (1, 3, 5...) = agent 1
    const agentIndex = context.messages.length % 2;
    return agentIndex;
  }

  /**
   * Builds conversation history for the API from the agent's perspective
   */
  buildConversationHistory(
    messages: Message[],
    agentId: string,
    initialPrompt: string
  ): ApiMessage[] {
    return MessageBuilder.buildConversationHistory(
      messages,
      agentId,
      initialPrompt
    );
  }

  /**
   * Checks if conversation should continue based on round limits
   */
  shouldContinue(context: ConversationContext): boolean {
    // Each round = 2 messages (one from each agent)
    // Total messages for N rounds = N * 2
    const maxMessages = context.maxRounds * 2;

    // Continue if we haven't reached the max message count
    return context.messages.length < maxMessages;
  }
}
