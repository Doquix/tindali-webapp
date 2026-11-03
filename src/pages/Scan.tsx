import { useLiveQuery } from "dexie-react-hooks";
import { lazy, Suspense, useCallback, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../cart";
import { Icon } from "../components/Icon";
import { db, findByBarcode, type Product } from "../db";
import { formatPeso } from "../money";
import { StockBadge } from "./Inventory";

// The barcode decoder is large; load it only when the scan screen opens.
const Scanner = lazy(() => import("../components/Scanner"));

type Found ={ kind: "product"; product: Product } | { kind: "unknown"; barcode: string };

export default function Scan() {
  const cart = useCart();
  const [found, setFound] = useState<Found | null>(null);
  const [qty, setQty] = useState(1);
  const [manual, setManual] = useState("");
  const noBarcode = useLiveQuery(() => db.products.filter((p) => !p.barcode).toArray(), []);

  const show = useCallback(async (barcode: string) => {
    const product = await findByBarcode(barcode);
    setQty(1);
    setFound(product ? { kind: "product", product } : { kind: "unknown", barcode });
  }, []);

  function submitManual(e: FormEvent) {
    e.preventDefault();
    const code = manual.trim();
    if (!code) return;
    setManual("");
    void show(code);
  }

  function addToSale() {
    if (found?.kind !== "product") return;
    cart.add(found.product, qty);
    setFound(null);
  }

  return (
    <div className="page">
      {cart.count > 0 && (
        <Link to="/checkout" className="cart-pill">
          <span className="meta"><span>{cart.count} item{cart.count === 1 ? "" : "s"}</span><span>{formatPeso(cart.totalCentavos)}</span></span>
          <span>Checkout</span>
        </Link>
      )}

      <Suspense fallback={<div className="scanner"><div className="scanner-msg">Starting camera…</div></div>}>
        <Scanner paused={found !== null} onDetected={show} />
      </Suspense>

      <form onSubmit={submitManual} style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input className="input" inputMode="numeric" placeholder="Type barcode" value={manual} onChange={(e) => setManual(e.target.value)} aria-label="Barcode" />
        <button className="btn" type="submit">Find</button>
      </form>

      {noBarcode && noBarcode.length > 0 && (
        <>
          <h2>No barcode? Tap to add</h2>
          <div className="chips" style={{ flexWrap: "wrap" }}>
            {noBarcode.map((p) => (
              <button key={p.id} className="chip" onClick={() => { setQty(1); setFound({ kind: "product", product: p }); }}>
                <span className="meta"><span>{p.name}</span><span>{formatPeso(p.priceCentavos)}</span></span>
              </button>
            ))}
          </div>
        </>
      )}

      {found && (
        <>
          <div className="sheet-backdrop" onClick={() => setFound(null)} />
          <div className="sheet" role="dialog" aria-modal="true" aria-label={found.kind === "product" ? found.product.name : "Unknown barcode"}>
            <div className="sheet-handle" />
            {found.kind === "product" ? (
              <>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div className="thumb" aria-hidden>{found.product.name.slice(0, 1)}</div>
                  <div className="row-main">
                    <div className="row-title" style={{ fontSize: 18 }}>{found.product.name}</div>
                    <div className="row-sub meta"><span>{found.product.size}</span><StockBadge product={found.product} /></div>
                  </div>
                </div>
                <div className="price-big" style={{ marginTop: 12 }}>{formatPeso(found.product.priceCentavos)}</div>
                <div className="small muted meta">
                  <span>Cost {formatPeso(found.product.costCentavos)}</span>
                  <span>Profit {formatPeso(found.product.priceCentavos - found.product.costCentavos)} each</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "16px 0" }}>
                  <div className="stepper">
                    <button className="icon-btn" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Less">−</button>
                    <output aria-live="polite">{qty}</output>
                    <button className="icon-btn" onClick={() => setQty((q) => q + 1)} aria-label="More">+</button>
                  </div>
                  <strong style={{ fontSize: 20 }}>{formatPeso(found.product.priceCentavos * qty)}</strong>
                </div>
                {qty > found.product.stock && <p className="error">Only {found.product.stock} in stock. Restock in Inventory if this is wrong.</p>}
                <button className="btn btn-primary btn-block" onClick={addToSale}>Add to sale</button>
              </>
            ) : (
              <div className="empty" style={{ padding: "8px 0" }}>
                <div className="empty-art"><Icon name="search" size={56} /></div>
                <h3 style={{ margin: "4px 0" }}>Not in your store yet</h3>
                <p className="muted small">Barcode {found.barcode}</p>
                <Link to={`/inventory/new?barcode=${encodeURIComponent(found.barcode)}&from=scan`} className="btn btn-primary btn-block">Add new product</Link>
                <button className="btn btn-block" style={{ marginTop: 8 }} onClick={() => setFound(null)}>Scan again</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
