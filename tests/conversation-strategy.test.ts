import {describe, it, expect} from "vitest";
import {
  TwoAgentPingPongStrategy,
  ConversationContext,
} from "../src/strategies/conversation-strategy";
import {Message, Agent} from "../src/types";

describe("TwoAgentPingPongStrategy", () => {
  const strategy = new TwoAgentPingPongStrategy();

  const mockAgents: [Agent, Agent] = [
    {
      agentId: "agent-1",
      model: {} as any,
      personality: "Agent 1 personality",
    },
    {
      agentId: "agent-2",
      model: {} as any,
      personality: "Agent 2 personality",
    },
  ];

  const createMessage = (agentId: string, round: number): Message => ({
    role: agentId,
    content: `Message from ${agentId}`,
    timestamp: new Date().toISOString(),
    round,
    tokens: 10,
  });

  describe("getNextAgent", () => {
    it("should return agent 0 for first turn", () => {
      const context: ConversationContext = {
        round: 1,
        maxRounds: 2,
        messages: [],
        agents: mockAgents,
        initialPrompt: "Start",
      };

      expect(strategy.getNextAgent(context)).toBe(0);
    });

    it("should alternate between agents (ping-pong pattern)", () => {
      const messages: Message[] = [];
      const context: ConversationContext = {
        round: 1,
        maxRounds: 3,
        messages,
        agents: mockAgents,
        initialPrompt: "Start",
      };

      // First turn - agent 0
      expect(strategy.getNextAgent(context)).toBe(0);
      messages.push(createMessage("agent-1", 1));

      // Second turn - agent 1
      expect(strategy.getNextAgent(context)).toBe(1);
      messages.push(createMessage("agent-2", 1));

      // Third turn - agent 0
      expect(strategy.getNextAgent(context)).toBe(0);
      messages.push(createMessage("agent-1", 2));

      // Fourth turn - agent 1
      expect(strategy.getNextAgent(context)).toBe(1);
    });

    it("should return null when max rounds reached", () => {
      const context: ConversationContext = {
        round: 2,
        maxRounds: 2,
        messages: [
          createMessage("agent-1", 1),
          createMessage("agent-2", 1),
          createMessage("agent-1", 2),
          createMessage("agent-2", 2),
        ],
        agents: mockAgents,
        initialPrompt: "Start",
      };

      expect(strategy.getNextAgent(context)).toBe(null);
    });
  });

  describe("shouldContinue", () => {
    it("should continue when within round limit", () => {
      const context: ConversationContext = {
        round: 1,
        maxRounds: 3,
        messages: [],
        agents: mockAgents,
        initialPrompt: "Start",
      };

      expect(strategy.shouldContinue(context)).toBe(true);
    });

    it("should stop after completing max rounds", () => {
      const context: ConversationContext = {
        round: 2,
        maxRounds: 2,
        messages: [
          createMessage("agent-1", 1),
          createMessage("agent-2", 1),
          createMessage("agent-1", 2),
          createMessage("agent-2", 2),
        ],
        agents: mockAgents,
        initialPrompt: "Start",
      };

      expect(strategy.shouldContinue(context)).toBe(false);
    });
  });

  describe("buildConversationHistory", () => {
    it("should return initial prompt when no messages", () => {
      const history = strategy.buildConversationHistory(
        [],
        "agent-1",
        "Initial prompt"
      );

      expect(history).toEqual([{role: "user", content: "Initial prompt"}]);
    });

    it("should format messages from agent perspective", () => {
      const messages: Message[] = [
        createMessage("agent-1", 1),
        createMessage("agent-2", 1),
      ];

      const history = strategy.buildConversationHistory(
        messages,
        "agent-1",
        "Initial prompt"
      );

      expect(history).toHaveLength(2);
      expect(history[0].role).toBe("assistant"); // Own message
      expect(history[1].role).toBe("user"); // Other agent's message
    });
  });
});
