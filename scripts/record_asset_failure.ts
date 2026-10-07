import { createFailureTracker } from "../src/failure_tracker.js";
import { recordAgentFailure } from "../src/game_agent_loop.js";

const decision = await recordAgentFailure(createFailureTracker(), {
  runId: crypto.randomUUID(),
  reason: "Image policy classifier rejected the generated skin",
  work: {
    kind: "player_asset",
    assetId: "asset_2048",
    assetKind: "skin",
    prompt: "neon tournament armor",
  },
});

console.log(JSON.stringify(decision, null, 2));
