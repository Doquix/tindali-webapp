// Retrieval for the assistant. Store records are turned into short text
// documents on the device, ranked with BM25, and only the best matches are
// sent to the server with the question.

import type { Product, Sale } from "./db";
import { formatPeso } from "./money";
import { DAY_MS, WEEKDAYS, marginPercent, productMovement, salesBetween, startOfDay, stockLevel, summarize } from "./stats";

export interface RagDoc {
  id: string;
  title: string;
  text: string;
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "is", "are", "was", "my", "me", "i", "it", "do", "does",
  "what", "which", "how", "much", "many", "should", "can", "this", "that", "with", "at", "by", "be",
  "ang", "ng", "sa", "na", "ko", "ba", "ano", "mga", "si", "ni", "kay", "po", "yung", "magkano",
]);

// Taglish words owners use, mapped to the English words in the documents.
const SYNONYMS: Record<string, string[]> = {
  kita: ["profit"],
  tubo: ["profit"],
  benta: ["sales", "sold"],
  nabenta: ["sales", "sold"],
  tinda: ["sales", "sold"],
  ubos: ["out", "stock"],
  paubos: ["low", "stock"],
  bili: ["restock", "buy"],
  bibilhin: ["restock", "buy"],
  restock: ["low", "out", "reorder"],
  left: ["stock"],
  natira: ["stock"],
  inumin: ["drinks"],
  softdrinks: ["drinks"],
  sitsirya: ["snacks"],
  chichirya: ["snacks"],
  pancit: ["noodles"],
  ngayon: ["today"],
  kahapon: ["yesterday"],
  linggo: ["week"],
  buwan: ["month"],
  best: ["top", "sold"],
  seller: ["sold"],
  earn: ["profit"],
  earned: ["profit"],
};

export function tokenize(text: string): string[] {
  const words = text.toLowerCase().normalize("NFKD").replace(/[^a-z0-9.]+/g, " ").split(" ");
  const tokens: string[] = [];
  for (const raw of words) {
    const w = raw.replace(/^\.+|\.+$/g, "");
    if (w.length < 2 || STOPWORDS.has(w)) continue;
    tokens.push(w);
    const extra = SYNONYMS[w];
    if (extra) tokens.push(...extra);
  }
  return tokens;
}

/** Ranks documents against a query with Okapi BM25 and returns the top k with a positive score. */
export function search(docs: RagDoc[], query: string, k = 8): RagDoc[] {
  const queryTerms = [...new Set(tokenize(query))];
  if (queryTerms.length === 0 || docs.length === 0) return [];

  const k1 = 1.2;
  const b = 0.75;
  // Title words count twice so a product's own record beats a passing mention.
  const docTokens = docs.map((d) => tokenize(`${d.title} ${d.title} ${d.text}`));
  const avgLen = docTokens.reduce((sum, t) => sum + t.length, 0) / docs.length;
  const docFreq = new Map<string, number>();
  for (const tokens of docTokens) {
    for (const term of new Set(tokens)) docFreq.set(term, (docFreq.get(term) ?? 0) + 1);
  }

  const scored = docs.map((doc, i) => {
    const tokens = docTokens[i];
    const counts = new Map<string, number>();
    for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
    let score = 0;
    for (const term of queryTerms) {
      const tf = counts.get(term) ?? 0;
      if (tf === 0) continue;
      const df = docFreq.get(term) ?? 0;
      const idf = Math.log(1 + (docs.length - df + 0.5) / (df + 0.5));
      score += idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * tokens.length) / avgLen)));
    }
    return { doc, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((s) => s.doc);
}

function describeSummary(label: string, sales: Sale[]): string {
  const s = summarize(sales);
  return `${label}: sales ${formatPeso(s.revenue)}, cost ${formatPeso(s.cost)}, profit ${formatPeso(s.profit)}, ${s.itemsSold} items in ${s.saleCount} transactions.`;
}

function dateLabel(t: number): string {
  return new Date(t).toLocaleDateString("en-CA"); // YYYY-MM-DD
}

