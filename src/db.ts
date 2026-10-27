import Dexie, { type EntityTable } from "dexie";

export const CATEGORIES = ["Drinks", "Snacks", "Canned", "Noodles", "Household", "Personal care", "Tingi", "Other"] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Product {
  id?: number;
  barcode?: string;
  name: string;
  size?: string;
  category: Category;
  costCentavos: number;
  priceCentavos: number;
  stock: number;
  reorderAt: number;
  createdAt: number;
}

export interface SaleItem {
  productId: number;
  name: string;
  qty: number;
  priceCentavos: number;
  costCentavos: number;
}

export type Payment = "cash" | "gcash";

export interface Sale {
  id?: number;
  createdAt: number;
  items: SaleItem[];
  payment: Payment;
  totalCentavos: number;
  costCentavos: number;
}

export const db = new Dexie("tindali") as Dexie & {
  products: EntityTable<Product, "id">;
  sales: EntityTable<Sale, "id">;
};

db.version(1).stores({
  products: "++id, &barcode, name, category, stock",
  sales: "++id, createdAt",
});

export async function findByBarcode(barcode: string): Promise<Product | undefined> {
  return db.products.where("barcode").equals(barcode).first();
}

/** Records a sale and takes the sold units out of stock in one transaction. */
export async function recordSale(items: SaleItem[], payment: Payment, now = Date.now()): Promise<number> {
  return db.transaction("rw", db.products, db.sales, async () => {
    for (const item of items) {
      const product = await db.products.get(item.productId);
      if (product) await db.products.update(item.productId, { stock: Math.max(0, product.stock - item.qty) });
    }
    const id = await db.sales.add({
      createdAt: now,
      items,
      payment,
      totalCentavos: items.reduce((sum, i) => sum + i.priceCentavos * i.qty, 0),
      costCentavos: items.reduce((sum, i) => sum + i.costCentavos * i.qty, 0),
    });
    return id as number;
  });
}
