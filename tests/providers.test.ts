import {describe, it, expect} from "vitest";
import {openrouter, orModel} from "../src/providers";

describe("OpenRouter provider", () => {
  it("exposes a configured provider instance", () => {
    expect(typeof openrouter).toBe("function");
    expect(typeof openrouter.chat).toBe("function");
  });

  it("builds a chat model carrying the requested slug without hitting the network", () => {
    const model = orModel("openai/gpt-4o-mini");
    expect(model).toBeTypeOf("object");
    // The model object is lazy — constructing it must not require a live API key.
    expect((model as {modelId: string}).modelId).toBe("openai/gpt-4o-mini");
  });
});
