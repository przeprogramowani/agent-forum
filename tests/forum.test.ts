import {describe, it, expect, beforeEach, afterEach} from "vitest";
import {Forum} from "../src/forum";
import {LLMService, LLMGenerationResult} from "../src/llm-service";
import {ForumConfig} from "../src/types";
import type {LanguageModelV2} from "@ai-sdk/provider";
import * as fs from "fs";
import * as path from "path";

/**
 * Mock LLM Service for testing
 */
class TestMockLLMService implements LLMService {
  private responses: string[];
  private callCount = 0;

  constructor(responses: string[]) {
    this.responses = responses;
  }

  async generateText(
    model: LanguageModelV2,
    systemPrompt: string,
    messages: {role: "user" | "assistant"; content: string}[]
  ): Promise<LLMGenerationResult> {
    const text = this.responses[this.callCount % this.responses.length];
    this.callCount++;

    return {
      text,
      outputTokens: text.split(" ").length,
    };
  }

  getCallCount(): number {
    return this.callCount;
  }
}

describe("Forum Integration", () => {
  const testOutputDir = "./test-threads";

  afterEach(() => {
    // Clean up test output directory
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, {recursive: true, force: true});
    }
  });

  it("should complete a conversation with mocked LLM service", async () => {
    const mockLLMService = new TestMockLLMService([
      "Agent 1 first response",
      "Agent 2 first response",
      "Agent 1 second response",
      "Agent 2 second response",
    ]);

    const config: ForumConfig = {
      threadName: "test-forum",
      rounds: 2,
      maxTokens: 10000,
      outputDir: testOutputDir,
      agents: [
        {
          agentId: "agent-1",
          model: {} as any,
          personality: "You are agent 1",
        },
        {
          agentId: "agent-2",
          model: {} as any,
          personality: "You are agent 2",
        },
      ],
    };

    const forum = new Forum(config, mockLLMService);
    const result = await forum.runForum();

    // Verify conversation completed
    expect(result.completed).toBe(true);
    expect(result.stoppedReason).toBe("max_rounds");

    // Verify correct number of messages (2 rounds × 2 agents = 4 messages)
    expect(result.messages).toHaveLength(4);

    // Verify message alternation
    expect(result.messages[0].role).toBe("agent-1");
    expect(result.messages[1].role).toBe("agent-2");
    expect(result.messages[2].role).toBe("agent-1");
    expect(result.messages[3].role).toBe("agent-2");

    // Verify LLM service was called correct number of times
    expect(mockLLMService.getCallCount()).toBe(4);
  });

  it("should track token usage", async () => {
    const mockLLMService = new TestMockLLMService([
      "Short message", // 2 tokens
      "Another short message", // 3 tokens
    ]);

    const config: ForumConfig = {
      threadName: "test-tokens",
      rounds: 1,
      maxTokens: 10000,
      outputDir: testOutputDir,
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
    };

    const forum = new Forum(config, mockLLMService);
    const result = await forum.runForum();

    // Verify total tokens tracked
    expect(result.totalTokens).toBeGreaterThan(0);
    expect(result.messages[0].tokens).toBe(2);
    expect(result.messages[1].tokens).toBe(3);
  });

  it("should respect round limits", async () => {
    const mockLLMService = new TestMockLLMService([
      "Message 1",
      "Message 2",
      "Message 3",
      "Message 4",
      "Message 5",
      "Message 6",
    ]);

    const config: ForumConfig = {
      threadName: "test-limits",
      rounds: 2, // Only 2 rounds = 4 messages
      maxTokens: 10000,
      outputDir: testOutputDir,
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
    };

    const forum = new Forum(config, mockLLMService);
    const result = await forum.runForum();

    // Should stop at 4 messages (2 rounds)
    expect(result.messages).toHaveLength(4);
    expect(result.stoppedReason).toBe("max_rounds");

    // LLM service should only be called 4 times
    expect(mockLLMService.getCallCount()).toBe(4);
  });

  it("should create output files", async () => {
    const mockLLMService = new TestMockLLMService([
      "First message",
      "Second message",
    ]);

    const config: ForumConfig = {
      threadName: "test-output",
      rounds: 1,
      maxTokens: 10000,
      outputDir: testOutputDir,
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
    };

    const forum = new Forum(config, mockLLMService);
    await forum.runForum();

    // Find the created thread directory (has timestamp suffix)
    const threadDirs = fs
      .readdirSync(testOutputDir)
      .filter((f) => f.startsWith("test-output-"));

    expect(threadDirs).toHaveLength(1);

    const threadDir = path.join(testOutputDir, threadDirs[0]);

    // Check message files exist
    expect(fs.existsSync(path.join(threadDir, "001-agent-1.md"))).toBe(true);
    expect(fs.existsSync(path.join(threadDir, "002-agent-2.md"))).toBe(true);

    // Check state file exists
    expect(fs.existsSync(path.join(threadDir, "state.json"))).toBe(true);
  });
});
