import {generateText} from "ai";
import * as dotenv from "dotenv";
import {
  ForumConfig,
  InternalForumConfig,
  Message,
  ConversationState,
} from "./types";
import {
  writeMessageToFile,
  generateTimestampSuffix,
  saveStateToFile,
} from "./utils";
import {TokenManager} from "./token-manager";
import {MessageBuilder} from "./message-builder";
import {Logger} from "./logger";
import {LLMService, DefaultLLMService} from "./llm-service";
import {
  ConversationStrategy,
  TwoAgentPingPongStrategy,
  ConversationContext,
} from "./strategies/conversation-strategy";

// Load environment variables
dotenv.config();

export class Forum {
  private config: InternalForumConfig;
  private state: ConversationState;
  private tokenManager: TokenManager;
  private llmService: LLMService;
  private strategy: ConversationStrategy;

  constructor(
    config: ForumConfig,
    llmService?: LLMService,
    strategy?: ConversationStrategy
  ) {
    // Set defaults for optional fields
    const initialPrompt = config.initialPrompt ?? "Rozpoczynamy konwersację";
    const outputDir = config.outputDir ?? "./threads";
    const maxTokens = config.maxTokens ?? 100000;

    this.config = {
      ...config,
      initialPrompt,
      outputDir,
      maxTokens,
    } as InternalForumConfig;

    // Add timestamp suffix to threadName for ordering and uniqueness
    this.config.threadName = `${
      this.config.threadName
    }-${generateTimestampSuffix()}`;

    this.state = {
      messages: [],
      totalTokens: 0,
      completed: false,
    };

    // Initialize token manager
    this.tokenManager = new TokenManager(this.config.maxTokens);

    // Initialize dependencies with defaults if not provided
    this.llmService = llmService ?? new DefaultLLMService();
    this.strategy = strategy ?? new TwoAgentPingPongStrategy();
  }

