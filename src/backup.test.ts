import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { BackupError, backupFileName, createBackup, parseBackup, restoreBackup } from "./backup";
import { db, recordSale } from "./db";
import { loadDemoData } from "./seed";
import { summarize } from "./stats";

const NOW = new Date(2026, 10, 3, 18, 0).getTime();

async function snapshot() {
  const products = await db.products.orderBy("id").toArray();
  const sales = await db.sales.orderBy("id").toArray();
  return { products, sales, totals: summarize(sales) };
}

describe("backup", () => {
  beforeEach(() => loadDemoData(NOW));

  it("round-trips the demo store with identical totals", async () => {
    const before = await snapshot();
    const file = JSON.stringify(await createBackup(NOW));

    // The store changes after the backup: a sale, a deleted product.
    await recordSale([{ productId: 1, name: "Coke", qty: 2, priceCentavos: 7500, costCentavos: 6200 }], "cash", NOW);
    await db.products.delete(2);

    await restoreBackup(parseBackup(file));
    const after = await snapshot();
    expect(after.totals).toEqual(before.totals);
    expect(after.products).toEqual(before.products);
    expect(after.sales).toEqual(before.sales);
    expect(before.sales.length).toBeGreaterThan(100);
  });

  it("restores into an empty store, and new sales keep working", async () => {
    const file = JSON.stringify(await createBackup(NOW));
    await db.products.clear();
    await db.sales.clear();
    await restoreBackup(parseBackup(file));
    const count = await db.sales.count();
    await recordSale([{ productId: 1, name: "Coke", qty: 1, priceCentavos: 7500, costCentavos: 6200 }], "cash", NOW);
    expect(await db.sales.count()).toBe(count + 1);
  });

  it("refuses files that are not a usable backup, leaving the store alone", async () => {
    const good = await createBackup(NOW);
    const bad = (patch: object) => JSON.stringify({ ...good, ...patch });
    expect(() => parseBackup("not json")).toThrow(BackupError);
    expect(() => parseBackup(bad({ app: "other" }))).toThrow("not a Tindali backup");
    expect(() => parseBackup(bad({ version: 99 }))).toThrow("newer Tindali");
    expect(() => parseBackup(bad({ tables: { products: [{ id: 1, name: "Coke" }] } }))).toThrow("damaged");
    expect(() => parseBackup(bad({ tables: { sales: "nope" } }))).toThrow("damaged");
    expect(await db.products.count()).toBe(good.tables.products.length);
  });

  it("ignores tables this version does not know", async () => {
    const good = await createBackup(NOW);
    const parsed = parseBackup(JSON.stringify({ ...good, tables: { ...good.tables, someday: [{ id: 1 }] } }));
    expect(Object.keys(parsed.tables).sort()).toEqual(["products", "sales"]);
  });

  it("names the file by local date", () => {
    expect(backupFileName(NOW)).toBe("tindali-backup-2026-11-03.json");
  });
});
