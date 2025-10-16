import {generateText} from "ai";
import * as dotenv from "dotenv";
import {
  ForumConfig,
  InternalForumConfig,
  Agent,
  Message,
  ConversationState,
  Summarizer,
} from "./types";
import {
  writeMessageToFile,
  generateTimestampSuffix,
  saveStateToFile,
} from "./utils";
import {TokenManager} from "./token-manager";
import {MessageBuilder} from "./message-builder";
import {Logger} from "./logger";

// Load environment variables
dotenv.config();

/**
 * Error classification for different types of API failures
 */
enum ErrorType {
  RATE_LIMIT = "rate_limit",
  AUTHENTICATION = "authentication",
  SERVER_ERROR = "server_error",
  TIMEOUT = "timeout",
  INVALID_REQUEST = "invalid_request",
  UNKNOWN = "unknown",
}

/**
 * Configuration for retry behavior
 */
interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export class Forum {
  private config: InternalForumConfig;
  private state: ConversationState;
  private tokenManager: TokenManager;
  private retryConfig: RetryConfig = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
  };

  constructor(config: ForumConfig) {
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
  }

  /**
   * Classifies error types for better error handling
   */
  private classifyError(error: unknown): ErrorType {
    const errorStr = String(error).toLowerCase();
    const errorMsg = error instanceof Error ? error.message : "";

    if (
      errorStr.includes("rate limit") ||
      errorMsg.includes("429") ||
      errorMsg.includes("rate_limit")
    ) {
      return ErrorType.RATE_LIMIT;
    }

    if (
      errorStr.includes("unauthorized") ||
      errorStr.includes("authentication") ||
      errorMsg.includes("401") ||
      errorMsg.includes("403")
    ) {
      return ErrorType.AUTHENTICATION;
    }

    if (
      errorMsg.includes("500") ||
      errorMsg.includes("502") ||
      errorMsg.includes("503") ||
      errorMsg.includes("504") ||
      errorStr.includes("server")
    ) {
      return ErrorType.SERVER_ERROR;
    }

    if (
      errorStr.includes("timeout") ||
      errorMsg.includes("ETIMEDOUT") ||
      errorMsg.includes("ECONNRESET")
    ) {
      return ErrorType.TIMEOUT;
    }

    if (
      errorStr.includes("invalid") ||
      errorMsg.includes("400") ||
      errorMsg.includes("malformed")
    ) {
      return ErrorType.INVALID_REQUEST;
    }

    return ErrorType.UNKNOWN;
  }

  /**
   * Determines if an error is retryable
   */
  private isRetryableError(errorType: ErrorType): boolean {
    return (
      errorType === ErrorType.RATE_LIMIT ||
      errorType === ErrorType.SERVER_ERROR ||
      errorType === ErrorType.TIMEOUT
    );
  }

  /**
   * Calculates exponential backoff delay
   */
  private calculateBackoffDelay(
    retryAttempt: number,
    errorType: ErrorType
  ): number {
    let delay =
      this.retryConfig.initialDelayMs *
      Math.pow(this.retryConfig.backoffMultiplier, retryAttempt);

    // Add jitter to prevent thundering herd
    delay += Math.random() * delay * 0.1;

    // Add extra delay for rate limit errors
    if (errorType === ErrorType.RATE_LIMIT) {
      delay *= 1.5;
    }

    return Math.min(delay, this.retryConfig.maxDelayMs);
  }

  /**
   * Sleeps for a specified number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
   * Generates a message from a participant with retry logic
   */
  private async generateMessage(
    agentIndex: number,
    round: number
  ): Promise<Message | null> {
    const agent = this.config.agents[agentIndex];
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        // Build conversation history for the current agent's perspective
        const messagesForApi = MessageBuilder.buildConversationHistory(
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
        if (
          this.tokenManager.wouldExceedTokenLimit(estimatedInputTokens + 500)
        ) {
          Logger.logTokenLimitExceeded();
          this.state.stoppedReason = "max_tokens";
          return null;
        }

        try {
          const requestPayload = {
            model: agent.model,
            system: agent.personality,
            messages: messagesForApi,
          };

          const result = await generateText(requestPayload);

          // Check if there's an actual response
          if (!result.text && result.response) {
            Logger.logEmptyResponse(result.response);
          }

          const messageContent = result.text;

          // Use actual token usage from the API response if available, otherwise count manually
          const actualResponseTokens =
            result.usage?.outputTokens ||
            this.tokenManager.countTokens(messageContent);

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
          lastError = error;
          const errorType = this.classifyError(error);

          if (!this.isRetryableError(errorType)) {
            // Non-retryable error - log and throw immediately
            Logger.logError(
              `generating message for ${agent.agentId} (non-retryable error)`,
              error
            );
            throw error;
          }

          // Retryable error
          if (attempt < this.retryConfig.maxRetries) {
            const delay = this.calculateBackoffDelay(attempt, errorType);
            Logger.logRetryableError(
              agent.agentId,
              round,
              attempt,
              this.retryConfig.maxRetries,
              errorType,
              delay
            );
            await this.sleep(delay);
            // Continue to next attempt
          } else {
            // Max retries exceeded
            Logger.logMaxRetriesExceeded(
              agent.agentId,
              round,
              this.retryConfig.maxRetries,
              errorType,
              error
            );
            throw error;
          }
        }
      } catch (error) {
        lastError = error;
        // If this is the last attempt or non-retryable, rethrow
        if (attempt === this.retryConfig.maxRetries) {
          throw error;
        }
      }
    }

    // Should not reach here, but fallback
    throw lastError || new Error("Failed to generate message after retries");
  }

  /**
   * Starts the conversation between the two agents
   */
  async runForum(): Promise<ConversationState> {
    Logger.logForumStart(
      this.config.threadName,
      this.config.rounds,
      this.config.maxTokens
    );

    let messageNumber = 1;

    for (let round = 1; round <= this.config.rounds; round++) {
      // Each round consists of one message from each agent
      for (let agentIndex = 0; agentIndex < 2; agentIndex++) {
        let message: Message | null = null;

        try {
          message = await this.generateMessage(agentIndex, round);
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
          saveStateToFile(
            this.config.outputDir!,
            this.config.threadName,
            this.state
          );

          // Run summarizer if configured
          await this.runSummarizer();

          return this.state;
        }

        if (!message) {
          // Token limit reached, stop the conversation
          this.state.completed = true;
          Logger.logConversationStopped(this.state.stoppedReason);
          Logger.logFinalStats(
            this.state.messages.length,
            this.state.totalTokens
          );
          saveStateToFile(
            this.config.outputDir!,
            this.config.threadName,
            this.state
          );

          // Run summarizer if configured
          await this.runSummarizer();

          return this.state;
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
    }

    this.state.completed = true;
    this.state.stoppedReason = "max_rounds";

    Logger.logConversationCompleted();
    Logger.logFinalStats(this.state.messages.length, this.state.totalTokens);

    // Free the encoder
    this.tokenManager.free();

    saveStateToFile(this.config.outputDir!, this.config.threadName, this.state);

    // Run summarizer if configured
    await this.runSummarizer();

    return this.state;
  }
}
