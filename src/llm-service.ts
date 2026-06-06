import {generateText} from "ai";
import type {LanguageModel} from "ai";
import {Logger} from "./logger";

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

/**
 * API message format
 */
interface ApiMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Result from LLM generation
 */
export interface LLMGenerationResult {
  text: string;
  outputTokens: number;
}

/**
 * Interface for LLM text generation
 */
export interface LLMService {
  generateText(
    model: LanguageModel,
    systemPrompt: string,
    messages: ApiMessage[]
  ): Promise<LLMGenerationResult>;
}

/**
 * Default implementation of LLMService using AI SDK with retry logic
 */
export class DefaultLLMService implements LLMService {
  private retryConfig: RetryConfig = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
  };

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
   * Generates text using the LLM with retry logic
   */
  async generateText(
    model: LanguageModel,
    systemPrompt: string,
    messages: ApiMessage[]
  ): Promise<LLMGenerationResult> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        const result = await generateText({
          model,
          system: systemPrompt,
          messages,
        });

        // Check if there's an actual response
        if (!result.text && result.response) {
          Logger.logEmptyResponse(result.response);
        }

        const text = result.text;
        const outputTokens = result.usage?.outputTokens || 0;

        return {text, outputTokens};
      } catch (error) {
        lastError = error;
        const errorType = this.classifyError(error);

        if (!this.isRetryableError(errorType)) {
          // Non-retryable error - throw immediately
          throw error;
        }

        // Retryable error
        if (attempt < this.retryConfig.maxRetries) {
          const delay = this.calculateBackoffDelay(attempt, errorType);
          await this.sleep(delay);
          // Continue to next attempt
        } else {
          // Max retries exceeded
          throw error;
        }
      }
    }

    // Should not reach here, but fallback
    throw lastError || new Error("Failed to generate text after retries");
  }
}
