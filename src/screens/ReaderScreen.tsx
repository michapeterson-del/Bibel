import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { BookMeta, Farbe, FarbLabels, LesezeichenEintrag, VerseRow } from "../types";
import {
  getAllBooks,
  getBookByOsis,
  getChapterCount,
  getChapterVerses,
} from "../lib/db/bibleDb";
import {
  addAktivMinuten,
  getFarbLabels,
  getLeseFortschritt,
  istKapitelGelesen,
  listLesezeichen,
  saveLeseFortschritt,
  setKapitelGelesen,
} from "../lib/db/userDb";
import { useSettings } from "../lib/SettingsContext";
import { useVerseDetail } from "../lib/VerseDetailContext";
import TranslationSwitch from "../components/TranslationSwitch";
import BookPickerModal from "../components/BookPickerModal";

const FARBE_HEX: Record<Farbe, string> = {
  gelb: "#EFE5BC",
  gruen: "#B2D2C2",
  blau: "#ABC6E4",
  rosa: "#E6BAC5",
  lila: "#D3B4CC",
};

export default function ReaderScreen() {
  const { osis: osisParam, kapitel: kapitelParam } = useParams();
  const navigate = useNavigate();
  const { settings, update } = useSettings();
  const { open: openVerseDetail, marksVersion } = useVerseDetail();

  const [book, setBook] = useState<BookMeta | null>(null);
  const [chapter, setChapter] = useState<number>(kapitelParam ? parseInt(kapitelParam, 10) : 1);
  const [chapterCount, setChapterCount] = useState(0);
  const [verses, setVerses] = useState<VerseRow[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [marks, setMarks] = useState<LesezeichenEintrag[]>([]);
  const [fertigMsg, setFertigMsg] = useState(false);
  const [farbLabels, setFarbLabels] = useState<FarbLabels | null>(null);

  useEffect(() => {
    getFarbLabels().then(setFarbLabels);
  }, []);

  // Initiales Buch/Kapitel bestimmen: aus URL, sonst Lesefortschritt, sonst Johannes 1
  useEffect(() => {
    (async () => {
      if (osisParam) {
        const b = await getBookByOsis(osisParam);
        if (b) {
          setBook(b);
          setChapter(kapitelParam ? parseInt(kapitelParam, 10) : 1);
          return;
        }
      }
      const progress = await getLeseFortschritt();
      if (progress) {
        const b = await getBookByOsis(progress.osis);
        if (b) {
          setBook(b);
          setChapter(progress.kapitel);
          return;
        }
      }
      const books = await getAllBooks();
      const john = books.find((b) => b.osis === "JHN");
      setBook(john ?? books[0]);
      setChapter(1);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [osisParam, kapitelParam]);

  useEffect(() => {
    if (!book) return;
    getChapterCount(book.osis).then(setChapterCount);
  }, [book]);

  useEffect(() => {
    if (!book || !settings) return;
    getChapterVerses(book.osis, chapter, settings.standardUebersetzung).then(setVerses);
    saveLeseFortschritt({ osis: book.osis, kapitel: chapter, vers: 1, uebersetzung: settings.standardUebersetzung });
    istKapitelGelesen(book.osis, chapter).then(setFertigMsg);
  }, [book, chapter, settings?.standardUebersetzung]);

  useEffect(() => {
    if (!book) return;
    listLesezeichen().then((all) =>
      setMarks(all.filter((m) => m.buch === book.osis && m.kapitel === chapter))
    );
  }, [book, chapter, marksVersion]);

  if (!book || !settings) return <p>Lädt…</p>;

  function goChapter(delta: number) {
    const next = chapter + delta;
    if (next < 1 || next > chapterCount) return;
    setChapter(next);
    navigate(`/lesen/${book!.osis}/${next}`, { replace: true });
  }

  function markForVerse(verseNum: number) {
    return marks.find(
      (m) => m.typ !== "notiz" && verseNum >= m.vers_von && verseNum <= m.vers_bis
    );
  }

  function notizFuerVerse(verseNum: number) {
    return marks.find(
      (m) => m.typ === "notiz" && verseNum >= m.vers_von && verseNum <= m.vers_bis
    );
  }

  async function kapitelFertig() {
    const neuerStatus = !fertigMsg;
    await setKapitelGelesen(book!.osis, chapter, neuerStatus);
    if (neuerStatus) {
      await addAktivMinuten(5);
      setFertigMsg(neuerStatus);
      navigate(`/stillezeit/${book!.osis}/${chapter}`);
      return;
    }
    setFertigMsg(neuerStatus);
  }

  return (
    <div>
      <div className="header-bar" style={{ paddingTop: 8, flexWrap: "wrap" }}>
        <button className="chip" onClick={() => setShowPicker(true)} style={{ fontWeight: 700 }}>
          {book.name_de} {chapter} ▾
        </button>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4, alignItems: "center" }}>
          <button className="chip" onClick={() => navigate(`/stillezeit/kapitel/${book.osis}/${chapter}`)}>
            📋 Einträge
          </button>
          <button className="icon-btn" onClick={() => goChapter(-1)} disabled={chapter <= 1}>‹</button>
          <button className="icon-btn" onClick={() => goChapter(1)} disabled={chapter >= chapterCount}>›</button>
        </div>
      </div>

      <TranslationSwitch value={settings.standardUebersetzung} onChange={(t) => update({ standardUebersetzung: t })} />

      <div style={{ display: "flex", gap: 8, marginTop: 10, marginBottom: 10 }}>
        <select
          value={settings.schriftgroesse}
          onChange={(e) => update({ schriftgroesse: e.target.value as typeof settings.schriftgroesse })}
          style={{ width: "auto" }}
        >
          <option value="klein">Klein</option>
          <option value="normal">Normal</option>
          <option value="gross">Groß</option>
        </select>
        <select
          value={settings.zeilenabstand}
          onChange={(e) => update({ zeilenabstand: e.target.value as typeof settings.zeilenabstand })}
          style={{ width: "auto" }}
        >
          <option value="eng">Eng</option>
          <option value="normal">Normal</option>
          <option value="locker">Locker</option>
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.85rem" }}>
          <input
            type="checkbox"
            checked={settings.versnummernAn}
            onChange={(e) => update({ versnummernAn: e.target.checked })}
          />
          Versnummern
        </label>
      </div>

      <div
        className="card"
        style={{ fontSize: "var(--base-font-size)", lineHeight: "var(--base-line-height)" }}
      >
        {verses.map((v) => {
          const mark = markForVerse(v.verse);
          const notiz = notizFuerVerse(v.verse);
          return (
            <span
              key={v.verse}
              className={`verse-row ${mark ? "marked" : ""}`}
              title={mark ? farbLabels?.[mark.farbe] : undefined}
              style={{
                display: "inline",
                background: mark && mark.typ === "markierung" ? FARBE_HEX[mark.farbe] : undefined,
                color: mark && mark.typ === "markierung" ? "#332f1a" : undefined,
                boxDecorationBreak: mark && mark.typ === "markierung" ? "clone" : undefined,
                WebkitBoxDecorationBreak: mark && mark.typ === "markierung" ? "clone" : undefined,
                borderRadius: mark && mark.typ === "markierung" ? 3 : undefined,
                padding: mark && mark.typ === "markierung" ? "0.05em 0" : undefined,
                borderLeft: mark && mark.typ === "lesezeichen" ? `4px solid ${FARBE_HEX[mark.farbe]}` : undefined,
                cursor: "pointer",
              }}
              onClick={() =>
                openVerseDetail({
                  osis: book.osis,
                  bookName: book.name_de,
                  chapter,
                  verseVon: v.verse,
                  verseBis: v.verse,
                })
              }
            >
              {settings.versnummernAn && <sup className="verse-num">{v.verse}</sup>}
              {notiz && (
                <sup title={notiz.notiz} style={{ marginRight: 2 }}>
                  📝
                </sup>
              )}
              {v.text}{" "}
            </span>
          );
        })}
      </div>

      <button
        className={fertigMsg ? "btn" : "btn secondary"}
        style={{ width: "100%", marginTop: 14 }}
        onClick={kapitelFertig}
      >
        {fertigMsg ? "✓ Kapitel fertig gelesen" : "Als gelesen markieren"}
      </button>

      {showPicker && (
        <BookPickerModal
          onClose={() => setShowPicker(false)}
          onSelect={(osis, ch) => {
            setShowPicker(false);
            navigate(`/lesen/${osis}/${ch}`);
          }}
        />
      )}
    </div>
  );
}
