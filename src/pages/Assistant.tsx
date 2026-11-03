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
const CODE_KEY = "tindali.accessCode";

// Storage can throw (private mode, blocked site data); the code is only a convenience to remember.
function loadCode(): string {
  try { return localStorage.getItem(CODE_KEY) ?? ""; } catch { return ""; }
}
function saveCode(code: string) {
  try { if (code) localStorage.setItem(CODE_KEY, code); else localStorage.removeItem(CODE_KEY); } catch { /* keep it in memory only */ }
}

export default function Assistant() {
  const from = startOfDay(Date.now()) - 29 * DAY_MS;
  const products = useLiveQuery(() => db.products.toArray(), []);
  const sales = useLiveQuery(() => db.sales.where("createdAt").aboveOrEqual(from).toArray(), [from]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState(loadCode);
  const [codeInput, setCodeInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Block body: newer browsers return a Promise from scrollIntoView, which must not become the cleanup.
    void endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, busy]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy || !code || !products || !sales) return;
    const records = retrieve(products, sales, q);
    const history = turns.filter((t) => !t.error).slice(-HISTORY_TURNS).map(({ role, text }) => ({ role, text }));
    setTurns((t) => [...t, { role: "user", text: q }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Access-Code": code },
        body: JSON.stringify({ question: q, history, records }),
      });
      const data = (await res.json().catch(() => ({}))) as { answer?: string; error?: string };
      if (res.status === 401) {
        saveCode("");
        setCode("");
      }
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

  function submitCode(e: FormEvent) {
    e.preventDefault();
    const c = codeInput.trim();
    if (!c) return;
    saveCode(c);
    setCode(c);
    setCodeInput("");
  }

  const empty = products && products.length === 0;

  return (
    <div className="page page-chat">
      <div className="page-header"><h1 className="with-icon"><Icon name="sparkle" />Tanong kay Tindali</h1></div>

      {!code && (
        <form className="card" style={{ marginBottom: 16 }} onSubmit={submitCode}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label htmlFor="access-code">Store access code</label>
            <input id="access-code" className="input" value={codeInput} onChange={(e) => setCodeInput(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={200} />
            <span className="small muted">The person who set up Tindali for your store gives you this. You only enter it once on this phone.</span>
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={!codeInput.trim()}>Save code</button>
        </form>
      )}

      {turns.length === 0 && (
        <div className="card card-soft" style={{ marginBottom: 16 }}>
          <p style={{ marginTop: 0 }}>Ask about your store in English or Tagalog. I answer from your own sales and stock.</p>
          {empty && <p className="small muted">Add products or load the demo store on Home first.</p>}
          <div className="chips" style={{ flexWrap: "wrap", marginBottom: 0 }}>
            {SUGGESTIONS.map((s) => (
              <button key={s} className="chip" onClick={() => ask(s)} disabled={busy || empty || !code}>{s}</button>
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
        <button className="btn btn-primary" type="submit" disabled={busy || !code || !input.trim()}>Ask</button>
      </form>
    </div>
  );
}
