import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  AntwortFeedback,
  ChatGespraech,
  Einstellungen,
  LeseFortschritt,
  LernVers,
  LesezeichenEintrag,
  StreakStatus,
  StreakTag,
} from "../../types";

interface AmibelDbSchema extends DBSchema {
  lesezeichen: { key: string; value: LesezeichenEintrag };
  chats: { key: string; value: ChatGespraech };
  lernverse: { key: string; value: LernVers };
  feedback: { key: string; value: AntwortFeedback };
  kv: { key: string; value: unknown };
}

let dbPromise: Promise<IDBPDatabase<AmibelDbSchema>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<AmibelDbSchema>("amibel", 1, {
      upgrade(db) {
        db.createObjectStore("lesezeichen", { keyPath: "id" });
        db.createObjectStore("chats", { keyPath: "id" });
        db.createObjectStore("lernverse", { keyPath: "id" });
        db.createObjectStore("feedback", { keyPath: "id" });
        db.createObjectStore("kv");
      },
    });
  }
  return dbPromise;
}

function uuid(): string {
  return crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

// ---------- Lesezeichen / Markierungen / Notizen ----------

export async function listLesezeichen(): Promise<LesezeichenEintrag[]> {
  const db = await getDb();
  return db.getAll("lesezeichen");
}

export async function saveLesezeichen(
  entry: Omit<LesezeichenEintrag, "id" | "erstellt_am" | "geaendert_am"> & { id?: string }
): Promise<LesezeichenEintrag> {
  const db = await getDb();
  const id = entry.id ?? uuid();
  const existing = entry.id ? await db.get("lesezeichen", entry.id) : undefined;
  const full: LesezeichenEintrag = {
    ...entry,
    id,
    erstellt_am: existing?.erstellt_am ?? nowIso(),
    geaendert_am: nowIso(),
  };
  await db.put("lesezeichen", full);
  return full;
}

export async function deleteLesezeichen(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("lesezeichen", id);
}

export async function exportLesezeichen(): Promise<string> {
  const items = await listLesezeichen();
  return JSON.stringify({ schema_version: 1, lesezeichen: items }, null, 2);
}

export async function importLesezeichen(json: string): Promise<number> {
  const parsed = JSON.parse(json);
  if (!parsed || !Array.isArray(parsed.lesezeichen)) {
    throw new Error("Ungueltiges Format: 'lesezeichen'-Array fehlt.");
  }
  const db = await getDb();
  const tx = db.transaction("lesezeichen", "readwrite");
  let count = 0;
  for (const item of parsed.lesezeichen) {
    if (!item.buch || !item.kapitel || !item.vers_von) continue;
    await tx.store.put({
      id: item.id ?? uuid(),
      typ: item.typ ?? "lesezeichen",
      uebersetzung: item.uebersetzung ?? "LUT1912",
      buch: item.buch,
      kapitel: item.kapitel,
      vers_von: item.vers_von,
      vers_bis: item.vers_bis ?? item.vers_von,
      farbe: item.farbe ?? "gelb",
      notiz: item.notiz,
      name: item.name,
      tags: item.tags ?? [],
      erstellt_am: item.erstellt_am ?? nowIso(),
      geaendert_am: item.geaendert_am ?? nowIso(),
    });
    count++;
  }
  await tx.done;
  return count;
}

// ---------- Chats ----------

export async function listChats(): Promise<ChatGespraech[]> {
  const db = await getDb();
  const all = await db.getAll("chats");
  return all.sort((a, b) => (a.geaendert_am < b.geaendert_am ? 1 : -1));
}

export async function getChat(id: string): Promise<ChatGespraech | undefined> {
  const db = await getDb();
  return db.get("chats", id);
}

export async function saveChat(chat: ChatGespraech): Promise<void> {
  const db = await getDb();
  await db.put("chats", { ...chat, geaendert_am: nowIso() });
}

export async function deleteChat(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("chats", id);
}

export async function createChat(modus: ChatGespraech["modus"], titel = "Neues Gespräch"): Promise<ChatGespraech> {
  const chat: ChatGespraech = {
    id: uuid(),
    titel,
    modus,
    nachrichten: [],
    erstellt_am: nowIso(),
    geaendert_am: nowIso(),
  };
  await saveChat(chat);
  return chat;
}

export async function clearAllChats(): Promise<void> {
  const db = await getDb();
  await db.clear("chats");
}

// ---------- Lernverse ----------

export async function listLernverse(): Promise<LernVers[]> {
  const db = await getDb();
  return db.getAll("lernverse");
}

export async function addLernVers(v: Omit<LernVers, "id" | "gewusstCount" | "gelernt" | "erstellt_am">): Promise<LernVers> {
  const db = await getDb();
  const entry: LernVers = { ...v, id: uuid(), gewusstCount: 0, gelernt: false, erstellt_am: nowIso() };
  await db.put("lernverse", entry);
  return entry;
}

export async function updateLernVers(id: string, patch: Partial<LernVers>): Promise<void> {
  const db = await getDb();
  const existing = await db.get("lernverse", id);
  if (!existing) return;
  const updated = { ...existing, ...patch };
  updated.gelernt = updated.gewusstCount >= 10;
  await db.put("lernverse", updated);
}

export async function removeLernVers(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("lernverse", id);
}

// ---------- Feedback ----------

export async function addFeedback(f: Omit<AntwortFeedback, "id" | "erstellt_am">): Promise<void> {
  const db = await getDb();
  await db.put("feedback", { ...f, id: uuid(), erstellt_am: nowIso() });
}

export async function listFeedback(): Promise<AntwortFeedback[]> {
  const db = await getDb();
  return db.getAll("feedback");
}

export async function clearFeedback(): Promise<void> {
  const db = await getDb();
  await db.clear("feedback");
}

// ---------- Key-Value (Einstellungen, Lesefortschritt, Streak, API-Key) ----------

export async function kvGet<T>(key: string): Promise<T | undefined> {
  const db = await getDb();
  return db.get("kv", key) as Promise<T | undefined>;
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  const db = await getDb();
  await db.put("kv", value, key);
}

const DEFAULT_SETTINGS: Einstellungen = {
  profilName: "",
  profilTelefon: "",
  darkMode: "system",
  schriftgroesse: "normal",
  zeilenabstand: "normal",
  standardUebersetzung: "LUT1912",
  versnummernAn: true,
  klarheitsstufe: "normal",
  konfessionelleVarianten: true,
  aiProvider: "aus",
  aiModell: "",
  streakAn: true,
  streakFreezeAn: true,
  tagesErinnerungAn: false,
  tagesErinnerungZeit: "19:00",
  lernErinnerungAn: false,
  lernErinnerungZeit: "08:00",
};

export async function getSettings(): Promise<Einstellungen> {
  const stored = await kvGet<Einstellungen>("einstellungen");
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function saveSettings(patch: Partial<Einstellungen>): Promise<Einstellungen> {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await kvSet("einstellungen", next);
  return next;
}

export async function getLeseFortschritt(): Promise<LeseFortschritt | undefined> {
  return kvGet<LeseFortschritt>("lesefortschritt");
}

export async function saveLeseFortschritt(p: Omit<LeseFortschritt, "aktualisiert_am">): Promise<void> {
  await kvSet("lesefortschritt", { ...p, aktualisiert_am: nowIso() });
}

// ---------- Gelesene Kapitel (Lesefortschritts-Uebersicht) ----------
// Osis-Buchcode -> Liste gelesener Kapitelnummern.
export type GeleseneKapitel = Record<string, number[]>;

export async function getGeleseneKapitel(): Promise<GeleseneKapitel> {
  return (await kvGet<GeleseneKapitel>("gelesene_kapitel")) ?? {};
}

export async function istKapitelGelesen(osis: string, kapitel: number): Promise<boolean> {
  const alle = await getGeleseneKapitel();
  return (alle[osis] ?? []).includes(kapitel);
}

export async function setKapitelGelesen(osis: string, kapitel: number, gelesen: boolean): Promise<GeleseneKapitel> {
  const alle = await getGeleseneKapitel();
  const bisherige = alle[osis] ?? [];
  const naechste = gelesen
    ? Array.from(new Set([...bisherige, kapitel])).sort((a, b) => a - b)
    : bisherige.filter((k) => k !== kapitel);
  const aktualisiert: GeleseneKapitel = { ...alle, [osis]: naechste };
  await kvSet("gelesene_kapitel", aktualisiert);
  return aktualisiert;
}

export function anzahlGeleseneKapitel(alle: GeleseneKapitel): number {
  return Object.values(alle).reduce((sum, arr) => sum + arr.length, 0);
}

export async function getStreak(): Promise<StreakStatus> {
  const stored = await kvGet<StreakStatus>("streak");
  return stored ?? { tage: [], freezesVerfuegbar: 2, laengsteSerie: 0 };
}

export async function addAktivMinuten(minuten: number): Promise<StreakStatus> {
  const status = await getStreak();
  const today = new Date().toISOString().slice(0, 10);
  const idx = status.tage.findIndex((t) => t.datum === today);
  if (idx >= 0) {
    status.tage[idx] = { datum: today, minuten: status.tage[idx].minuten + minuten };
  } else {
    status.tage.push({ datum: today, minuten });
  }
  status.tage.sort((a, b) => (a.datum < b.datum ? -1 : 1));
  const consec = computeCurrentStreak(status.tage);
  status.laengsteSerie = Math.max(status.laengsteSerie, consec);
  await kvSet("streak", status);
  return status;
}

function computeCurrentStreak(tage: StreakTag[]): number {
  const erfuellt = new Set(tage.filter((t) => t.minuten >= 5).map((t) => t.datum));
  let streak = 0;
  const d = new Date();
  for (;;) {
    const key = d.toISOString().slice(0, 10);
    if (erfuellt.has(key)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

export async function getCurrentStreakCount(): Promise<number> {
  const status = await getStreak();
  return computeCurrentStreak(status.tage);
}

export async function resetStreak(): Promise<void> {
  await kvSet("streak", { tage: [], freezesVerfuegbar: 2, laengsteSerie: 0 } satisfies StreakStatus);
}
