import assert from "node:assert/strict";
import test from "node:test";
import type { FailureCapture, FailureTracker } from "../src/failure_tracker.js";
import { recordAgentFailure } from "../src/game_agent_loop.js";

test("a failed player asset enters moderation with a stable grouping key", async () => {
  const calls: Array<{ payload: FailureCapture; key: string }> = [];
  const tracker: FailureTracker = {
    async capture(payload, key) {
      calls.push({ payload, key });
      return { event_id: "evt_test" };
    },
  };

  const decision = await recordAgentFailure(tracker, {
    runId: "0195ad4b-3c84-7d5e-a016-4ad82e287c67",
    reason: "Classifier rejected generated geometry",
    work: {
      kind: "player_asset",
      assetId: "asset_42",
      assetKind: "level",
      prompt: "floating arena",
    },
  });

  assert.deepEqual(decision, {
    runId: "0195ad4b-3c84-7d5e-a016-4ad82e287c67",
    state: "queued_for_moderation",
    queue: "asset-moderation",
  });
  assert.deepEqual(calls[0]?.payload.fingerprint, ["game-agent", "level", "generation"]);
  assert.equal(calls[0]?.key, "0195ad4b-3c84-7d5e-a016-4ad82e287c67");
});
