import {describe, it, expect} from "vitest";
import {LLMService, LLMGenerationResult} from "../src/llm-service";
import type {LanguageModelV2} from "@ai-sdk/provider";

/**
 * Mock LLM Service for testing
 */
class MockLLMService implements LLMService {
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

describe("LLMService Mock", () => {
  it("should return predefined responses", async () => {
    const mockService = new MockLLMService([
      "First response",
      "Second response",
    ]);

    const result1 = await mockService.generateText({} as any, "system", [
      {role: "user", content: "Hello"},
    ]);

    expect(result1.text).toBe("First response");
    expect(result1.outputTokens).toBe(2);

    const result2 = await mockService.generateText({} as any, "system", [
      {role: "user", content: "Hi again"},
    ]);

    expect(result2.text).toBe("Second response");
    expect(result2.outputTokens).toBe(2);
  });

  it("should cycle through responses", async () => {
    const mockService = new MockLLMService(["Response 1", "Response 2"]);

    await mockService.generateText({} as any, "system", []);
    await mockService.generateText({} as any, "system", []);

    // Third call should cycle back to first response
    const result = await mockService.generateText({} as any, "system", []);
    expect(result.text).toBe("Response 1");
  });

  it("should track call count", async () => {
    const mockService = new MockLLMService(["Response"]);

    expect(mockService.getCallCount()).toBe(0);

    await mockService.generateText({} as any, "system", []);
    expect(mockService.getCallCount()).toBe(1);

    await mockService.generateText({} as any, "system", []);
    await mockService.generateText({} as any, "system", []);
    expect(mockService.getCallCount()).toBe(3);
  });
});