/** Builds the store's knowledge base. The overview doc is always sent; the rest are retrieved. */
export function buildDocs(products: Product[], sales: Sale[], now = Date.now()): { overview: RagDoc; docs: RagDoc[] } {
  const today = startOfDay(now);
  const weekAgo = today - 6 * DAY_MS;
  const monthAgo = today - 29 * DAY_MS;
  const last30 = salesBetween(sales, monthAgo, today + DAY_MS);
  const last7 = salesBetween(sales, weekAgo, today + DAY_MS);
  const move30 = productMovement(last30);
  const move7 = productMovement(last7);
  const nameOf = (id: number) => products.find((p) => p.id === id)?.name ?? "Unknown";

  const low = products.filter((p) => stockLevel(p) === "low").map((p) => `${p.name} (${p.stock} left)`);
  const out = products.filter((p) => stockLevel(p) === "out").map((p) => p.name);
  const top = [...move30.entries()]
    .sort((a, b) => b[1].profit - a[1].profit)
    .slice(0, 5)
    .map(([id, m]) => `${nameOf(id)} ${formatPeso(m.profit)}`);

  const overview: RagDoc = {
    id: "overview",
    title: "Store overview",
    text: [
      `Today is ${WEEKDAYS[new Date(now).getDay()]}, ${dateLabel(now)}.`,
      describeSummary("Today", salesBetween(sales, today, today + DAY_MS)),
      describeSummary("Yesterday", salesBetween(sales, today - DAY_MS, today)),
      describeSummary("Last 7 days", last7),
      describeSummary("Last 30 days", last30),
      `Products in inventory: ${products.length}.`,
      `Low stock: ${low.join(", ") || "none"}.`,
      `Out of stock: ${out.join(", ") || "none"}.`,
      `Top profit makers, last 30 days: ${top.join("; ") || "no sales yet"}.`,
    ].join("\n"),
  };

  const docs: RagDoc[] = [];

  for (const p of products) {
    const m30 = move30.get(p.id!);
    const m7 = move7.get(p.id!);
    const level = stockLevel(p);
    let busiest = "no sales in the last 30 days";
    if (m30 && m30.unitsSold > 0) {
      const max = Math.max(...m30.byWeekday);
      busiest = `busiest day ${WEEKDAYS[m30.byWeekday.indexOf(max)]} (${max} units over 30 days)`;
    }
    const perDay = m30 ? m30.unitsSold / 30 : 0;
    const daysLeft = perDay > 0 ? Math.floor(p.stock / perDay) : null;
    docs.push({
      id: `product-${p.id}`,
      title: `Product: ${p.name}${p.size ? ` ${p.size}` : ""}`,
      text: [
        `Category ${p.category}.${p.barcode ? ` Barcode ${p.barcode}.` : ""}`,
        `Selling price ${formatPeso(p.priceCentavos)}, cost ${formatPeso(p.costCentavos)}, profit ${formatPeso(p.priceCentavos - p.costCentavos)} per unit (${marginPercent(p)}% margin).`,
        `Stock ${p.stock}, reorder at ${p.reorderAt}.${level === "low" ? " LOW STOCK, restock soon." : ""}${level === "out" ? " OUT OF STOCK." : ""}`,
        `Sold ${m7?.unitsSold ?? 0} units in the last 7 days and ${m30?.unitsSold ?? 0} in the last 30 days, profit ${formatPeso(m30?.profit ?? 0)} over 30 days; ${busiest}.`,
        daysLeft !== null ? `At the current pace, stock lasts about ${daysLeft} days.` : "",
      ].join(" "),
    });
  }

  for (let day = today; day >= monthAgo; day -= DAY_MS) {
    const daySales = salesBetween(sales, day, day + DAY_MS);
    if (daySales.length === 0) continue;
    const best = [...productMovement(daySales).entries()]
      .sort((a, b) => b[1].unitsSold - a[1].unitsSold)
      .slice(0, 3)
      .map(([id, m]) => `${nameOf(id)} x${m.unitsSold}`);
    const offset = Math.round((today - day) / DAY_MS);
    const relative = offset === 0 ? "today" : offset === 1 ? "yesterday" : `${offset} days ago`;
    docs.push({
      id: `day-${dateLabel(day)}`,
      title: `Sales on ${WEEKDAYS[new Date(day).getDay()]} ${dateLabel(day)} (${relative})`,
      text: `${describeSummary("Daily sales", daySales)} Best sellers: ${best.join(", ")}.`,
    });
  }

  return { overview, docs };
}

/** The overview plus the documents that best match the question. */
export function retrieve(products: Product[], sales: Sale[], question: string, now = Date.now(), k = 8): RagDoc[] {
  const { overview, docs } = buildDocs(products, sales, now);
  return [overview, ...search(docs, question, k)];
}
