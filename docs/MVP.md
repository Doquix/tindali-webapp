# Tindali MVP (v0.1.0)

The first version real store owners use every day. Tracked in the GitHub milestone **MVP v0.1.0**.

## Who and what

- **User:** the owner (or one helper) of a sari-sari store, on a cheap Android phone, often outdoors, often with a customer waiting.
- **Job:** record every sale, know what to restock and what you earned today, and keep the utang notebook in the app.
- **Pilot:** 3 stores, on the staging site first, then production.

## Release test

The MVP ships when 3 real owners, unaided, on their own phones, each do all three of these in **under 10 seconds with no wrong taps**:

1. Sell a scanned item.
2. Sell an item with no barcode (tingi).
3. Sell on utang to a suki.

Plus: all text meets WCAG AA contrast, CI is green, and nothing in "Must have" is open.

## Must have

Each item is one GitHub issue. It is done when every acceptance criterion holds and its PR is merged with CI green.

### Done already
- Scan to sell, cart, cash/GCash checkout, change due
- Inventory with stock, reorder level, low/out badges, no-barcode items
- Today's profit, reports by day and product
- Demo store

### 1. Protect the AI endpoint (blocker)
- `/api/ask` rejects requests without a valid store access code (401).
- More than 20 questions per hour from one IP returns 429 with a plain message.
- A monthly spend limit is set in the Anthropic Console and written in the deploy notes.
- The API key never reaches the browser (check the built JS).

### 2. Backup and restore (blocker)
- On first launch the app asks the browser to keep data (`navigator.storage.persist()`).
- "Export backup" saves one JSON file with products, sales and customers.
- "Import backup" on an empty or existing store restores it; a test round-trips the demo store with identical totals.
- Home shows "Last backup: N days ago" and turns amber after 7 days.

### 3. Deploy staging and production (blocker)
- Staging deploys from `main` automatically; production deploys from a `v*` tag.
- Both run over HTTPS; the camera works on an Android phone.
- `ANTHROPIC_API_KEY` and access codes are set as host secrets, not in the repo.

### 4. Utang ledger (#5)
- Checkout has an "Utang" payment option that picks or adds a customer.
- The Utang screen lists who owes what, newest first, with days since last payment; over 30 days shows red.
- "Record payment" reduces the balance; a balance never goes below zero.
- Today's profit counts an utang sale when it is made; "Utang collected" is shown separately.

### 5. Sales history and void (#2)
- Today's sales list shows time, items, total and payment.
- Voiding a sale puts the stock back and removes it from reports and profit.
- A voided utang sale also removes the debt.
- Tests cover stock and totals after a void.

### 6. Real-phone scanning and installable app (#3)
- 10 real products scanned on an Android phone over HTTPS; median point-to-sheet time under 1 second.
- The app installs to the home screen and opens offline to the last screen.

### 7. AI assistant checked with real questions (#1)
- 10 owner questions in English, Tagalog and Taglish answered against the demo store.
- Every peso amount matches the Reports screen. Any mismatch is a bug before launch.
- If this cannot be met in time, the Ask AI tab is hidden for v0.1.0 (it is not in the release test).

### 8. Privacy notice
- One screen in plain language: what is stored, where (on the phone; in the backup file the owner saves), that customer names in utang are the owner's records, and how to delete everything.
- Linked from Home and shown once on first launch.

### 9. End-to-end test in CI
- One browser test: load the demo store, sell a no-barcode item, check stock went down and today's profit went up.

## Out of scope for v0.1.0

Accounts and cloud sync (#4), more than one phone per store, breaking packs into pieces with automatic stock, supplier receipts, a Tagalog-only interface, payments integration.

## How we work

- One issue, one branch (`feat/5-utang`, `fix/...`, `chore/...`), one pull request into `main`.
- CI runs typecheck, tests and build on every PR; it must be green to merge.
- `main` is always deployable and deploys to staging. Releases are tags (`v0.1.0`) and deploy to production.
- Every user-visible change adds a line to `CHANGELOG.md` under "Unreleased".
- Owner feedback from the pilot becomes an issue, labelled and placed in a milestone.
