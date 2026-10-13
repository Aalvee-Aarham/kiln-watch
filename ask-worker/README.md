# Ask worker — hosted live "Ask Kiln Watch"

A Cloudflare Worker that runs the project's own agent server-side: the same tools as `kilnwatch/ask.py` (ported to
TypeScript, pinned by parity tests), the same numeric guard and the same 6-call cap, with the project's Gemini API key.
The website never depends on it: without the worker, `#/ask` keeps its saved answers and the bring-your-own-key chat.

## Decisions (Step 0 of plans/005, approved 2026-10-12)

- **Host:** Cloudflare Workers.
- **Key:** the operator creates the worker and stores the key with `wrangler secret put GEMINI_API_KEY`; it never
  enters the repo, the site build or a GitHub secret.
- **Daily cap:** 200 questions per UTC day across all visitors (`DAILY_CAP` in `wrangler.toml`), plus at most 30 per
  IP address per hour.
- **Independence:** the Pages site stays fully usable without the worker.

## How it fits together

| File | Role |
|---|---|
| `src/index.ts` | `POST /ask`: CORS for `ALLOWED_ORIGIN` only, question of 1–500 characters, per-IP and daily limits in KV, errors without internal detail |
| `src/agent.ts` | The bounded tool-use loop on the Gemini REST API (`generateContent` with function calling, `gemini-3.5-flash-lite`, key in the `x-goog-api-key` header); safety blocks reported as refusals |
| `src/tools.ts` | The seven tools, reading the public export at `DATA_ORIGIN` |
| `src/guard.ts` | The numeric guard (copy of `web/src/lib/geminiPrompt.ts`) |
| `src/spec.json` | System prompt, Gemini tool declarations, model, step cap, refusal reasons and a sample request body — **generated** from `kilnwatch/ask.py`, never edited by hand |
| `test/golden/*.json` | The Python tools' outputs on the committed fixtures — **generated** |

When `kilnwatch/ask.py` changes (a tool, the prompt, a schema), `tests/test_ask_goldens.py` fails until you run, from
the repo root:

```bash
PYTHONPATH=. python ask-worker/scripts/make_goldens.py
cd ask-worker && npm test   # parity: the TypeScript port must still match
```

## Local checks

```bash
cd ask-worker
npm ci
npx tsc --noEmit
npm test
npx wrangler deploy --dry-run --outdir dist   # bundles without contacting Cloudflare
```

For `npx wrangler dev`, copy `.dev.vars.example` to `.dev.vars` and put a key in it (gitignored).

## Deploy (operator)

1. `npx wrangler login`
2. `npx wrangler kv namespace create SPEND` and paste the printed id into `wrangler.toml` (`REPLACE_WITH_KV_NAMESPACE_ID`).
3. `npx wrangler secret put GEMINI_API_KEY`
4. `npx wrangler deploy` — note the worker URL, e.g. `https://kiln-watch-ask.<account>.workers.dev`.
5. Check it: `curl -s -X POST https://kiln-watch-ask.<account>.workers.dev/ask -H 'Content-Type: application/json' -d '{"question":"When does Dhaka burn?"}'`
6. In a later, separate change, set `VITE_ASK_ENDPOINT=https://kiln-watch-ask.<account>.workers.dev/ask` for the Pages
   build in `.github/workflows/deploy.yml` (the `npm run build` step). Until then the site does not call the worker.

## Cost

Each question makes at most 6 calls to `gemini-3.5-flash-lite`, so the daily ceiling is
`DAILY_CAP × 6` model calls (1,200 at the approved cap). Lower `DAILY_CAP` in `wrangler.toml` and redeploy to spend less.

## Turning it off

Unset `VITE_ASK_ENDPOINT` in the Pages build (the page reverts to saved answers and the bring-your-own-key chat), or
`npx wrangler delete`. Nothing else depends on the worker.
