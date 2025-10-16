import {encoding_for_model} from "tiktoken";

/**
 * Manages token counting and limit checking
 */
export class TokenManager {
  private encoder: ReturnType<typeof encoding_for_model>;
  private totalTokens: number = 0;
  private maxTokens?: number;

  constructor(maxTokens?: number) {
    this.encoder = encoding_for_model("gpt-4");
    this.maxTokens = maxTokens;
  }

  /**
   * Counts tokens in a text string
   */
  countTokens(text: string): number {
    const tokens = this.encoder.encode(text);
    return tokens.length;
  }

  /**
   * Checks if adding more tokens would exceed the limit
   */
  wouldExceedTokenLimit(additionalTokens: number): boolean {
    if (!this.maxTokens) {
      return false;
    }
    return this.totalTokens + additionalTokens > this.maxTokens;
  }

  /**
   * Adds tokens to the total and returns the current total
   */
  addTokens(tokens: number): number {
    this.totalTokens += tokens;
    return this.totalTokens;
  }

  /**
   * Gets the current total token count
   */
  getTotalTokens(): number {
    return this.totalTokens;
  }

  /**
   * Gets the max token limit (if set)
   */
  getMaxTokens(): number | undefined {
    return this.maxTokens;
  }

  /**
   * Frees up the encoder resources
   */
  free(): void {
    this.encoder.free();
  }
}
