import { useEffect, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { BackupError, backupFileName, countRows, createBackup, getLastBackupAt, parseBackup, restoreBackup, setLastBackupAt, type Backup } from "../backup";
import { useCart } from "../cart";
import { Icon } from "../components/Icon";
import { DAY_MS } from "../stats";

export function lastBackupText(at: number | null, now = Date.now()): string {
  if (at === null) return "No backup yet";
  const days = Math.floor((now - at) / DAY_MS);
  if (days <= 0) return "Last backup: today";
  if (days === 1) return "Last backup: yesterday";
  return `Last backup: ${days} days ago`;
}

export const backupIsStale = (at: number | null, now = Date.now()) => at === null || now - at > 7 * DAY_MS;

const formatDate = (t: number) => new Date(t).toLocaleString("en-PH", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

export default function BackupPage() {
  const cart = useCart();
  const [lastAt, setLastAt] = useState(getLastBackupAt);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<Backup | null>(null);
  // A download the page cannot see finish: the owner confirms the file arrived before it counts as a backup.
  const [downloaded, setDownloaded] = useState<{ name: string; at: number } | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(false));
  }, []);

  function markBackedUp(at: number) {
    setLastBackupAt(at);
    setLastAt(at);
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    setDownloaded(null);
    try {
      const now = Date.now();
      const name = backupFileName(now);
      const file = new File([JSON.stringify(await createBackup(now))], name, { type: "application/json" });

      // The share sheet (Drive, Messenger, Files) reports success, so a backup is only recorded when it really went somewhere.
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "Tindali backup" });
          markBackedUp(now);
          setMessage({ text: `Backup sent: ${name}.` });
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") setMessage({ text: "Backup not saved. Tap Save backup file to try again.", error: true });
          else throw err;
        }
        return;
      }

      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setDownloaded({ name, at: now });
    } catch {
      setMessage({ text: "Could not make the backup. Please try again.", error: true });
    } finally {
      setSaving(false);
    }
  }

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setMessage(null);
    try {
      setPending(parseBackup(await file.text()));
    } catch (err) {
      setPending(null);
      setMessage({ text: err instanceof BackupError ? err.message : "Could not read that file.", error: true });
    }
  }

  async function restore() {
    if (!pending) return;
    try {
      await restoreBackup(pending);
      // Items scanned before the restore point at the old store's products and prices.
      cart.clear();
      markBackedUp(pending.exportedAt);
      setMessage({ text: `Restored ${countRows(pending, "products")} products and ${countRows(pending, "sales")} sales.` });
    } catch {
      setMessage({ text: "Restore failed. Nothing on this phone was changed.", error: true });
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <Link to="/" className="icon-btn" aria-label="Back"><Icon name="back" /></Link>
        <h1>Backup</h1>
      </div>

      <p className="muted" style={{ marginTop: 0 }}>Your store lives only on this phone. A backup file lets you get it back if the phone is lost, reset or replaced.</p>

      <section className="card" style={{ marginBottom: 16 }}>
        <p style={{ margin: "0 0 4px", fontWeight: 700, color: backupIsStale(lastAt) ? "var(--amber)" : undefined }}>{lastBackupText(lastAt)}</p>
        {lastAt !== null && <p className="small muted" style={{ margin: "0 0 12px" }}>{formatDate(lastAt)}</p>}
        <button className="btn btn-primary btn-block" onClick={save} disabled={saving} style={{ marginTop: lastAt === null ? 12 : 0 }}>
          {saving ? "Saving…" : "Save backup file"}
        </button>
      </section>

      {downloaded && (
        <section className="card card-soft" style={{ marginBottom: 16 }} aria-label="Confirm download">
          <p style={{ marginTop: 0 }}>Check your Downloads for <strong>{downloaded.name}</strong>. Is it there?</p>
          <div className="list">
            <button className="btn btn-primary btn-block" onClick={() => { markBackedUp(downloaded.at); setDownloaded(null); setMessage({ text: "Backed up. Keep a copy off this phone too, like Google Drive or a message to yourself." }); }}>Yes, I have the file</button>
            <button className="btn btn-block" onClick={() => { setDownloaded(null); setMessage({ text: "Backup not saved. Tap Save backup file to try again.", error: true }); }}>No, it didn't save</button>
          </div>
        </section>
      )}

      {message && (
        <p role="status" className={message.error ? "error" : "small"} style={{ marginTop: 0 }}>{message.text}</p>
      )}

      <h2>Restore</h2>
      {pending ? (
        <section className="card" aria-label="Confirm restore">
          <p style={{ marginTop: 0 }}>
            Backup from <strong>{formatDate(pending.exportedAt)}</strong>: {countRows(pending, "products")} products, {countRows(pending, "sales")} sales.
          </p>
          <p className="error" style={{ marginTop: 0 }}>This replaces everything on this phone, including sales made after this backup.</p>
          <div className="list">
            <button className="btn btn-danger btn-block" onClick={restore}>Replace my store</button>
            <button className="btn btn-block" onClick={() => setPending(null)}>Cancel</button>
          </div>
        </section>
      ) : (
        <label className="btn btn-block">
          Choose a backup file
          <input type="file" accept="application/json,.json" onChange={pick} className="visually-hidden" />
        </label>
      )}

      {persisted === false && (
        <p className="small muted" style={{ marginTop: 16 }}>This browser may clear the store when the phone runs low on space. Installing Tindali to the home screen helps it keep your data.</p>
      )}
    </div>
  );
}
