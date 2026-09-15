# Wire Desk

A static GitHub Pages site that drafts a ready-to-post Threads thread from a
headline (plus optional source URL / known facts), using OpenRouter
(GLM 5.3 Flash).

Personal tool for one user. No auth on the page itself — anyone with the
URL can load it, but the only thing that matters is protected: your
OpenRouter key never leaves your browser except straight to OpenRouter.

## Setup

1. Get an OpenRouter API key: https://openrouter.ai/keys
2. Open this site, click the gear icon (⚙) in the masthead, paste the key.
   It's stored only in this browser's `localStorage`, under
   `wireDesk.openrouterKey`. Use "Forget key" to clear it.
3. Paste a headline, optionally a source URL and known facts, click
   "Generate thread".

## Architecture

Plain static HTML/JS, no build step, no server of ours. The browser calls
OpenRouter's `chat/completions` endpoint directly.

```
GitHub Pages (static) ──fetch()──> OpenRouter API (GLM 5.3 Flash + web plugin)
```

### CORS finding (checked, not assumed)

Verified live: a real `fetch()` call to
`https://openrouter.ai/api/v1/chat/completions` from a page served over
plain HTTP on a local static-server origin, with a real API key, succeeded
— `response.type` was `"cors"`, status 200. OpenRouter's completions
endpoint sends CORS headers permitting direct browser calls. **No
server-side proxy was needed or built.** If OpenRouter ever changes this,
the fix is a small proxy endpoint that forwards the request server-side —
not a page rewrite.

### Model, pricing, and behavior notes

- Model slug `z-ai/glm-5.3-flash` is live on OpenRouter.
- Pricing: $0.075 / 1M prompt tokens, $0.25 / 1M completion tokens (from
  OpenRouter's public `/api/v1/models`). Re-check before assuming these
  numbers still hold — slugs and prices change.
- This model has **mandatory reasoning** (`default_effort: "max"` per
  OpenRouter) — every call spends reasoning tokens whether requested or
  not. `app.js` pins `reasoning: { effort: "low" }` on every request to
  keep cost/latency down; it can't be disabled entirely for this model.
- `response_format: { type: "json_object" }` is honored by this model via
  OpenRouter (verified live: returned exactly the requested
  `{"posts": [...]}` shape). The prompt asks for that object shape
  directly, not a bare array.
- The `web` plugin (`plugins: [{ id: "web", max_results: 5 }]`) is
  confirmed accepted; it runs on Exa search under the hood for
  non-natively-search-capable models like GLM. Cost is roughly
  $0.007/request via Exa for up to 10 results (we request 5, so it stays
  in that base cost).

## Research approach

The `web` plugin is "search once, inject results into context before the
model answers" — not agentic multi-round tool-calling. Good enough to
catch wholesale invention, less targeted than a model explicitly deciding
to search and then fetch a specific URL across multiple rounds.

## History

Stored in this browser's `localStorage` only (`wireDesk.history`, capped
at 200 entries) — **it does not sync across devices or browsers.**

## Security

- The OpenRouter key lives only in `localStorage`, entered via a
  password-masked field with a show/hide toggle and a "Forget key" button.
- Never hardcoded anywhere in this repo, never sent anywhere but
  `openrouter.ai`, never logged to the console.
- Public repo (GitHub Pages free-tier requirement) — nothing secret lives
  in any tracked file by design; keep it that way rather than adding a
  `config.js`-style convenience file.

## Development

No build step, no dependencies. Serve locally with
`python3 -m http.server 8000` then open `http://localhost:8000/`.
