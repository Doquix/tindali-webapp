import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db, recordSale } from "./db";
import { formatPeso, parsePeso } from "./money";
import { marginPercent, stockLevel, summarize } from "./stats";

describe("money", () => {
  it("formats centavos as pesos", () => {
    expect(formatPeso(123456)).toBe("₱1,234.56");
    expect(formatPeso(-500)).toBe("-₱5.00");
  });

  it("parses what owners type", () => {
    expect(parsePeso("20")).toBe(2000);
    expect(parsePeso("₱1,234.5")).toBe(123450);
    expect(parsePeso("0.1")).toBe(10);
    expect(parsePeso("abc")).toBeNull();
    expect(parsePeso("1.234")).toBeNull();
  });
});

describe("stats", () => {
  it("computes margin and stock level", () => {
    const p = { costCentavos: 1250, priceCentavos: 1600, stock: 3, reorderAt: 10 };
    expect(marginPercent(p)).toBe(22);
    expect(stockLevel({ ...p, name: "x", category: "Noodles", createdAt: 0 })).toBe("low");
    expect(stockLevel({ ...p, stock: 0, name: "x", category: "Noodles", createdAt: 0 })).toBe("out");
  });
});

describe("recordSale", () => {
  beforeEach(async () => {
    await db.products.clear();
    await db.sales.clear();
  });

  it("saves the sale and takes units out of stock", async () => {
    const id = (await db.products.add({ name: "Royal", category: "Drinks", costCentavos: 1500, priceCentavos: 2000, stock: 5, reorderAt: 2, createdAt: 0 })) as number;
    await recordSale([{ productId: id, name: "Royal", qty: 3, priceCentavos: 2000, costCentavos: 1500 }], "cash");
    expect((await db.products.get(id))!.stock).toBe(2);
    const s = summarize(await db.sales.toArray());
    expect(s).toEqual({ revenue: 6000, cost: 4500, profit: 1500, itemsSold: 3, saleCount: 1 });
  });

  it("never lets stock go below zero", async () => {
    const id = (await db.products.add({ name: "Nova", category: "Snacks", costCentavos: 1600, priceCentavos: 2000, stock: 1, reorderAt: 2, createdAt: 0 })) as number;
    await recordSale([{ productId: id, name: "Nova", qty: 4, priceCentavos: 2000, costCentavos: 1600 }], "gcash");
    expect((await db.products.get(id))!.stock).toBe(0);
  });
});
