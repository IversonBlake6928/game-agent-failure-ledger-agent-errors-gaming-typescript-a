import type { FailureCapture, FailureTracker } from "./failure_tracker.js";

export type GameWork =
  | { kind: "player_asset"; assetId: string; assetKind: "avatar" | "skin" | "level"; prompt: string }
  | { kind: "live_event"; eventId: string; eventName: string }
  | { kind: "moderation_job"; queueItemId: string; assetId: string };

export type FailureDecision = {
  runId: string;
  state: "queued_for_moderation" | "retry_scheduled" | "manual_review";
  queue: "asset-moderation" | "live-event-retry" | "moderation-review";
};

function decide(work: GameWork, runId: string): FailureDecision {
  if (work.kind === "player_asset") {
    return { runId, state: "queued_for_moderation", queue: "asset-moderation" };
  }
  if (work.kind === "live_event") {
    return { runId, state: "retry_scheduled", queue: "live-event-retry" };
  }
  return { runId, state: "manual_review", queue: "moderation-review" };
}

function capturePayload(work: GameWork, runId: string, reason: string): FailureCapture {
  const identity = work.kind === "player_asset"
    ? [work.assetKind, "generation"]
    : work.kind === "live_event"
      ? [work.eventName, "live-event"]
      : ["moderation", "decision"];

  return {
    title: `Game agent failed during ${work.kind}`,
    message: reason,
    level: "error",
    fingerprint: ["game-agent", ...identity],
    exception: reason,
    context: { runId, work },
  };
}

export async function recordAgentFailure(
  tracker: FailureTracker,
  input: { runId: string; work: GameWork; reason: string },
): Promise<FailureDecision> {
  const decision = decide(input.work, input.runId);
  await tracker.capture(capturePayload(input.work, input.runId, input.reason), input.runId);
  return decision;
}
