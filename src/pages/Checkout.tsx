import { useState } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../cart";
import { recordSale, type Payment } from "../db";
import { formatPeso, parsePeso } from "../money";

export default function Checkout() {
  const cart = useCart();
  const [payment, setPayment] = useState<Payment>("cash");
  const [received, setReceived] = useState("");
  const [done, setDone] = useState<{ total: number; change: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const receivedCentavos = parsePeso(received);
  const change = receivedCentavos !== null ? receivedCentavos - cart.totalCentavos : null;
  const canFinish = cart.count > 0 && !saving && (payment === "gcash" || received === "" || (change !== null && change >= 0));

  async function finish() {
    setSaving(true);
    await recordSale(cart.toSaleItems(), payment);
    setDone({ total: cart.totalCentavos, change: payment === "cash" && change !== null ? change : 0 });
    cart.clear();
    setSaving(false);
  }

  if (done) {
    return (
      <div className="page success">
        <div className="success-icon" aria-hidden>✓</div>
        <h1>Sale saved</h1>
        <p className="muted">{formatPeso(done.total)}</p>
        {done.change > 0 && <p style={{ fontSize: 24 }}>Change: <strong>{formatPeso(done.change)}</strong></p>}
        <Link to="/scan" className="btn btn-primary btn-block">Next customer</Link>
      </div>
    );
  }

  if (cart.count === 0) {
    return (
      <div className="page empty">
        <div className="empty-art" aria-hidden>🛒</div>
        <p className="muted">No items yet.</p>
        <Link to="/scan" className="btn btn-primary">Scan a product</Link>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <Link to="/scan" className="icon-btn" aria-label="Back">←</Link>
        <h1>Checkout</h1>
      </div>
      <div className="list">
        {cart.lines.map((l) => (
          <div key={l.product.id} className="row">
            <div className="row-main">
              <div className="row-title">{l.product.name}</div>
              <div className="row-sub">{formatPeso(l.product.priceCentavos)} each</div>
            </div>
            <div className="stepper">
              <button className="icon-btn" onClick={() => cart.setQty(l.product.id!, l.qty - 1)} aria-label={`One less ${l.product.name}`}>−</button>
              <output>{l.qty}</output>
              <button className="icon-btn" onClick={() => cart.setQty(l.product.id!, l.qty + 1)} aria-label={`One more ${l.product.name}`}>+</button>
            </div>
          </div>
        ))}
      </div>

      <div className="total-big">{formatPeso(cart.totalCentavos)}</div>

      <div className="segmented" role="group" aria-label="Payment">
        <button aria-pressed={payment === "cash"} onClick={() => setPayment("cash")}>Cash</button>
        <button aria-pressed={payment === "gcash"} onClick={() => setPayment("gcash")}>GCash</button>
      </div>

      {payment === "cash" && (
        <div className="field" style={{ marginTop: 16 }}>
          <label htmlFor="received">Cash received (optional)</label>
          <input id="received" className="input" inputMode="decimal" value={received} onChange={(e) => setReceived(e.target.value)} placeholder="100" />
          {change !== null && (
            <span style={{ fontSize: 22, fontWeight: 800, color: change < 0 ? "var(--red)" : "var(--green)" }}>
              {change < 0 ? `Kulang ${formatPeso(-change)}` : `Change ${formatPeso(change)}`}
            </span>
          )}
        </div>
      )}

      <button className="btn btn-primary btn-block" style={{ marginTop: 16, minHeight: 56 }} disabled={!canFinish} onClick={finish}>
        {saving ? "Saving…" : "Done"}
      </button>
    </div>
  );
}
