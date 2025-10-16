import {Forum} from "./src/forum";
import {openai} from "@ai-sdk/openai";

import {DOMAIN_EXPERT} from "./prompts/experts/domain-expert";
import {SOFTWARE_ARCHITECT} from "./prompts/extractors/software-architect";
import {DDD_ANALYST} from "./prompts/summarizers/ddd-analyst";

async function main() {
  const dddForum = new Forum({
    threadName: "domain-discovery",
    rounds: 2,
    maxTokens: 30000,
    agents: [
      {
        agentId: "domain-expert",
        model: openai("gpt-5-mini"),
        personality: DOMAIN_EXPERT("streaming muzyki"),
      },
      {
        agentId: "software-architect",
        model: openai("gpt-4o-mini"),
        personality: SOFTWARE_ARCHITECT(),
      },
    ],
    summarizer: {
      agentId: "ddd-analyst",
      model: openai("gpt-5-mini"),
      personality: DDD_ANALYST,
    },
  });

  const domainAnalysisState = await dddForum.runForum();
}

main().catch(console.error);
