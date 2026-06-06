import {describe, it, expect} from "vitest";
import {MessageBuilder} from "../src/message-builder";
import {Message} from "../src/types";

describe("MessageBuilder.buildConversationHistory", () => {
  it("returns the initial prompt as a single user message when history is empty", () => {
    const history = MessageBuilder.buildConversationHistory(
      [],
      "agent-1",
      "Let's begin"
    );

    expect(history).toEqual([{role: "user", content: "Let's begin"}]);
  });

  it("maps the current agent's own messages to 'assistant' and the rest to 'user'", () => {
    const messages: Message[] = [
      {
        role: "agent-1",
        content: "A1 says hi",
        timestamp: "t1",
        round: 1,
        tokens: 3,
      },
      {
        role: "agent-2",
        content: "A2 replies",
        timestamp: "t2",
        round: 1,
        tokens: 2,
      },
    ];

    // From agent-1's perspective: its own line is assistant, the other is user.
    const fromAgent1 = MessageBuilder.buildConversationHistory(
      messages,
      "agent-1",
      "ignored"
    );
    expect(fromAgent1).toEqual([
      {role: "assistant", content: "A1 says hi"},
      {role: "user", content: "A2 replies"},
    ]);

    // The perspective flips entirely for agent-2.
    const fromAgent2 = MessageBuilder.buildConversationHistory(
      messages,
      "agent-2",
      "ignored"
    );
    expect(fromAgent2).toEqual([
      {role: "user", content: "A1 says hi"},
      {role: "assistant", content: "A2 replies"},
    ]);
  });
});

describe("MessageBuilder.createMessage", () => {
  it("builds a message with an ISO timestamp and the provided fields", () => {
    const message = MessageBuilder.createMessage("agent-1", "content", 2, 42);

    expect(message.role).toBe("agent-1");
    expect(message.content).toBe("content");
    expect(message.round).toBe(2);
    expect(message.tokens).toBe(42);
    // Timestamp should be a valid, round-trippable ISO string.
    expect(new Date(message.timestamp).toISOString()).toBe(message.timestamp);
  });
});
