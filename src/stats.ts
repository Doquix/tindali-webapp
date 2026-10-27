import type { Product, Sale } from "./db";

export const DAY_MS = 24 * 60 * 60 * 1000;
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export interface Summary {
  revenue: number;
  cost: number;
  profit: number;
  itemsSold: number;
  saleCount: number;
}

export function summarize(sales: Sale[]): Summary {
  let revenue = 0;
  let cost = 0;
  let itemsSold = 0;
  for (const sale of sales) {
    revenue += sale.totalCentavos;
    cost += sale.costCentavos;
    for (const item of sale.items) itemsSold += item.qty;
  }
  return { revenue, cost, profit: revenue - cost, itemsSold, saleCount: sales.length };
}

export function salesBetween(sales: Sale[], from: number, to: number): Sale[] {
  return sales.filter((s) => s.createdAt >= from && s.createdAt < to);
}

export type StockLevel = "ok" | "low" | "out";

export function stockLevel(p: Product): StockLevel {
  if (p.stock <= 0) return "out";
  if (p.stock <= p.reorderAt) return "low";
  return "ok";
}

export function marginPercent(p: Pick<Product, "costCentavos" | "priceCentavos">): number {
  if (p.priceCentavos <= 0) return 0;
  return Math.round(((p.priceCentavos - p.costCentavos) / p.priceCentavos) * 100);
}

export interface ProductMovement {
  unitsSold: number;
  revenue: number;
  profit: number;
  /** Units sold per weekday, Sunday first. */
  byWeekday: number[];
}

export function productMovement(sales: Sale[]): Map<number, ProductMovement> {
  const result = new Map<number, ProductMovement>();
  for (const sale of sales) {
    const weekday = new Date(sale.createdAt).getDay();
    for (const item of sale.items) {
      let m = result.get(item.productId);
      if (!m) {
        m = { unitsSold: 0, revenue: 0, profit: 0, byWeekday: [0, 0, 0, 0, 0, 0, 0] };
        result.set(item.productId, m);
      }
      m.unitsSold += item.qty;
      m.revenue += item.priceCentavos * item.qty;
      m.profit += (item.priceCentavos - item.costCentavos) * item.qty;
      m.byWeekday[weekday] += item.qty;
    }
  }
  return result;
}
