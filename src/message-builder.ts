import {Message} from "./types";

interface ApiMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Builds API messages for agents
 */
export class MessageBuilder {
  /**
   * Builds conversation history for the API from the agent's perspective
   */
  static buildConversationHistory(
    conversationMessages: Message[],
    agentId: string,
    initialPrompt: string
  ): ApiMessage[] {
    if (conversationMessages.length === 0) {
      return [{role: "user" as const, content: initialPrompt}];
    }

    return conversationMessages.map((msg) => ({
      role: msg.role === agentId ? ("assistant" as const) : ("user" as const),
      content: msg.content,
    }));
  }

  /**
   * Creates a message object from the response
   */
  static createMessage(
    role: string,
    content: string,
    round: number,
    tokens: number
  ): Message {
    return {
      role,
      content,
      timestamp: new Date().toISOString(),
      round,
      tokens,
    };
  }
}
