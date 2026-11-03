import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { db } from "../db";
import { formatPeso } from "../money";
import { DAY_MS, productMovement, salesBetween, startOfDay, summarize } from "../stats";

const RANGES = { Day: 1, Week: 7, Month: 30 } as const;
type Range = keyof typeof RANGES;

export default function Reports() {
  const [range, setRange] = useState<Range>("Week");
  const days = RANGES[range];
  const today = startOfDay(Date.now());
  const from = today - (days - 1) * DAY_MS;
  const sales = useLiveQuery(() => db.sales.where("createdAt").aboveOrEqual(from).toArray(), [from]);

  if (!sales) return <div className="page" />;

  const total = summarize(sales);
  const daily = Array.from({ length: days }, (_, i) => {
    const day = from + i * DAY_MS;
    return { day, ...summarize(salesBetween(sales, day, day + DAY_MS)) };
  });
  const maxProfit = Math.max(1, ...daily.map((d) => d.profit));
  const movement = [...productMovement(sales).entries()];
  const names = new Map(sales.flatMap((s) => s.items.map((i) => [i.productId, i.name] as const)));
  const bestSellers = [...movement].sort((a, b) => b[1].unitsSold - a[1].unitsSold).slice(0, 5);
  const bestProfit = [...movement].sort((a, b) => b[1].profit - a[1].profit).slice(0, 5);

  return (
    <div className="page">
      <div className="page-header"><h1>Reports</h1></div>
      <div className="segmented" style={{ gridTemplateColumns: "repeat(3, 1fr)" }} role="group" aria-label="Range">
        {(Object.keys(RANGES) as Range[]).map((r) => (
          <button key={r} aria-pressed={range === r} onClick={() => setRange(r)}>{r}</button>
        ))}
      </div>

      <section className="card hero" style={{ marginTop: 16 }}>
        <div className="muted small">Profit</div>
        <div className="big-number">{formatPeso(total.profit)}</div>
        <div className="small meta"><span>Sales {formatPeso(total.revenue)}</span><span>Cost {formatPeso(total.cost)}</span><span>{total.itemsSold} items</span></div>
      </section>

      {days > 1 && (
        <>
          <h2>Profit per day</h2>
          <div className="card" role="img" aria-label="Bar chart of profit per day">
            <div style={{ display: "flex", alignItems: "flex-end", gap: days > 7 ? 2 : 8, height: 140 }}>
              {daily.map((d) => (
                <div key={d.day} title={`${new Date(d.day).toLocaleDateString("en-PH")}: ${formatPeso(d.profit)}`} style={{ flex: 1, height: `${Math.max(2, (d.profit / maxProfit) * 100)}%`, background: "var(--green)", borderRadius: "4px 4px 0 0" }} />
              ))}
            </div>
            {days === 7 && (
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                {daily.map((d) => (
                  <span key={d.day} className="small muted" style={{ flex: 1, textAlign: "center" }}>
                    {new Date(d.day).toLocaleDateString("en-PH", { weekday: "narrow" })}
                  </span>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <h2>Best sellers</h2>
      <div className="list">
        {bestSellers.map(([id, m]) => (
          <div key={id} className="row"><div className="row-main row-title">{names.get(id)}</div><div className="row-end">{m.unitsSold} sold</div></div>
        ))}
      </div>

      <h2>Most profit</h2>
      <div className="list">
        {bestProfit.map(([id, m]) => (
          <div key={id} className="row"><div className="row-main row-title">{names.get(id)}</div><div className="row-end">{formatPeso(m.profit)}</div></div>
        ))}
      </div>
      {movement.length === 0 && <p className="muted">No sales in this range yet.</p>}
    </div>
  );
}
