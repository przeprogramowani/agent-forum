/**
 * Example demonstrating how to test Forum with mocked dependencies
 *
 * This example shows:
 * 1. How to create a mock LLM service (no actual API calls)
 * 2. How to inject dependencies into Forum for testing
 * 3. How to test conversation logic without expensive LLM calls
 */

import {Forum} from "../src/forum";
import {
  LLMService,
  LLMGenerationResult,
  ConversationStrategy,
  ConversationContext,
} from "../src/types";
import type {LanguageModelV2} from "@ai-sdk/provider";

/**
 * Mock LLM Service for testing - returns predefined responses
 */
class MockLLMService implements LLMService {
  private responses: string[];
  private currentIndex = 0;

  constructor(responses: string[]) {
    this.responses = responses;
  }

  async generateText(
    model: LanguageModelV2,
    systemPrompt: string,
    messages: {role: "user" | "assistant"; content: string}[]
  ): Promise<LLMGenerationResult> {
    // Return predefined response instead of calling real API
    const text = this.responses[this.currentIndex % this.responses.length];
    this.currentIndex++;

    return {
      text,
      outputTokens: text.split(" ").length, // Simple word count as token estimate
    };
  }
}

/**
 * Example: Testing Forum with mocked LLM service
 */
async function exampleTestForumWithMock() {
  console.log("=== Testing Forum with Mock LLM Service ===\n");

  // Define mock responses
  const mockResponses = [
    "Agent 1: First response from mocked LLM",
    "Agent 2: Second response from mocked LLM",
    "Agent 1: Third response from mocked LLM",
    "Agent 2: Fourth response from mocked LLM",
  ];

  const mockLLMService = new MockLLMService(mockResponses);

  // Create Forum with mock LLM service
  const forum = new Forum(
    {
      threadName: "test-conversation",
      rounds: 2,
      maxTokens: 10000,
      agents: [
        {
          agentId: "agent-1",
          model: {} as any, // Model not used in mock
          personality: "You are agent 1",
        },
        {
          agentId: "agent-2",
          model: {} as any, // Model not used in mock
          personality: "You are agent 2",
        },
      ],
    },
    mockLLMService // Inject mock LLM service
  );

  const result = await forum.runForum();

  console.log("Conversation completed!");
  console.log(`Total messages: ${result.messages.length}`);
  console.log(`Stopped reason: ${result.stoppedReason}\n`);

  result.messages.forEach((msg, i) => {
    console.log(
      `Message ${i + 1} (${msg.role}): ${msg.content.slice(0, 50)}...`
    );
  });
}

/**
 * Custom strategy example: Three-message limit strategy
 */
class ThreeMessageStrategy implements ConversationStrategy {
  getNextAgent(context: ConversationContext): number | null {
    // Stop after 3 messages total
    if (context.messages.length >= 3) {
      return null;
    }
    // Alternate between agents
    return context.messages.length % 2;
  }

  buildConversationHistory(
    messages: any[],
    agentId: string,
    initialPrompt: string
  ): {role: "user" | "assistant"; content: string}[] {
    if (messages.length === 0) {
      return [{role: "user", content: initialPrompt}];
    }
    return messages.map((msg: any) => ({
      role: msg.role === agentId ? ("assistant" as const) : ("user" as const),
      content: msg.content,
    }));
  }

  shouldContinue(context: ConversationContext): boolean {
    return context.messages.length < 3;
  }
}

/**
 * Example: Testing Forum with custom strategy
 */
async function exampleTestForumWithCustomStrategy() {
  console.log("\n\n=== Testing Forum with Custom Strategy ===\n");

  const mockLLMService = new MockLLMService([
    "Message 1",
    "Message 2",
    "Message 3",
    "Message 4 (should not appear)",
  ]);

  const customStrategy = new ThreeMessageStrategy();

  const forum = new Forum(
    {
      threadName: "test-custom-strategy",
      rounds: 10, // Set high, but strategy will stop at 3 messages
      maxTokens: 10000,
      agents: [
        {
          agentId: "agent-1",
          model: {} as any,
          personality: "Agent 1",
        },
        {
          agentId: "agent-2",
          model: {} as any,
          personality: "Agent 2",
        },
      ],
    },
    mockLLMService,
    customStrategy // Inject custom strategy
  );

  const result = await forum.runForum();

  console.log("Conversation completed!");
  console.log(`Total messages: ${result.messages.length}`);
  console.log("(Should be exactly 3 messages due to custom strategy)\n");
}

// Run examples
async function runExamples() {
  try {
    await exampleTestForumWithMock();
    await exampleTestForumWithCustomStrategy();
  } catch (error) {
    console.error("Error running examples:", error);
  }
}

// Uncomment to run:
// runExamples();

export {MockLLMService, ThreeMessageStrategy};