  /**
   * Runs the summarizer agent if configured
   */
  private async runSummarizer(): Promise<string | null> {
    if (!this.config.summarizer) {
      return null;
    }

    const summarizer = this.config.summarizer;
    Logger.logInfo(`Running summarizer: ${summarizer.agentId}`);

    try {
      // Generate the personality prompt based on the conversation state
      const personalityPrompt = summarizer.personality(this.state);

      // Create a simple message asking for the summary
      const messagesForApi = [
        {
          role: "user" as const,
          content: "Please provide your analysis based on the conversation.",
        },
      ];

      const result = await generateText({
        model: summarizer.model,
        system: personalityPrompt,
        messages: messagesForApi,
      });

      const summary = result.text;
      Logger.logInfo(
        `Summarizer completed. Generated ${
          result.usage?.outputTokens || 0
        } tokens`
      );

      // Save summary to file
      try {
        const summaryFilePath = `${this.config.outputDir}/${this.config.threadName}/summary.md`;
        const fs = await import("fs");
        const path = await import("path");

        // Ensure directory exists
        const dir = path.dirname(summaryFilePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, {recursive: true});
        }

        fs.writeFileSync(summaryFilePath, summary, "utf-8");
        Logger.logInfo(`Summary saved to: ${summaryFilePath}`);
      } catch (fileError) {
        Logger.logError("writing summary to file", fileError);
      }

      return summary;
    } catch (error) {
      Logger.logError("running summarizer", error);
      return null;
    }
  }

  /**
   * Generates a message from a participant using the injected LLM service
   */
  private async generateMessage(
    agentIndex: number,
    round: number
  ): Promise<Message | null> {
    const agent = this.config.agents[agentIndex];

    try {
      // Build conversation history for the current agent's perspective
      const messagesForApi = this.strategy.buildConversationHistory(
        this.state.messages,
        agent.agentId,
        this.config.initialPrompt
      );

      // Estimate tokens for the prompt (rough estimate)
      const systemPromptTokens = this.tokenManager.countTokens(
        agent.personality
      );
      const historyTokens = messagesForApi.reduce(
        (sum, msg) => sum + this.tokenManager.countTokens(msg.content),
        0
      );
      const estimatedInputTokens = systemPromptTokens + historyTokens;

      // Check if we're close to the token limit (leaving room for response)
      if (this.tokenManager.wouldExceedTokenLimit(estimatedInputTokens + 500)) {
        Logger.logTokenLimitExceeded();
        this.state.stoppedReason = "max_tokens";
        return null;
      }

      // Call LLM service (includes retry logic)
      const result = await this.llmService.generateText(
        agent.model,
        agent.personality,
        messagesForApi
      );

      const messageContent = result.text;
      const actualResponseTokens =
        result.outputTokens || this.tokenManager.countTokens(messageContent);

      // Check if this message would exceed the limit
      if (this.tokenManager.wouldExceedTokenLimit(actualResponseTokens)) {
        Logger.logResponseExceedsLimit();
        this.state.stoppedReason = "max_tokens";
        return null;
      }

      const message = MessageBuilder.createMessage(
        agent.agentId,
        messageContent,
        round,
        actualResponseTokens
      );

      const totalTokens = this.tokenManager.addTokens(actualResponseTokens);
      this.state.totalTokens = totalTokens;

      Logger.logParticipantTurn(
        agent.agentId,
        round,
        actualResponseTokens,
        totalTokens,
        this.tokenManager.getMaxTokens()
      );

      return message;
    } catch (error) {
      // LLM service already handled retries, so this is a final error
      Logger.logError(
        `generating message for ${agent.agentId} after all retries`,
        error
      );
      throw error;
    }
  }

  /**
   * Starts the conversation between the agents using the configured strategy
   */
  async runForum(): Promise<ConversationState> {
    Logger.logForumStart(
      this.config.threadName,
      this.config.rounds,
      this.config.maxTokens
    );

    let messageNumber = 1;

    // Use strategy to control conversation flow
    while (true) {
      const context: ConversationContext = {
        round: Math.floor(this.state.messages.length / 2) + 1,
        maxRounds: this.config.rounds,
        messages: this.state.messages,
        agents: this.config.agents,
        initialPrompt: this.config.initialPrompt,
      };

      // Ask strategy which agent should speak next
      const agentIndex = this.strategy.getNextAgent(context);

      // If strategy returns null, conversation should end
      if (agentIndex === null) {
        this.state.completed = true;
        this.state.stoppedReason = "max_rounds";
        Logger.logConversationCompleted();
        Logger.logFinalStats(
          this.state.messages.length,
          this.state.totalTokens
        );
        break;
      }

      let message: Message | null = null;

      try {
        message = await this.generateMessage(agentIndex, context.round);
      } catch (error) {
        // Handle unexpected errors that weren't retried
        const agent = this.config.agents[agentIndex];
        Logger.logUnexpectedError(
          `Failed to generate message for ${agent.agentId} after all retries`,
          error
        );

        // Stop conversation on fatal error
        this.state.completed = true;
        this.state.stoppedReason = "max_tokens"; // Use as fallback
        Logger.logConversationStopped("fatal_error");
        Logger.logFinalStats(
          this.state.messages.length,
          this.state.totalTokens
        );
        break;
      }

      if (!message) {
        // Token limit reached, stop the conversation
        this.state.completed = true;
        Logger.logConversationStopped(this.state.stoppedReason);
        Logger.logFinalStats(
          this.state.messages.length,
          this.state.totalTokens
        );
        break;
      }

      // Add message to state
      this.state.messages.push(message);

      // Write message to file
      try {
        writeMessageToFile(
          this.config.outputDir!,
          this.config.threadName,
          messageNumber,
          message,
          this.state.totalTokens
        );
        Logger.logMessageSaved(messageNumber, this.config.threadName);
      } catch (fileError) {
        Logger.logError("writing message to file", fileError);
        // Continue despite file write errors - don't stop the conversation
      }

      messageNumber++;
    }

    // Free the encoder
    this.tokenManager.free();

    saveStateToFile(this.config.outputDir!, this.config.threadName, this.state);

    // Run summarizer if configured
    await this.runSummarizer();

    return this.state;
  }
}
