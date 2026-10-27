import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../db";
import { formatPeso } from "../money";
import { loadDemoData } from "../seed";
import { DAY_MS, salesBetween, startOfDay, stockLevel, summarize } from "../stats";
import { ProductRow } from "./Inventory";

export default function Home() {
  const today = startOfDay(Date.now());
  const products = useLiveQuery(() => db.products.toArray(), []);
  const sales = useLiveQuery(() => db.sales.where("createdAt").aboveOrEqual(today - DAY_MS).toArray(), [today]);
  const [loading, setLoading] = useState(false);

  if (!products || !sales) return <div className="page" />;

  if (products.length === 0) {
    return (
      <div className="page">
        <div className="empty">
          <div className="empty-art" aria-hidden>🏪</div>
          <h1>Welcome to Tindali</h1>
          <p className="muted">Add your products, scan to sell, and ask the AI what to restock.</p>
          <div className="list">
            <Link to="/inventory/new" className="btn btn-primary btn-block">Add my first product</Link>
            <button
              className="btn btn-block"
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                await loadDemoData();
                setLoading(false);
              }}
            >
              {loading ? "Loading…" : "Try a demo store"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const t = summarize(salesBetween(sales, today, today + DAY_MS));
  const y = summarize(salesBetween(sales, today - DAY_MS, today));
  const restock = products
    .filter((p) => stockLevel(p) !== "ok")
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 5);
  const dateText = new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="page">
      <p className="muted small" style={{ margin: 0 }}>{dateText}</p>
      <h1 style={{ margin: "2px 0 16px", fontSize: 24 }}>Magandang araw! 👋</h1>

      <section className="card hero" aria-label="Today's profit">
        <div className="muted small">Kita ngayon · Today's profit</div>
        <div className="big-number">{formatPeso(t.profit)}</div>
        <div className="small">
          Sales {formatPeso(t.revenue)} · Cost {formatPeso(t.cost)}
        </div>
        <div className="small muted" style={{ marginTop: 4 }}>
          Yesterday's full day: {formatPeso(y.profit)} profit
        </div>
      </section>

      <div className="stat-row">
        <div className="stat"><strong>{t.itemsSold}</strong><span>Items sold</span></div>
        <div className="stat"><strong>{t.saleCount}</strong><span>Sales</span></div>
        <div className="stat"><strong>{products.filter((p) => stockLevel(p) !== "ok").length}</strong><span>Low / out</span></div>
      </div>

      <h2>Restock soon</h2>
      {restock.length === 0 ? (
        <p className="muted">All stocked up.</p>
      ) : (
        <div className="list">
          {restock.map((p) => <ProductRow key={p.id} product={p} />)}
        </div>
      )}

      <Link to="/ai" className="card card-soft" style={{ display: "block", marginTop: 20, textDecoration: "none", color: "inherit" }}>
        <strong>✦ Tanong kay Tindali</strong>
        <div className="small muted">Ask what to restock, what makes the most profit, or how this week went.</div>
      </Link>
    </div>
  );
}
