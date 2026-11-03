import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { CATEGORIES, db, findByBarcode, type Category, type Product } from "../db";
import { formatPeso, parsePeso, toPesoInput } from "../money";
import { marginPercent } from "../stats";

interface FormState {
  name: string;
  size: string;
  barcode: string;
  category: Category;
  cost: string;
  price: string;
  stock: string;
  reorderAt: string;
}

const EMPTY: FormState = { name: "", size: "", barcode: "", category: "Other", cost: "", price: "", stock: "0", reorderAt: "5" };

function fromProduct(p: Product): FormState {
  return {
    name: p.name,
    size: p.size ?? "",
    barcode: p.barcode ?? "",
    category: p.category,
    cost: toPesoInput(p.costCentavos),
    price: toPesoInput(p.priceCentavos),
    stock: String(p.stock),
    reorderAt: String(p.reorderAt),
  };
}

export default function ProductForm() {
  const { id } = useParams();
  const productId = id ? Number(id) : undefined;
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const existing = useLiveQuery(() => (productId ? db.products.get(productId) : undefined), [productId]);
  const [form, setForm] = useState<FormState>(() => ({ ...EMPTY, barcode: params.get("barcode") ?? "" }));
  const [loadedId, setLoadedId] = useState<number>();
  const [error, setError] = useState("");
  const [lookup, setLookup] = useState("");
  const [restockQty, setRestockQty] = useState("");

  if (existing && existing.id !== loadedId) {
    setLoadedId(existing.id);
    setForm(fromProduct(existing));
  }

  // New product from an unknown barcode: try Open Food Facts for the name.
  const barcodeParam = params.get("barcode");
  useEffect(() => {
    if (productId || !barcodeParam) return;
    let cancelled = false;
    setLookup("Looking up this barcode…");
    fetch(`/api/barcode/${encodeURIComponent(barcodeParam)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { name?: string; size?: string } | null) => {
        if (cancelled) return;
        if (data?.name) {
          setForm((f) => ({ ...f, name: f.name || data.name!, size: f.size || data.size || "" }));
          setLookup("Name filled in from Open Food Facts. Please check it.");
        } else {
          setLookup("Not found online. Type the name yourself.");
        }
      })
      .catch(() => !cancelled && setLookup("Offline: type the name yourself."));
    return () => {
      cancelled = true;
    };
  }, [productId, barcodeParam]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function save(e: FormEvent) {
    e.preventDefault();
    const cost = parsePeso(form.cost);
    const price = parsePeso(form.price);
    const stock = Number(form.stock);
    const reorderAt = Number(form.reorderAt);
    if (!form.name.trim()) return setError("Enter the product name.");
    if (price === null || price <= 0) return setError("Enter a selling price, like 20 or 20.50.");
    if (cost === null) return setError("Enter the cost price, like 15 or 15.75.");
    if (!Number.isInteger(stock) || stock < 0) return setError("Stock must be a whole number.");
    if (!Number.isInteger(reorderAt) || reorderAt < 0) return setError("Reorder level must be a whole number.");
    const barcode = form.barcode.trim() || undefined;
    if (barcode) {
      const other = await findByBarcode(barcode);
      if (other && other.id !== productId) return setError(`This barcode already belongs to ${other.name}.`);
    }

    const data = { name: form.name.trim(), size: form.size.trim() || undefined, barcode, category: form.category, costCentavos: cost, priceCentavos: price, stock, reorderAt };
    if (productId) await db.products.update(productId, data);
    else await db.products.add({ ...data, createdAt: Date.now() });
    navigate(params.get("from") === "scan" ? "/scan" : "/inventory");
  }

  async function restock() {
    const qty = Number(restockQty);
    if (!productId || !existing || !Number.isInteger(qty) || qty <= 0) return;
    await db.products.update(productId, { stock: existing.stock + qty });
    setRestockQty("");
  }

  async function remove() {
    if (!productId || !confirm(`Delete ${form.name}? Past sales stay in your reports.`)) return;
    await db.products.delete(productId);
    navigate("/inventory");
  }

  const cost = parsePeso(form.cost);
  const price = parsePeso(form.price);

  return (
    <div className="page">
      <div className="page-header">
        <Link to="/inventory" className="icon-btn" aria-label="Back"><Icon name="back" /></Link>
        <h1>{productId ? "Edit product" : "New product"}</h1>
      </div>

      {productId && existing && (
        <div className="card card-soft" style={{ marginBottom: 16 }}>
          <strong>Restock</strong>
          <div className="small muted">Now {existing.stock} in stock</div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input className="input" inputMode="numeric" placeholder="Units received" value={restockQty} onChange={(e) => setRestockQty(e.target.value)} aria-label="Units received" />
            <button className="btn btn-primary" type="button" onClick={restock}>Add</button>
          </div>
        </div>
      )}

      <form onSubmit={save} noValidate>
        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" className="input" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Lucky Me Pancit Canton" />
          {lookup && <span className="small muted">{lookup}</span>}
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="size">Size</label>
            <input id="size" className="input" value={form.size} onChange={(e) => set("size", e.target.value)} placeholder="60g" />
          </div>
          <div className="field">
            <label htmlFor="category">Category</label>
            <select id="category" className="input" value={form.category} onChange={(e) => set("category", e.target.value as Category)}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="barcode">Barcode (leave empty for tingi items)</label>
          <input id="barcode" className="input" inputMode="numeric" value={form.barcode} onChange={(e) => set("barcode", e.target.value)} />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="cost">Cost (₱)</label>
            <input id="cost" className="input" inputMode="decimal" value={form.cost} onChange={(e) => set("cost", e.target.value)} placeholder="12.50" />
          </div>
          <div className="field">
            <label htmlFor="price">Selling price (₱)</label>
            <input id="price" className="input" inputMode="decimal" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="16.00" />
          </div>
        </div>
        {cost !== null && price !== null && price > 0 && (
          <p className="small" style={{ marginTop: -6 }}>
            Profit per item: <strong>{formatPeso(price - cost)}</strong> ({marginPercent({ costCentavos: cost, priceCentavos: price })}%)
          </p>
        )}
        <div className="field-row">
          <div className="field">
            <label htmlFor="stock">Stock</label>
            <input id="stock" className="input" inputMode="numeric" value={form.stock} onChange={(e) => set("stock", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="reorder">Warn me at</label>
            <input id="reorder" className="input" inputMode="numeric" value={form.reorderAt} onChange={(e) => set("reorderAt", e.target.value)} />
          </div>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" type="submit">Save product</button>
        {productId && (
          <button className="btn btn-danger btn-block" type="button" onClick={remove} style={{ marginTop: 10 }}>Delete product</button>
        )}
      </form>
    </div>
  );
}
