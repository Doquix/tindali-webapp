import { db, type Category, type Product, type Sale } from "./db";
import { DAY_MS, startOfDay } from "./stats";

// Demo store so a new owner can try every screen. Barcodes are sample values.
// name, size, category, cost, price (centavos), stock, reorderAt, barcode
const DEMO: Array<[string, string, Category, number, number, number, number, string]> = [
  ["Coke", "1.5L", "Drinks", 6200, 7500, 5, 6, "4801981116010"],
  ["Royal", "290ml", "Drinks", 1500, 2000, 24, 12, "4801981118014"],
  ["Nature's Spring", "500ml", "Drinks", 1000, 1500, 30, 10, "4800049720114"],
  ["Kopiko Brown", "sachet", "Tingi", 750, 1000, 60, 20, "8996001600221"],
  ["Nescafé 3in1", "sachet", "Tingi", 700, 1000, 48, 20, "4800361380126"],
  ["Lucky Me Pancit Canton", "60g", "Noodles", 1250, 1600, 36, 12, "4807770270017"],
  ["Lucky Me Beef Mami", "55g", "Noodles", 1050, 1400, 3, 10, "4807770271014"],
  ["Payless Xtra Big", "130g", "Noodles", 1500, 1900, 18, 8, "4800016644504"],
  ["Century Tuna Flakes", "155g", "Canned", 3300, 4000, 12, 6, "748485100029"],
  ["Argentina Corned Beef", "150g", "Canned", 3600, 4300, 8, 6, "748485200019"],
  ["555 Sardines", "155g", "Canned", 2000, 2500, 0, 6, "4800249101018"],
  ["Piattos", "40g", "Snacks", 1600, 2000, 20, 8, "4800016555602"],
  ["Nova", "40g", "Snacks", 1600, 2000, 15, 8, "4800016555909"],
  ["Skyflakes", "25g", "Snacks", 650, 900, 40, 15, "4800092110115"],
  ["Safeguard Bar", "60g", "Personal care", 2600, 3200, 10, 5, "4800888141101"],
  ["Palmolive Shampoo", "sachet", "Tingi", 550, 800, 70, 25, "8850006330013"],
  ["Surf Powder", "65g", "Household", 900, 1200, 25, 10, "4800888600011"],
  ["Ice (per bag)", "", "Tingi", 200, 500, 40, 10, ""],
];

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Builds the demo products and 30 days of sales. Pure, so it can be tested without IndexedDB. */
export function buildDemoData(now = Date.now()): { products: Product[]; sales: Sale[] } {
  const rand = mulberry32(42);
  const products: Product[] = DEMO.map(([name, size, category, cost, price, stock, reorderAt, barcode], i) => ({
    id: i + 1,
    name,
    size: size || undefined,
    category,
    costCentavos: cost,
    priceCentavos: price,
    stock,
    reorderAt,
    barcode: barcode || undefined,
    createdAt: now - 40 * DAY_MS,
  }));

  const sales: Sale[] = [];
  const today = startOfDay(now);
  for (let d = 29; d >= 0; d--) {
    const day = today - d * DAY_MS;
    const weekday = new Date(day).getDay();
    const weekend = weekday === 0 || weekday === 6;
    // Today only has sales up to the current hour.
    const lastHour = d === 0 ? Math.max(7, new Date(now).getHours()) : 21;
    const count = Math.floor((weekend ? 30 : 22) * ((lastHour - 6) / 15) + rand() * 8);
    for (let n = 0; n < count; n++) {
      const lines = 1 + Math.floor(rand() * 3);
      const items = [];
      for (let l = 0; l < lines; l++) {
        let p = products[Math.floor(rand() * products.length)];
        // Coke sells much more on Fridays.
        if (weekday === 5 && rand() < 0.25) p = products[0];
        items.push({ productId: p.id!, name: p.name, qty: 1 + Math.floor(rand() * 2), priceCentavos: p.priceCentavos, costCentavos: p.costCentavos });
      }
      const hour = 7 + Math.floor(rand() * (lastHour - 6));
      const createdAt = Math.min(now - 60_000, day + hour * 3_600_000 + Math.floor(rand() * 3_600_000));
      sales.push({
        createdAt,
        items,
        payment: rand() < 0.2 ? "gcash" : "cash",
        totalCentavos: items.reduce((s, i) => s + i.priceCentavos * i.qty, 0),
        costCentavos: items.reduce((s, i) => s + i.costCentavos * i.qty, 0),
      });
    }
  }
  return { products, sales };
}

export async function loadDemoData(now = Date.now()): Promise<void> {
  const { products, sales } = buildDemoData(now);
  await db.transaction("rw", db.products, db.sales, async () => {
    await db.products.clear();
    await db.sales.clear();
    await db.products.bulkAdd(products);
    await db.sales.bulkAdd(sales);
  });
}
