import {formatNumber} from "./utils";

/**
 * Handles all forum logging
 */
export class Logger {
  static logForumStart(
    threadName: string,
    rounds: number,
    maxTokens?: number
  ): void {
    console.log(`\n🎭 Starting forum: ${threadName}`);
    console.log(`📝 Rounds: ${rounds}`);
    if (maxTokens) {
      console.log(`🎫 Max tokens: ${formatNumber(maxTokens)}`);
    }
  }

  static logParticipantTurn(
    role: string,
    round: number,
    tokens: number,
    totalTokens: number,
    maxTokens?: number
  ): void {
    console.log(`\n🎯 ${role} takes turn - round ${round}`);
    console.log(`📝 Generated ${formatNumber(tokens)} tokens for this message`);
    console.log(
      `📊 Tokens in thread: ${formatNumber(totalTokens)}${
        maxTokens ? `/${formatNumber(maxTokens)}` : ""
      } total`
    );
  }

  static logMessageSaved(messageNumber: number, threadName: string): void {
    console.log(
      `💾 Saved message ${messageNumber} to ${threadName}/${String(
        messageNumber
      ).padStart(3, "0")}.md`
    );
  }

  static logTokenLimitExceeded(): void {
    console.log(`⚠️  Token limit would be exceeded. Stopping conversation.`);
  }

  static logResponseExceedsLimit(): void {
    console.log(
      `⚠️  Response would exceed token limit. Stopping conversation.`
    );
  }

  static logEmptyResponse(response: unknown): void {
    console.log(
      `⚠️  Empty text but response exists. Response structure:`,
      JSON.stringify(response, null, 2).substring(0, 1000)
    );
  }

  static logConversationStopped(reason?: string): void {
    console.log(`\n🏁 Conversation stopped: ${reason}`);
  }

  static logFinalStats(messageCount: number, totalTokens: number): void {
    console.log(
      `📊 Final stats: ${messageCount} messages, ${formatNumber(
        totalTokens
      )} total tokens`
    );
  }

  static logConversationCompleted(): void {
    console.log(`\n🏁 Conversation completed!`);
  }

  static logError(context: string, error: unknown): void {
    console.error(`Error ${context}:`, error);
  }

  static logRetryableError(
    role: string,
    round: number,
    attemptNumber: number,
    maxRetries: number,
    errorType: string,
    delayMs: number
  ): void {
    console.warn(
      `⚠️  Retryable error for ${role} (round ${round}): ${errorType} (attempt ${
        attemptNumber + 1
      }/${maxRetries + 1}). Retrying in ${delayMs.toFixed(0)}ms...`
    );
  }

  static logMaxRetriesExceeded(
    role: string,
    round: number,
    maxRetries: number,
    errorType: string,
    error: unknown
  ): void {
    console.error(
      `❌ Max retries (${maxRetries}) exceeded for ${role} (round ${round}). Error type: ${errorType}`
    );
    console.error(`Details:`, error);
  }

  static logUnexpectedError(context: string, error: unknown): void {
    console.error(`❌ ${context}`);
    console.error(`Details:`, error);
  }

  static logInfo(message: string): void {
    console.log(`\nℹ️  ${message}`);
  }
}
