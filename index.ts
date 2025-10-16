import {Forum} from "./src/forum";
import {openai} from "@ai-sdk/openai";

// import {DOMAIN_EXPERT} from "./prompts/experts/domain-expert";
// import {SOFTWARE_ARCHITECT} from "./prompts/extractors/software-architect";
// import {DDD_ANALYST} from "./prompts/summarizers/ddd-analyst";

import {MVP_AUTHOR} from "./prompts/extractors/mvp-author";
import {PRD_PLANNER} from "./prompts/experts/prd-planner";
import {PRD_CREATOR} from "./prompts/summarizers/prd-creator";

async function main() {
  const prdForum = new Forum({
    threadName: "domain-discovery",
    rounds: 4,
    maxTokens: 30000,
    agents: [
      {
        agentId: "prd-planner",
        model: openai("gpt-5-mini"),
        personality: PRD_PLANNER(),
      },
      {
        agentId: "mvp-author",
        model: openai("gpt-4o-mini"),
        personality: MVP_AUTHOR(),
      },
    ],
    summarizer: {
      agentId: "prd-creator",
      model: openai("gpt-5"),
      personality: PRD_CREATOR,
    },
  });

  await prdForum.runForum();
}

main().catch(console.error);
