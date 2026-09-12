import initSqlJs, { type Database } from "sql.js";
import type { BookMeta, Translation, VerseRow } from "../../types";

let dbPromise: Promise<Database> | null = null;

export function loadBibleDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const SQL = await initSqlJs({
        locateFile: (file: string) => `${import.meta.env.BASE_URL}sqljs/${file}`,
      });
      const res = await fetch(`${import.meta.env.BASE_URL}bible-data/bible.db`);
      if (!res.ok) throw new Error("bible.db konnte nicht geladen werden");
      const buf = await res.arrayBuffer();
      return new SQL.Database(new Uint8Array(buf));
    })();
  }
  return dbPromise;
}

function rowsToObjects<T = Record<string, unknown>>(
  db: Database,
  sql: string,
  params: (string | number)[] = []
): T[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const out: T[] = [];
  while (stmt.step()) {
    out.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return out;
}

export async function getAllBooks(): Promise<BookMeta[]> {
  const db = await loadBibleDb();
  return rowsToObjects<BookMeta>(
    db,
    "SELECT id, osis, name_de, testament, book_order FROM books ORDER BY book_order"
  );
}

export async function getBookByOsis(osis: string): Promise<BookMeta | undefined> {
  const books = await getAllBooks();
  return books.find((b) => b.osis === osis);
}

export async function getChapterVerses(
  osis: string,
  chapter: number,
  translation: Translation = "LUT1912"
): Promise<VerseRow[]> {
  const db = await loadBibleDb();
  if (translation === "LUT1912") {
    const rows = rowsToObjects<{ chapter: number; verse: number; text: string; name_de: string; osis: string }>(
      db,
      `SELECT v.chapter as chapter, v.verse as verse, v.text as text, b.name_de as name_de, b.osis as osis
       FROM verses v JOIN books b ON b.id = v.book_id
       WHERE b.osis = ? AND v.chapter = ? ORDER BY v.verse`,
      [osis, chapter]
    );
    return rows.map((r) => ({ osis: r.osis, bookName: r.name_de, chapter: r.chapter, verse: r.verse, text: r.text }));
  }
  const rows = rowsToObjects<{ chapter: number; verse: number; text: string; name_de: string; osis: string }>(
    db,
    `SELECT u.chapter as chapter, u.verse as verse, u.text as text, b.name_de as name_de, b.osis as osis
     FROM uebers u JOIN books b ON b.id = u.book_id
     WHERE b.osis = ? AND u.chapter = ? AND u.translation = ? ORDER BY u.verse`,
    [osis, chapter, translation]
  );
  if (rows.length === 0) {
    // Fallback auf Luther, falls Stelle in der Uebersetzung fehlt (siehe 3.2)
    return getChapterVerses(osis, chapter, "LUT1912");
  }
  return rows.map((r) => ({ osis: r.osis, bookName: r.name_de, chapter: r.chapter, verse: r.verse, text: r.text }));
}

export async function getVerseRange(
  osis: string,
  chapter: number,
  verseVon: number,
  verseBis: number,
  translation: Translation = "LUT1912"
): Promise<VerseRow[]> {
  const chapterVerses = await getChapterVerses(osis, chapter, translation);
  return chapterVerses.filter((v) => v.verse >= verseVon && v.verse <= verseBis);
}

export async function getVerseText(
  osis: string,
  chapter: number,
  verse: number,
  translation: Translation = "LUT1912"
): Promise<string | null> {
  const verses = await getVerseRange(osis, chapter, verse, verse, translation);
  return verses[0]?.text ?? null;
}

export async function getChapterCount(osis: string): Promise<number> {
  const db = await loadBibleDb();
  const rows = rowsToObjects<{ n: number }>(
    db,
    `SELECT MAX(v.chapter) as n FROM verses v JOIN books b ON b.id = v.book_id WHERE b.osis = ?`,
    [osis]
  );
  return rows[0]?.n ?? 0;
}

export interface SearchHit extends VerseRow {
  matchedTerms: string[];
}

function normalizeQueryText(text: string): string {
  const map: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", ß: "ss" };
  let t = text.toLowerCase();
  for (const [k, v] of Object.entries(map)) t = t.split(k).join(v);
  t = t
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t;
}

const STOPWORDS = new Set(
  "der die das ich du er sie es wir ihr bin bist ist sind war waren hat habe hast haben und oder aber nicht kein keine ein eine einen dem den des mir mich dir dich uns euch ihm ihn ihnen zu auf in an mit von fuer bei nach aus so wie was wer wo wann warum wenn dass weil auch nur schon noch immer sehr".split(
    " "
  )
);

/** Sucht Verse, deren normalisierter Text ALLE Suchwoerter enthaelt
 * (jedes Wort als Teilstring, deckt Beugungsformen wie "liebte"/"geliebt"
 * fuer den Wortstamm "lieb" ab). Ohne FTS5 (im sql.js-WASM-Build nicht
 * enthalten) per LIKE-Verknuepfung auf der ueberschaubar kleinen
 * verses-Tabelle - fuer diese Datenmenge ausreichend performant. */
export async function searchFullText(
  query: string,
  opts: { testament?: "AT" | "NT" | "ALLE"; includeSchlachter?: boolean } = {}
): Promise<SearchHit[]> {
  const db = await loadBibleDb();
  const normQuery = normalizeQueryText(query);
  const words = normQuery.split(" ").filter((w) => w.length >= 2 && !STOPWORDS.has(w));
  if (words.length === 0) return [];

  const whereWords = words.map(() => "v.text_norm LIKE ?").join(" AND ");
  const testamentClause = opts.testament && opts.testament !== "ALLE" ? "AND b.testament = ?" : "";
  const params: (string | number)[] = words.map((w) => `%${w}%`);
  if (testamentClause) params.push(opts.testament as string);

  const rows = rowsToObjects<{ chapter: number; verse: number; text: string; name_de: string; osis: string }>(
    db,
    `SELECT v.chapter as chapter, v.verse as verse, v.text as text, b.name_de as name_de, b.osis as osis
     FROM verses v
     JOIN books b ON b.id = v.book_id
     WHERE ${whereWords} ${testamentClause}
     ORDER BY b.book_order, v.chapter, v.verse
     LIMIT 200`,
    params
  );

  return rows.map((r) => ({
    osis: r.osis,
    bookName: r.name_de,
    chapter: r.chapter,
    verse: r.verse,
    text: r.text,
    matchedTerms: words,
  }));
}

/** Wie searchFullText, aber ODER-verknuepft (fuer "Aehnliche Stellen",
 * wenn die UND-Suche zu wenige Treffer liefert). */
export async function searchAnyTerm(
  query: string,
  opts: { testament?: "AT" | "NT" | "ALLE" } = {}
): Promise<SearchHit[]> {
  const db = await loadBibleDb();
  const normQuery = normalizeQueryText(query);
  const words = normQuery.split(" ").filter((w) => w.length >= 2 && !STOPWORDS.has(w));
  if (words.length === 0) return [];

  const whereWords = `(${words.map(() => "v.text_norm LIKE ?").join(" OR ")})`;
  const testamentClause = opts.testament && opts.testament !== "ALLE" ? "AND b.testament = ?" : "";
  const params: (string | number)[] = words.map((w) => `%${w}%`);
  if (testamentClause) params.push(opts.testament as string);

  const rows = rowsToObjects<{ chapter: number; verse: number; text: string; name_de: string; osis: string }>(
    db,
    `SELECT v.chapter as chapter, v.verse as verse, v.text as text, b.name_de as name_de, b.osis as osis
     FROM verses v
     JOIN books b ON b.id = v.book_id
     WHERE ${whereWords} ${testamentClause}
     ORDER BY b.book_order, v.chapter, v.verse
     LIMIT 100`,
    params
  );
  return rows.map((r) => ({
    osis: r.osis,
    bookName: r.name_de,
    chapter: r.chapter,
    verse: r.verse,
    text: r.text,
    matchedTerms: words,
  }));
}

export interface DailyVerseInfo extends VerseRow {}

export async function getDailyVerse(date = new Date()): Promise<DailyVerseInfo | null> {
  const db = await loadBibleDb();
  const rows = rowsToObjects<{ n: number }>(db, "SELECT COUNT(*) as n FROM daily");
  const count = rows[0]?.n ?? 0;
  if (count === 0) return null;
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000
  );
  const idx = (dayOfYear % count) + 1;
  const daily = rowsToObjects<{
    chapter: number;
    verse_von: number;
    verse_bis: number;
    osis: string;
    name_de: string;
  }>(
    db,
    `SELECT d.chapter as chapter, d.verse_von as verse_von, d.verse_bis as verse_bis, b.osis as osis, b.name_de as name_de
     FROM daily d JOIN books b ON b.id = d.book_id WHERE d.day_of_year = ?`,
    [idx]
  );
  const d = daily[0];
  if (!d) return null;
  const verses = await getVerseRange(d.osis, d.chapter, d.verse_von, d.verse_bis, "LUT1912");
  const text = verses.map((v) => v.text).join(" ");
  return { osis: d.osis, bookName: d.name_de, chapter: d.chapter, verse: d.verse_von, text };
}

export interface Topic {
  id: number;
  name: string;
  farbe: string;
}

export async function getTopics(): Promise<Topic[]> {
  const db = await loadBibleDb();
  return rowsToObjects<Topic>(db, "SELECT id, name, farbe FROM topics ORDER BY id");
}

export async function getTopicVerses(topicId: number): Promise<VerseRow[]> {
  const db = await loadBibleDb();
  const rows = rowsToObjects<{ chapter: number; verse: number; osis: string; name_de: string }>(
    db,
    `SELECT tv.chapter as chapter, tv.verse as verse, b.osis as osis, b.name_de as name_de
     FROM topic_verses tv JOIN books b ON b.id = tv.book_id WHERE tv.topic_id = ?`,
    [topicId]
  );
  const out: VerseRow[] = [];
  for (const r of rows) {
    const text = await getVerseText(r.osis, r.chapter, r.verse, "LUT1912");
    if (text) out.push({ osis: r.osis, bookName: r.name_de, chapter: r.chapter, verse: r.verse, text });
  }
  return out;
}
