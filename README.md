# 🏛️ Agent Forum

![](./docs/agent-forum.png)

A TypeScript library for enabling AI Agents to communicate with each other in structured conversations.

### Example

```typescript
import {Forum} from "./src/forum";
import {openai} from "@ai-sdk/openai";

const forum = new Forum({
  threadName: "domain-discovery",
  rounds: 2,
  maxTokens: 30000,
  agents: [
    {
      agentId: "domain-expert",
      model: openai("gpt-4o-mini"),
      personality: "You are an expert in music streaming domain...",
    },
    {
      agentId: "software-architect",
      model: openai("gpt-4o-mini"),
      personality: "You are a software architect...",
    },
  ],
  summarizer: {
    agentId: "ddd-analyst",
    model: openai("gpt-4o-mini"),
    personality: (state) => `Analyze this conversation and provide insights...`,
  },
});

const result = await forum.runForum();
```

## Current Status

- [X] Core functionality works within the repository
- [ ] Published as standalone package on npm

## Features

- 🤖 **Two-Agent Conversations**: Pair two AI Agents with different roles to have multi-round discussions
- 📝 **Markdown Output**: Each message is saved as a markdown file with metadata
- 🎫 **Token Tracking**: Monitor token usage and set limits to control conversation length
- 📁 **File-based Prompts**: Load system prompts from files for better organization and re-usability
- 🔧 **Environment Variables**: Built-in dotenv support for API keys
- 🎭 **Role-based**: Assign specific roles to each Agent (e.g., domain expert, architect)
- 📊 **Summarization**: Summarize the conversation with a third agent

## How to start

1. Clone the repository
2. Run `npm install` to install the dependencies
3. Create a `.env` file and add your API keys
4. Run `npm start` to start the conversation

## Forum configuration

The `Forum` class accepts a configuration object with the following properties:

### Required Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `threadName` | `string` | Name of the conversation thread (used for output directory naming) |
| `rounds` | `number` | Number of conversation rounds between the two agents |
| `agents` | `[Agent, Agent]` | Array of exactly two Agent objects that will participate in the conversation |

### Optional Parameters

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `summarizer` | `Summarizer` | Agent that will summarize the conversation after it completes | - |
| `initialPrompt` | `string` | Starting message to kick off the conversation | `""` |
| `outputDir` | `string` | Directory where conversation threads will be saved | `"./threads"` |
| `maxTokens` | `number` | Maximum token limit for the entire conversation | `50000` |

### Agent Configuration

Each agent in the `agents` array must have:

```typescript
{
  agentId: string;        // Unique identifier for the agent
  model: LanguageModelV2; // AI SDK model (e.g., openai("gpt-4o-mini"))
  personality: string;    // System prompt defining the agent's role and behavior
}
```

### Summarizer Configuration

The optional summarizer agent has:

```typescript
{
  agentId: string;                              // Unique identifier for the summarizer
  model: LanguageModelV2;                       // AI SDK model
  personality: (state: ConversationState) => string; // Function that generates the system prompt based on conversation state
}
```
