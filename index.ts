import {Forum} from "./src/forum";
import {orModel} from "./src/providers";

import {BEGINNER_DEVELOPER} from "./prompts/extractors/beginner-developer";
import {SPACED_REPETITION_EXPERT} from "./prompts/experts/spaced-repetition-expert";
import {LEARNING_INSIGHTS} from "./prompts/summarizers/learning-insights";

// Interview between two models, served through OpenRouter:
//   - a beginner programmer (interviewer) who leads with questions, and
//   - a domain expert (interviewee) on learning with spaced repetition.
//
// The ping-pong strategy alternates turns starting with agent[0]. Putting the
// beginner first means every round is a clean question -> answer exchange, so
// `rounds: 3` yields exactly 3 questions, each answered by the expert.
async function main() {
  const forum = new Forum({
    threadName: "spaced-repetition-interview",
    rounds: 3,
    maxTokens: 30000,
    initialPrompt:
      "Rozpoczynasz wywiad z ekspertem od nauki ze spaced repetition. " +
      "Przedstaw się w jednym zdaniu i zadaj swoje pierwsze, najważniejsze pytanie.",
    agents: [
      {
        // Interviewer — asks first, drives the conversation.
        agentId: "beginner-developer",
        model: orModel("openai/gpt-4o-mini"),
        personality: BEGINNER_DEVELOPER(),
      },
      {
        // Interviewee — answers the beginner's questions.
        agentId: "spaced-repetition-expert",
        model: orModel("anthropic/claude-sonnet-4.5"),
        personality: SPACED_REPETITION_EXPERT(),
      },
    ],
    summarizer: {
      // Distills the interview into a structured domain brief.
      agentId: "learning-insights",
      model: orModel("openai/gpt-4o"),
      personality: LEARNING_INSIGHTS,
    },
  });

  await forum.runForum();
}

main().catch(console.error);
