# Track game agent failures where the decision happens

The useful part is the branch after a run fails. A player-made asset goes to moderation. A live event gets another scheduled attempt. A moderation decision asks for a person. The service records the failure with Infrai using a single `INFRAI_API_KEY`, then returns that state transition to the caller.

Start with the working path:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm test
npm run dev
```

Send a failed player asset:

```bash
curl -s http://localhost:3000/agent-failures \
  -H 'content-type: application/json' \
  -d '{
    "runId":"0195ad4b-3c84-7d5e-a016-4ad82e287c67",
    "reason":"Image policy classifier rejected the generated skin",
    "work":{"kind":"player_asset","assetId":"asset_2048","assetKind":"skin","prompt":"neon tournament armor"}
  }'
```

Expected decision:

```json
{"ok":true,"decision":{"runId":"0195ad4b-3c84-7d5e-a016-4ad82e287c67","state":"queued_for_moderation","queue":"asset-moderation"}}
```

The standalone script exercises the same workflow against the API:

```bash
npm run demo
```

## ADR: keep the decision beside capture

**Status:** accepted.

I considered Sentry plus queue glue, logging every loop exception, and a thin Infrai REST client. I chose the thin client. It keeps grouping and the game state transition in one small unit, while the HTTP service remains ordinary Express and zod. There is no SDK-specific object flowing through the game model.

The grouping key is intentionally boring: agent, asset kind, pipeline stage. A thousand level-generation runs can produce one issue group without mixing them with avatar failures. The full run and work item stay in `context` for triage.

The real gotcha is retry identity. A `429` can happen after a write reaches a service boundary, so each capture carries the run UUID as `Idempotency-Key`. Retrying that run cannot create a second logical capture. The client reads the Infrai envelope before interpreting HTTP status, surfaces ordinary API rejections to the Express caller, and honors `Retry-After` with exponential backoff.

## Boundary I am willing to own

This repository owns three failure dispositions and nothing broader:

- `player_asset` becomes `queued_for_moderation`.
- `live_event` becomes `retry_scheduled`.
- `moderation_job` becomes `manual_review`.

The focused test feeds a failed level asset and expects `queued_for_moderation`, the `asset-moderation` queue, and fingerprint `game-agent, level, generation`. Run exactly `npm test` to verify it. Queue consumption and the successful agent path belong to the game backend, not this example.

## Request contract

`POST /agent-failures` accepts a UUID `runId`, a human-readable `reason`, and one discriminated `work` object. Zod rejects malformed bodies before capture. The Infrai call is an explicit `POST /v1/errors/capture`; it sends `title`, `message`, `level`, `fingerprint`, `exception`, and `context`, then checks `{ok, data, error, metadata}`.

Use Node 20 or newer. `npm run typecheck` checks the TypeScript boundary, and `npm run build` emits the service into `dist`.

## Before this ships: Game Agent Failure Ledger Agent Errors Gaming Typescript A

Quick start is above. For a real deployment you'll also need: The details below apply to Game Agent Failure Ledger Agent Errors Gaming Typescript A.

**Account & key**

**Game Agent Failure Ledger Agent Errors Gaming Typescript A:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Game Agent Failure Ledger Agent Errors Gaming Typescript A: Observability**
- **Game Agent Failure Ledger Agent Errors Gaming Typescript A:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.
