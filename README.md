# skim402-web

Source for [skim402.com](https://skim402.com), the website, documentation,
Playground, and Workbench for **Skim—the complete web toolkit for AI agents**.

Skim turns public pages into clean, agent-ready Markdown that is typically
~4x smaller than raw HTML in measured comparisons. Beyond single-page reads,
Skim supports batch reads, JavaScript/browser rendering, structured extraction,
site crawling, PDFs, page-change watches, and curated Signals.

- [Playground](https://skim402.com/playground) — try a clean read quickly.
- [Workbench](https://skim402.com/workbench) — test batches, extraction, crawl, PDFs, watches, and Signals.
- [Pricing](https://skim402.com/pricing) — card-plan API keys are the primary setup path.
- [Documentation](https://skim402.com/docs) — API, MCP, and optional x402 wallet setup.

A card API key (`sk402_`) is the recommended default. Wallet/x402 payment remains
available as an optional pay-per-call path.

## Hosted MCP (OpenAI / ChatGPT)

Public Streamable HTTP endpoint on this site’s API host:

- **https://skim402.com/mcp** (preferred for the OpenAI plugin form)
- `https://skim402.com/api/mcp` (same handler)

`initialize` and `tools/list` work **without** an API key so OpenAI Scan Tools can
discover tools. Actual `read_url` / `read_urls` / `extract_url` / `crawl_url` /
`read_pdf` / `watch_urls` / `check_watch` / `poll_signal` calls require a card
key. Do **not** set `SKIM_WALLET_PRIVATE_KEY` on the hosted server — it is never
read or stored.

**OpenAI form — API key header (after Scan Tools):**

```
Authorization: Bearer sk402_YOUR_KEY
```

or

```
x-api-key: sk402_YOUR_KEY
```

**Verify initialize + tools/list over HTTPS after deploy:**

```bash
curl -sS -X POST https://skim402.com/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"openai-scan","version":"0"}}}'

curl -sS -X POST https://skim402.com/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
```

Locally: `npm test` (includes the MCP handler) and `npm run serve`, then POST the
same JSON to `http://localhost:5173/mcp`.

Domain verification: `GET /.well-known/openai-apps-challenge` returns
plain text — `OPENAI_APPS_CHALLENGE` if that env var is set, otherwise the
committed public token. No secret is required after republish.
