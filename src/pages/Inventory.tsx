import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import { CATEGORIES, db, type Product } from "../db";
import { formatPeso } from "../money";
import { marginPercent, stockLevel } from "../stats";

const FILTERS = ["All", "Low stock", "Out of stock", ...CATEGORIES] as const;
type Filter = (typeof FILTERS)[number];

export function StockBadge({ product }: { product: Product }) {
  const level = stockLevel(product);
  if (level === "out") return <span className="badge badge-out">Out of stock</span>;
  if (level === "low") return <span className="badge badge-low">{product.stock} left</span>;
  return <span className="badge badge-ok">{product.stock} in stock</span>;
}

export function ProductRow({ product }: { product: Product }) {
  return (
    <Link to={`/inventory/${product.id}`} className="row">
      <div className="thumb" aria-hidden>{product.name.slice(0, 1)}</div>
      <div className="row-main">
        <div className="row-title">{product.name}{product.size ? ` ${product.size}` : ""}</div>
        <div className="row-sub meta"><StockBadge product={product} /><span>{marginPercent(product)}% margin</span></div>
      </div>
      <div className="row-end">{formatPeso(product.priceCentavos)}</div>
    </Link>
  );
}

function matches(p: Product, filter: Filter, query: string): boolean {
  if (filter === "Low stock" && stockLevel(p) !== "low") return false;
  if (filter === "Out of stock" && stockLevel(p) !== "out") return false;
  if (filter !== "All" && filter !== "Low stock" && filter !== "Out of stock" && p.category !== filter) return false;
  if (!query) return true;
  const q = query.toLowerCase();
  return p.name.toLowerCase().includes(q) || (p.barcode ?? "").includes(q);
}

export default function Inventory() {
  const products = useLiveQuery(() => db.products.orderBy("name").toArray(), []);
  const [filter, setFilter] = useState<Filter>("All");
  const [query, setQuery] = useState("");

  const shown = (products ?? []).filter((p) => matches(p, filter, query.trim()));

  return (
    <div className="page">
      <div className="page-header">
        <h1>Inventory</h1>
        <Link to="/inventory/new" className="btn btn-primary">+ Add</Link>
      </div>
      <input className="input" type="search" placeholder="Search name or barcode" value={query} onChange={(e) => setQuery(e.target.value)} style={{ marginBottom: 12 }} />
      <div className="chips" role="group" aria-label="Filter">
        {FILTERS.map((f) => (
          <button key={f} className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>
      {products && shown.length === 0 ? (
        <div className="empty">
          <div className="empty-art"><Icon name="box" size={56} /></div>
          <p className="muted">{products.length === 0 ? "No products yet. Add one or scan a barcode." : "Nothing matches this filter."}</p>
        </div>
      ) : (
        <div className="list">
          {shown.map((p) => <ProductRow key={p.id} product={p} />)}
        </div>
      )}
    </div>
  );
}
