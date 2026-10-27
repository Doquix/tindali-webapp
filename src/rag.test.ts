import { describe, expect, it } from "vitest";
import { buildDocs, retrieve, search, tokenize } from "./rag";
import { buildDemoData } from "./seed";

const NOW = new Date(2026, 9, 27, 18, 0).getTime(); // Tuesday 27 Oct 2026, 6 PM
const { products, sales } = buildDemoData(NOW);

describe("tokenize", () => {
  it("drops stopwords and expands Taglish words", () => {
    expect(tokenize("Magkano ang kita ko ngayon?")).toEqual(["kita", "profit", "ngayon", "today"]);
  });
});

describe("search", () => {
  const { docs } = buildDocs(products, sales, NOW);

  it("finds a product by name", () => {
    expect(search(docs, "how many coke left", 1)[0].title).toBe("Product: Coke 1.5L");
  });

  it("ranks low and out of stock products for a restock question", () => {
    const titles = search(docs, "what should I restock", 4).map((d) => d.title);
    expect(titles).toEqual(expect.arrayContaining(["Product: Coke 1.5L", "Product: Lucky Me Beef Mami 55g", "Product: 555 Sardines 155g"]));
  });

  it("finds yesterday's sales from Tagalog", () => {
    expect(search(docs, "benta kahapon", 1)[0].title).toContain("(yesterday)");
  });

  it("returns nothing for an empty query", () => {
    expect(search(docs, "ang ng sa", 5)).toEqual([]);
  });
});

describe("buildDocs", () => {
  it("summarizes the store in an overview that is always sent", () => {
    const records = retrieve(products, sales, "hello");
    expect(records[0].id).toBe("overview");
    expect(records[0].text).toContain("Out of stock: 555 Sardines.");
  });

  it("picks up the Friday Coke pattern from the sales", () => {
    const coke = buildDocs(products, sales, NOW).docs.find((d) => d.title === "Product: Coke 1.5L")!;
    expect(coke.text).toContain("busiest day Friday");
  });

  it("matches overview totals to the raw sales", () => {
    const { overview } = buildDocs(products, sales, NOW);
    const start = new Date(2026, 9, 27).getTime();
    const todayProfit = sales.filter((s) => s.createdAt >= start).reduce((sum, s) => sum + s.totalCentavos - s.costCentavos, 0);
    const pesos = (todayProfit / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 });
    expect(overview.text).toContain(`Today: sales`);
    expect(overview.text).toContain(`profit ₱${pesos}`);
  });
});
