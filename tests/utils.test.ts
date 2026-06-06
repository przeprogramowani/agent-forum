import {describe, it, expect, afterEach} from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  ensureDirectoryExists,
  readSystemPrompt,
  writeMessageToFile,
  saveStateToFile,
  formatNumber,
  generateTimestampSuffix,
} from "../src/utils";
import {Message, ConversationState} from "../src/types";

const tmpRoot = "./test-utils-tmp";

afterEach(() => {
  if (fs.existsSync(tmpRoot)) {
    fs.rmSync(tmpRoot, {recursive: true, force: true});
  }
});

describe("ensureDirectoryExists", () => {
  it("creates nested directories idempotently", () => {
    const nested = path.join(tmpRoot, "a", "b", "c");
    ensureDirectoryExists(nested);
    expect(fs.existsSync(nested)).toBe(true);
    // Calling again must not throw.
    expect(() => ensureDirectoryExists(nested)).not.toThrow();
  });
});

describe("readSystemPrompt", () => {
  it("reads and trims a prompt file", () => {
    ensureDirectoryExists(tmpRoot);
    const file = path.join(tmpRoot, "prompt.txt");
    fs.writeFileSync(file, "  hello prompt  \n", "utf-8");
    expect(readSystemPrompt(file)).toBe("hello prompt");
  });

  it("throws a descriptive error for a missing file", () => {
    expect(() => readSystemPrompt(path.join(tmpRoot, "nope.txt"))).toThrow(
      /Failed to read system prompt/
    );
  });
});

describe("writeMessageToFile", () => {
  it("writes a zero-padded markdown file with frontmatter and content", () => {
    const message: Message = {
      role: "domain-expert",
      content: "Body of the message",
      timestamp: "2026-06-06T00:00:00.000Z",
      round: 1,
      tokens: 4,
    };

    writeMessageToFile(tmpRoot, "thread", 7, message, 99);

    const file = path.join(tmpRoot, "thread", "007-domain-expert.md");
    expect(fs.existsSync(file)).toBe(true);

    const written = fs.readFileSync(file, "utf-8");
    expect(written).toContain("role: domain-expert");
    expect(written).toContain("round: 1");
    expect(written).toContain("tokens: 4");
    expect(written).toContain("totalTokens: 99");
    expect(written.trimEnd().endsWith("Body of the message")).toBe(true);
  });
});

describe("saveStateToFile", () => {
  it("serializes the conversation state to parseable JSON", () => {
    const state: ConversationState = {
      messages: [],
      totalTokens: 123,
      completed: true,
      stoppedReason: "max_rounds",
    };

    saveStateToFile(tmpRoot, "thread", state);

    const file = path.join(tmpRoot, "thread", "state.json");
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8"));
    expect(parsed).toEqual(state);
  });
});

describe("formatNumber", () => {
  it("groups large numbers and leaves small ones intact", () => {
    expect(formatNumber(7)).toBe("7");
    // Grouped output contains the digits in order with a single separator.
    expect(formatNumber(1234)).toMatch(/^1\D?234$/);
  });
});

describe("generateTimestampSuffix", () => {
  it("produces a filesystem-safe, sortable timestamp", () => {
    const suffix = generateTimestampSuffix();
    expect(suffix).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/);
  });
});
