import express from "express";
import { z } from "zod";
import { createFailureTracker, InfraiError } from "./failure_tracker.js";
import { recordAgentFailure } from "./game_agent_loop.js";

const playerAsset = z.object({
  kind: z.literal("player_asset"),
  assetId: z.string().min(1),
  assetKind: z.enum(["avatar", "skin", "level"]),
  prompt: z.string().min(1).max(2_000),
});

const liveEvent = z.object({
  kind: z.literal("live_event"),
  eventId: z.string().min(1),
  eventName: z.string().min(1),
});

const moderationJob = z.object({
  kind: z.literal("moderation_job"),
  queueItemId: z.string().min(1),
  assetId: z.string().min(1),
});

const failureBody = z.object({
  runId: z.string().uuid(),
  reason: z.string().min(1).max(4_000),
  work: z.discriminatedUnion("kind", [playerAsset, liveEvent, moderationJob]),
});

export function createGameFailureService() {
  const app = express();
  const tracker = createFailureTracker();
  app.use(express.json({ limit: "32kb" }));

  app.post("/agent-failures", async (request, response) => {
    const parsed = failureBody.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ ok: false, error: "Invalid failure report", issues: parsed.error.issues });
      return;
    }

    try {
      const decision = await recordAgentFailure(tracker, parsed.data);
      response.status(202).json({ ok: true, decision });
    } catch (error) {
      if (error instanceof InfraiError && error.status >= 400 && error.status < 500) {
        response.status(error.status).json({ ok: false, error: error.code, detail: error.detail });
        return;
      }
      response.status(502).json({ ok: false, error: "Failure capture was not accepted" });
    }
  });

  return app;
}

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 3000);
  createGameFailureService().listen(port, () => {
    console.log(`Game failure service listening on http://localhost:${port}`);
  });
}
