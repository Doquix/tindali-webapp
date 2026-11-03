import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "../components/Icon";
import { db } from "../db";
import { retrieve } from "../rag";
import { DAY_MS, startOfDay } from "../stats";

interface Turn {
  role: "user" | "assistant";
  text: string;
  sources?: string[];
  error?: boolean;
}

const SUGGESTIONS = ["What should I restock?", "Which items make the most profit?", "How much did I earn this week?", "Ano ang pinakamabenta ngayong linggo?"];
const HISTORY_TURNS = 6;

export default function Assistant() {
  const from = startOfDay(Date.now()) - 29 * DAY_MS;
  const products = useLiveQuery(() => db.products.toArray(), []);
  const sales = useLiveQuery(() => db.sales.where("createdAt").aboveOrEqual(from).toArray(), [from]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Block body: newer browsers return a Promise from scrollIntoView, which must not become the cleanup.
    void endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, busy]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy || !products || !sales) return;
    const records = retrieve(products, sales, q);
    const history = turns.filter((t) => !t.error).slice(-HISTORY_TURNS).map(({ role, text }) => ({ role, text }));
    setTurns((t) => [...t, { role: "user", text: q }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, history, records }),
      });
      const data = (await res.json().catch(() => ({}))) as { answer?: string; error?: string };
      if (!res.ok || !data.answer) throw new Error(data.error ?? "The AI is not reachable right now.");
      setTurns((t) => [...t, { role: "assistant", text: data.answer!, sources: records.map((r) => r.title.replace(/^Product: /, "")) }]);
    } catch (err) {
      const message = navigator.onLine ? (err instanceof Error ? err.message : String(err)) : "You're offline. The AI needs internet.";
      setTurns((t) => [...t, { role: "assistant", text: message, error: true }]);
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void ask(input);
  }

  const empty = products && products.length === 0;

  return (
    <div className="page page-chat">
      <div className="page-header"><h1 className="with-icon"><Icon name="sparkle" />Tanong kay Tindali</h1></div>

      {turns.length === 0 && (
        <div className="card card-soft" style={{ marginBottom: 16 }}>
          <p style={{ marginTop: 0 }}>Ask about your store in English or Tagalog. I answer from your own sales and stock.</p>
          {empty && <p className="small muted">Add products or load the demo store on Home first.</p>}
          <div className="chips" style={{ flexWrap: "wrap", marginBottom: 0 }}>
            {SUGGESTIONS.map((s) => (
              <button key={s} className="chip" onClick={() => ask(s)} disabled={busy || empty}>{s}</button>
            ))}
          </div>
        </div>
      )}

      <div className="chat" aria-live="polite">
        {turns.map((t, i) => (
          <div key={i} className={`bubble ${t.role === "user" ? "bubble-user" : "bubble-ai"}`} style={t.error ? { background: "var(--red-soft)", color: "var(--red)" } : undefined}>
            {t.text}
            {t.sources && <div className="bubble-source">Based on: {t.sources.join(", ")}</div>}
          </div>
        ))}
        {busy && <div className="bubble bubble-ai muted">Checking your records…</div>}
        <div ref={endRef} />
      </div>

      <form className="composer" onSubmit={submit}>
        <input className="input" placeholder="Ask about sales, stock, profit…" value={input} onChange={(e) => setInput(e.target.value)} maxLength={1000} aria-label="Question" />
        <button className="btn btn-primary" type="submit" disabled={busy || !input.trim()}>Ask</button>
      </form>
    </div>
  );
}
