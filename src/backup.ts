import { db } from "./db";

// A backup is every Dexie table as plain rows, so tables added later (customers, utang) are included without changes here.
export const BACKUP_APP = "tindali";
export const BACKUP_VERSION = 1;
const LAST_BACKUP_KEY = "tindali.lastBackupAt";

export interface Backup {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: number;
  tables: Record<string, unknown[]>;
}

export class BackupError extends Error {}

export async function createBackup(now = Date.now()): Promise<Backup> {
  const tables: Record<string, unknown[]> = {};
  await db.transaction("r", db.tables, async () => {
    for (const table of db.tables) tables[table.name] = await table.toArray();
  });
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now, tables };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isId = (v: unknown) => Number.isInteger(v) && (v as number) > 0;

// Light checks on the rows the app reads, so a damaged file is refused before it replaces a working store.
const ROW_CHECKS: Record<string, (r: Record<string, unknown>) => boolean> = {
  products: (r) => isId(r.id) && typeof r.name === "string" && typeof r.category === "string" && isNum(r.costCentavos) && isNum(r.priceCentavos) && isNum(r.stock) && isNum(r.reorderAt) && isNum(r.createdAt),
  sales: (r) =>
    isId(r.id) && isNum(r.createdAt) && typeof r.payment === "string" && isNum(r.totalCentavos) && isNum(r.costCentavos) && Array.isArray(r.items) &&
    r.items.every((i) => isObj(i) && isNum(i.productId) && typeof i.name === "string" && isNum(i.qty) && isNum(i.priceCentavos) && isNum(i.costCentavos)),
};

export function parseBackup(text: string): Backup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError("This file is not a Tindali backup.");
  }
  if (!isObj(data) || data.app !== BACKUP_APP || !isObj(data.tables) || !isNum(data.exportedAt) || !isNum(data.version)) {
    throw new BackupError("This file is not a Tindali backup.");
  }
  if (data.version > BACKUP_VERSION) throw new BackupError("This backup was made by a newer Tindali. Update the app first.");

  const known = new Set(db.tables.map((t) => t.name));
  const tables: Record<string, unknown[]> = {};
  for (const [name, rows] of Object.entries(data.tables)) {
    if (!known.has(name)) continue;
    if (!Array.isArray(rows)) throw new BackupError("This backup is damaged and cannot be restored.");
    const check = ROW_CHECKS[name];
    if (check && !rows.every((r) => isObj(r) && check(r))) throw new BackupError("This backup is damaged and cannot be restored.");
    tables[name] = rows;
  }
  return { app: BACKUP_APP, version: data.version, exportedAt: data.exportedAt, tables };
}

/** Replaces everything on this phone with the backup, all or nothing. */
export async function restoreBackup(backup: Backup): Promise<void> {
  await db.transaction("rw", db.tables, async () => {
    for (const table of db.tables) {
      await table.clear();
      const rows = backup.tables[table.name];
      if (rows?.length) await table.bulkAdd(rows);
    }
  });
}

export function backupFileName(now = Date.now()): string {
  const d = new Date(now);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `tindali-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}

export function countRows(backup: Backup, table: string): number {
  return backup.tables[table]?.length ?? 0;
}

// Storage can throw (private mode, blocked site data); a missing date only means the reminder shows.
export function getLastBackupAt(): number | null {
  try {
    const v = Number(localStorage.getItem(LAST_BACKUP_KEY));
    return v > 0 ? v : null;
  } catch {
    return null;
  }
}

export function setLastBackupAt(t: number) {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, String(t));
  } catch {
    /* the reminder will keep showing */
  }
}

/** Asks the browser not to clear the store when the phone runs low on space. Safe to call on every launch. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    return (await navigator.storage.persisted()) || (await navigator.storage.persist());
  } catch {
    return false;
  }
}
