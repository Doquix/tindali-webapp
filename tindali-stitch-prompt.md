# Tindali: ambition brief and Google Stitch prompt

## Goal beyond the goal
Every night the owner knows if they made money today and what to buy tomorrow, with no notebook and no math.

## Types used
- **Altitude:** the app serves a business outcome (profit, no stock-outs), not just record-keeping.
- **Depth:** the UI has to fit how a real tindahan works: tingi sales, utang, a cheap phone, a customer waiting at the window.
- **Range:** cashier-speed POS design and sunlight-readable accessibility both shape the screens.
- Skipped: nothing. Range stays small; it only affects the screens.

## Altitude ladder
1. **Fast records:** scan a barcode, see the product and price, log the sale in 3 taps or less.
2. **Decisions:** the AI (RAG over the store's own sales, stock and supplier prices) says what to restock, which items lose money and who owes too much.
3. **Replace the kuwaderno:** sales, stock, utang and the daily profit all live in Tindali, and the owner trusts it more than the notebook.

## Depth: what a top retail product designer would do
- **What they'd add:** design for tingi (one cigarette, one sachet), for items with no barcode, and for utang (credit to suki). These are the core of a sari-sari store and most POS apps ignore them.
- **Raw material:** a real store's day: a photo of the utang notebook, a supplier receipt and 20 minutes watching sales at the window.
- **Methods:** one-hand thumb-zone layout, 360 px wide Android first, big tap targets (48 px+), high contrast for outdoor light, Taglish labels, offline-first states.
- **Outside judge:** 3 real owners each log a scanned sale, a no-barcode sale and an utang entry without help. Pass: each under 10 seconds with no wrong taps, and all text meets WCAG AA contrast.

## What it needs
- Google Stitch: you have it.
- Product barcode and price data (e.g. Open Food Facts plus the store's own price list): missing, needed when you build.
- A RAG backend (vector store over sales, stock and supplier data plus an LLM): missing, needed when you build. Stitch only makes the UI.

---

## Google Stitch prompt

```
Design a mobile-first web app called "Tindali" for sari-sari store owners in the Philippines. It helps them track inventory, sales and profit, scan product barcodes to identify items and prices, and ask an AI assistant about their store. Users are busy owners on low-cost Android phones, often outdoors, often serving a customer while using the app. Design for a 360px-wide screen first, one-handed use with the thumb, and large tap targets (at least 48px).

STYLE
Clean, calm and trustworthy. Green and white only, with small accents for status.
- Primary green: #1B7F4B (buttons, active nav, key numbers)
- Light green surface: #E8F5EE (cards, highlights)
- Background: #FFFFFF
- Text: #13261B, secondary text #5B6B61
- Status: amber #D97706 for low stock, red #DC2626 for out of stock or overdue utang
Font: Plus Jakarta Sans. Rounded corners (16px cards, full-pill buttons), soft shadows, generous white space, simple line icons. Peso sign (₱) on all money. Labels in simple English with familiar Taglish words where owners use them (Utang, Suki, Tingi, Benta).

BOTTOM NAVIGATION (5 items, center one raised)
Home · Inventory · [Scan] (big round green button in the center) · Utang · AI

SCREENS
1. Home / Today
   - Greeting with store name and date
   - Big card: "Kita ngayon" (today's profit) in large green numbers, with today's sales and cost below it, and a small up/down vs yesterday
   - Row of 3 small stat cards: Items sold, Low stock, Utang collected
   - "Restock soon" list: product photo, name, units left, amber/red badge
   - One AI tip card in light green, e.g. "Coke 1.5L sells out every Friday. Buy 2 more cases on Thursday."

2. Scan (DoorDash-style scanner)
   - Full-screen camera view with a rounded green scan frame and a moving scan line
   - Flashlight toggle and "Type barcode" button
   - After a scan, a bottom sheet slides up: product photo, name, size, selling price in big text, cost and profit per item in small text, stock left
   - Quantity stepper (- 1 +) and a big green "Add to sale" button
   - Running cart pill at the top: "3 items · ₱87.00 · Checkout"
   - If the barcode is unknown: a friendly sheet with "Add new product" prefilled with the barcode

3. Quick sale (no barcode items)
   - Grid of large tiles with photos for tingi items with no barcode (candy, single cigarettes, sachets, ice, load)
   - Tap to add, long-press to change quantity
   - Search bar on top

4. Checkout
   - Item list with quantities and line totals
   - Total in very large text
   - Payment choice: Cash, GCash, Utang (pick a suki)
   - For cash: amount received and change shown big
   - Green "Done" button, then a simple success state

5. Inventory
   - Search plus filter chips: All, Low stock, Out of stock, Snacks, Drinks, Household, Tingi
   - List rows: photo, name, stock count, selling price, profit margin
   - Floating "+ Add product" button
   - Product detail: photos, barcode, cost price, selling price, margin, stock history mini chart, "Restock" button

6. Utang (customer credit)
   - List of suki with name, total owed and days since last payment; red badge when overdue
   - Customer detail: list of items taken on credit with dates, "Record payment" button, total owed at the top

7. AI assistant ("Tanong kay Tindali")
   - Chat screen with suggested question chips: "What should I restock?", "Which items make the most profit?", "Who owes me the most?", "How much did I earn this week?"
   - AI answers show small cards with numbers or a mini chart, and a small "Based on your sales from Oct 1 to 27" source line under each answer
   - Text input with mic button

8. Reports
   - Toggle Day / Week / Month
   - Profit line chart in green, sales vs cost bars
   - Top 5 best sellers and top 5 highest-profit items
   - Simple white cards, no clutter

STATES TO INCLUDE
Offline banner ("Offline: saved on your phone, will sync later"), empty states with a friendly illustration of a small store, and loading skeletons.

Make every screen readable in bright sunlight: strong contrast, large numbers, no thin grey text.
```

## Tips for Stitch
- Paste the whole prompt first. Then refine one screen at a time, e.g. "Make the scan result sheet bigger and move the price above the product name."
- If Stitch drops screens, generate in two batches: screens 1 to 4, then 5 to 8, each with the STYLE block.
