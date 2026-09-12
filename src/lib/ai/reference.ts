import { getAllBooks, getVerseRange } from "../db/bibleDb";
import type { BookMeta } from "../../types";

export interface ParsedRef {
  osis: string;
  bookName: string;
  chapter: number;
  verseVon: number;
  verseBis: number;
}

function normalizeBookName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/\s+/g, " ")
    .trim();
}

let bookIndexPromise: Promise<Map<string, BookMeta>> | null = null;

async function getBookIndex(): Promise<Map<string, BookMeta>> {
  if (!bookIndexPromise) {
    bookIndexPromise = (async () => {
      const books = await getAllBooks();
      const idx = new Map<string, BookMeta>();
      for (const b of books) {
        idx.set(normalizeBookName(b.name_de), b);
        // Zusaetzliche gaengige Schreibweisen ohne Nummern-Punkt, z.B. "1 mose"
        idx.set(normalizeBookName(b.name_de.replace("1. ", "1 ").replace("2. ", "2 ").replace("3. ", "3 ")), b);
      }
      return idx;
    })();
  }
  return bookIndexPromise;
}

const REF_RE = /^(.+?)\s+(\d+)[.,:](\d+)(?:\s*[-–]\s*(\d+))?$/;

export async function parseGermanReference(ref: string): Promise<ParsedRef | null> {
  const trimmed = ref.trim();
  const match = trimmed.match(REF_RE);
  if (!match) return null;
  const [, bookPart, chapterStr, verseVonStr, verseBisStr] = match;
  const idx = await getBookIndex();
  const book = idx.get(normalizeBookName(bookPart));
  if (!book) return null;
  const chapter = parseInt(chapterStr, 10);
  const verseVon = parseInt(verseVonStr, 10);
  const verseBis = verseBisStr ? parseInt(verseBisStr, 10) : verseVon;
  return { osis: book.osis, bookName: book.name_de, chapter, verseVon, verseBis };
}

export async function referenceExists(ref: string): Promise<boolean> {
  const parsed = await parseGermanReference(ref);
  if (!parsed) return false;
  const verses = await getVerseRange(parsed.osis, parsed.chapter, parsed.verseVon, parsed.verseVon, "LUT1912");
  return verses.length > 0;
}
