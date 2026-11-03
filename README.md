# Tindali

A phone-first web app for sari-sari store owners: scan barcodes to sell, track stock and profit, and ask an AI assistant about the store.

## Run it

```bash
npm install
cp .env.example .env   # then put your Anthropic API key in .env
npm run dev
```

Open http://localhost:5173 and tap **Try a demo store** to load 18 products and 30 days of sample sales.

- `npm test`: unit tests (money, stock and the assistant's retrieval)
- `npm run build` then `npm start`: production build, served by the API server on `API_PORT` (default 8787)

## How it works

| Part | Where | Notes |
|---|---|---|
| Store data | `src/db.ts` (IndexedDB via Dexie) | Lives on the phone, so selling works offline. Money is stored in centavos. |
| Barcode scanner | `src/components/Scanner.tsx` | ZXing, retail formats only (EAN/UPC/Code 128). Loaded only on the Scan screen. |
| Unknown barcodes | `server/index.ts` `/api/barcode/:code` | Name lookup from Open Food Facts. The owner always sets the price. |
| Assistant retrieval | `src/rag.ts` | Builds a document per product and per day, ranks them with BM25 (with Taglish synonyms), and sends the store overview plus the top 8. |
| Assistant answer | `server/index.ts` `/api/ask` | Claude Opus 5.5 at low effort, with server-side refusal fallbacks on. The API key stays on the server. |

## Protecting the AI

`/api/ask` spends your Anthropic credit, so it is guarded:

- **Access code.** Every request needs an `X-Access-Code` header matching one of `ACCESS_CODES` in `.env` (comma-separated, one per store). The app asks for it once on the Ask AI screen. With no codes set, the assistant is off.
- **Rate limit.** 20 questions per hour per IP, wrong codes included. Behind a host's proxy, set `TRUST_PROXY=1`.
- **Spend limit.** Before deploying, set a monthly spend limit for the API key in the [Anthropic Console](https://console.anthropic.com/) (Settings, Limits). This caps the cost even if a code leaks.
- **Key stays on the server.** CI fails if a key or its variable name shows up in the built app.

## Using the camera on a phone

Browsers only allow the camera on `https://` or `localhost`. To test on a phone over Wi-Fi, serve the app over HTTPS (for example with a tunnel such as `cloudflared tunnel --url http://localhost:5173`), or type barcodes in the box under the camera.

## Not built yet

Utang (customer credit), user accounts and cloud sync/backup. Data currently lives only in the phone's browser storage, so clearing site data erases it.

## Roadmap and how we work

- [docs/MVP.md](docs/MVP.md): what v0.1.0 includes, the acceptance criteria for each feature, and the release test with real owners.
- [CHANGELOG.md](CHANGELOG.md): user-visible changes, newest first.
- One issue, one branch, one pull request into `main`. CI (typecheck, tests, build) must pass before merging.
