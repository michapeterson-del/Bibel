import { getVerseRange } from "../db/bibleDb";

export async function buildVersKontext(
  osis: string,
  bookName: string,
  chapter: number,
  verseVon: number,
  verseBis: number
): Promise<string> {
  const [lut, sch, menge] = await Promise.all([
    getVerseRange(osis, chapter, verseVon, verseBis, "LUT1912"),
    getVerseRange(osis, chapter, verseVon, verseBis, "SCH1951"),
    getVerseRange(osis, chapter, verseVon, verseBis, "MENGE1939"),
  ]);
  const join = (rows: { text: string }[]) => rows.map((r) => r.text).join(" ");
  const verseLabel = verseVon === verseBis ? `${verseVon}` : `${verseVon}-${verseBis}`;
  return [
    `VERTIEFUNG zu ${bookName} ${chapter},${verseLabel}:`,
    `Luther 1912: "${join(lut)}"`,
    `Schlachter 1951: "${join(sch)}"`,
    `Menge 1939: "${join(menge)}"`,
    "(Kein Urtext-/Strong-Datensatz und keine Kommentar-Auszuege in dieser Version verfuegbar.)",
  ].join("\n");
}
