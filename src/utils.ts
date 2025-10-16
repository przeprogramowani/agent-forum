import * as fs from "fs";
import * as path from "path";
import {Message} from "./types";
import {ConversationState} from "./types";

/**
 * Creates a directory if it doesn't exist
 */
export function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, {recursive: true});
  }
}

/**
 * Reads a system prompt from a file
 */
export function readSystemPrompt(promptPath: string): string {
  try {
    return fs.readFileSync(promptPath, "utf-8").trim();
  } catch (error) {
    throw new Error(
      `Failed to read system prompt from ${promptPath}: ${error}`
    );
  }
}

/**
 * Writes a message to a markdown file with frontmatter
 */
export function writeMessageToFile(
  outputDir: string,
  threadName: string,
  messageNumber: number,
  message: Message,
  totalTokens: number
): void {
  const threadDir = path.join(outputDir, threadName);
  ensureDirectoryExists(threadDir);

  const fileName = `${String(messageNumber).padStart(3, "0")}-${
    message.role
  }.md`;
  const filePath = path.join(threadDir, fileName);

  const frontmatter = [
    "---",
    `role: ${message.role}`,
    `timestamp: ${message.timestamp}`,
    `round: ${message.round}`,
    `tokens: ${message.tokens}`,
    `totalTokens: ${totalTokens}`,
    "---",
    "",
  ].join("\n");

  const content = frontmatter + message.content;

  fs.writeFileSync(filePath, content, "utf-8");
}

/**
 * Formats a number with commas for better readability
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Saves the conversation state to a JSON file
 */
export function saveStateToFile(
  outputDir: string,
  threadName: string,
  state: ConversationState
): void {
  const threadDir = path.join(outputDir, threadName);
  ensureDirectoryExists(threadDir);

  const filePath = path.join(threadDir, "state.json");
  const jsonContent = JSON.stringify(state, null, 2);

  fs.writeFileSync(filePath, jsonContent, "utf-8");
}

/**
 * Generates a sortable timestamp suffix for folder names
 * Format: YYYY-MM-DDTHH-mm-ss (ISO format with colons replaced by hyphens)
 */
export function generateTimestampSuffix(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
}
