import {describe, it, expect, beforeEach, afterEach, vi} from "vitest";

// Mock the AI SDK's generateText so we can drive success/failure deterministically.
const {generateTextMock} = vi.hoisted(() => ({generateTextMock: vi.fn()}));
vi.mock("ai", () => ({generateText: generateTextMock}));

import {DefaultLLMService} from "../src/llm-service";

describe("DefaultLLMService retry logic", () => {
  beforeEach(() => {
    generateTextMock.mockReset();
    // Keep test output clean; the service logs warnings/errors on retries.
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("returns text and output tokens on success", async () => {
    generateTextMock.mockResolvedValue({
      text: "hello there",
      usage: {outputTokens: 7},
      response: {},
    });

    const service = new DefaultLLMService();
    const result = await service.generateText({} as any, "system", [
      {role: "user", content: "hi"},
    ]);

    expect(result).toEqual({text: "hello there", outputTokens: 7});
    expect(generateTextMock).toHaveBeenCalledTimes(1);
  });

  it("defaults output tokens to 0 when usage is missing", async () => {
    generateTextMock.mockResolvedValue({text: "no usage field"});

    const service = new DefaultLLMService();
    const result = await service.generateText({} as any, "system", []);

    expect(result).toEqual({text: "no usage field", outputTokens: 0});
  });

  it("throws immediately on a non-retryable (authentication) error", async () => {
    generateTextMock.mockRejectedValue(new Error("401 Unauthorized"));

    const service = new DefaultLLMService();
    await expect(
      service.generateText({} as any, "system", [])
    ).rejects.toThrow(/401/);

    // No retries for non-retryable errors.
    expect(generateTextMock).toHaveBeenCalledTimes(1);
  });

  it("retries on a retryable (server) error and then succeeds", async () => {
    vi.useFakeTimers();
    generateTextMock
      .mockRejectedValueOnce(new Error("500 internal server error"))
      .mockResolvedValueOnce({text: "recovered", usage: {outputTokens: 2}});

    const service = new DefaultLLMService();
    const promise = service.generateText({} as any, "system", []);

    // Fast-forward through the exponential backoff sleep.
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.text).toBe("recovered");
    expect(generateTextMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after exhausting retries on persistent retryable errors", async () => {
    vi.useFakeTimers();
    generateTextMock.mockRejectedValue(new Error("503 service unavailable"));

    const service = new DefaultLLMService();
    const promise = service.generateText({} as any, "system", []);
    // Attach a rejection handler up-front so the rejection is never "unhandled"
    // while we advance the fake timers.
    const settled = expect(promise).rejects.toThrow(/503/);

    await vi.runAllTimersAsync();
    await settled;

    // Initial attempt + 3 retries = 4 calls.
    expect(generateTextMock).toHaveBeenCalledTimes(4);
  });
});
